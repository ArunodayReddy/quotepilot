/**
 * Analytics service — better-sqlite3 store.
 *
 * Schema: events(event, page, element, session_hash, timestamp, metadata).
 * PII policy: the raw sessionId is NEVER stored (only a truncated SHA-256
 * hash); metadata containing email-like patterns is dropped on write
 * (defense in depth — see track()).
 *
 * DB location: apps/api/data/analytics.db (gitignored). Override with
 * ANALYTICS_DB (":memory:" in tests).
 */
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { config } from "../lib/config.js";
import { sha256Hex } from "../lib/hash.js";
import { logger } from "../lib/logger.js";

const here = dirname(fileURLToPath(import.meta.url));
const API_ROOT = join(here, "..", "..");

function resolveDbPath(): string {
  const raw = process.env.ANALYTICS_DB ?? config.analyticsDbPath;
  if (raw === ":memory:") return raw;
  return isAbsolute(raw) ? raw : join(API_ROOT, raw);
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const path = resolveDbPath();
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      page TEXT NOT NULL,
      element TEXT,
      session_hash TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
  `);
  logger.info({ msg: "analytics_db_ready", path: path === ":memory:" ? ":memory:" : "analytics.db" });
  return db;
}

const EMAIL_LIKE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** Truncated SHA-256 of the session id — the stored identity token. */
export function hashSession(sessionId: string): string {
  return sha256Hex(`quotepilot-session:${sessionId}`).slice(0, 16);
}

export interface TrackInput {
  event: string;
  page: string;
  element?: string;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

export function track(input: TrackInput): void {
  let metadataJson: string | null = null;
  if (input.metadata && Object.keys(input.metadata).length > 0) {
    const serialized = JSON.stringify(input.metadata);
    if (EMAIL_LIKE.test(serialized)) {
      // Defense in depth: drop metadata that smuggles PII instead of storing it.
      logger.warn({ msg: "analytics_metadata_dropped", event: input.event, page: input.page });
      metadataJson = null;
    } else {
      metadataJson = serialized;
    }
  }
  getDb()
    .prepare(
      "INSERT INTO events (event, page, element, session_hash, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      input.event,
      input.page,
      input.element ?? null,
      hashSession(input.sessionId),
      new Date().toISOString(),
      metadataJson,
    );
}

interface CarrierMeta {
  carrierId?: string;
  latencyMs?: number;
  success?: boolean;
  rank?: number;
}

export interface AnalyticsSummary {
  clicksByElement: Array<{ element: string; page: string; count: number }>;
  funnel: Array<{ step: string; completed: boolean; count: number }>;
  carriers: Array<{ carrierId: string; quotes: number; avgLatencyMs: number; winRate: number }>;
  dailySessions: Array<{ date: string; sessions: number }>;
}

const FUNNEL_STEPS = ["quote_requested", "quotes_completed", "email_sent"];

export function summary(): AnalyticsSummary {
  const d = getDb();

  const clicksByElement = (
    d
      .prepare(
        `SELECT element, page, COUNT(*) AS count FROM events
         WHERE element IS NOT NULL GROUP BY element, page ORDER BY count DESC`,
      )
      .all() as Array<{ element: string; page: string; count: number }>
  ).map((r) => ({ element: r.element, page: r.page, count: Number(r.count) }));

  const funnel = FUNNEL_STEPS.map((step) => {
    const row = d
      .prepare("SELECT COUNT(DISTINCT session_hash) AS count FROM events WHERE event = ?")
      .get(step) as { count: number };
    const count = Number(row.count);
    return { step, completed: count > 0, count };
  });

  const quoteRows = d
    .prepare("SELECT metadata FROM events WHERE event = 'quote_received' AND metadata IS NOT NULL")
    .all() as Array<{ metadata: string }>;
  const byCarrier = new Map<string, { quotes: number; latencySum: number; wins: number }>();
  for (const row of quoteRows) {
    try {
      const m = JSON.parse(row.metadata) as CarrierMeta;
      if (!m.carrierId) continue;
      const agg = byCarrier.get(m.carrierId) ?? { quotes: 0, latencySum: 0, wins: 0 };
      agg.quotes += 1;
      if (typeof m.latencyMs === "number") agg.latencySum += m.latencyMs;
      if (m.rank === 1) agg.wins += 1;
      byCarrier.set(m.carrierId, agg);
    } catch {
      /* skip malformed metadata rows */
    }
  }
  const carriers = [...byCarrier.entries()]
    .map(([carrierId, a]) => ({
      carrierId,
      quotes: a.quotes,
      avgLatencyMs: a.quotes ? Math.round(a.latencySum / a.quotes) : 0,
      winRate: a.quotes ? Math.round((a.wins / a.quotes) * 1000) / 1000 : 0,
    }))
    .sort((x, y) => y.quotes - x.quotes);

  const dailySessions = (
    d
      .prepare(
        `SELECT substr(timestamp, 1, 10) AS date, COUNT(DISTINCT session_hash) AS sessions
         FROM events GROUP BY date ORDER BY date`,
      )
      .all() as Array<{ date: string; sessions: number }>
  ).map((r) => ({ date: r.date, sessions: Number(r.sessions) }));

  return { clicksByElement, funnel, carriers, dailySessions };
}

/** Test hook: reset the cached DB handle (used when swapping to :memory:). */
export function _resetDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
