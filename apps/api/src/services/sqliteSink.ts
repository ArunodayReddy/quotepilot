/**
 * SQLite AnalyticsSink (better-sqlite3) — the default, zero-config backend.
 *
 * This is the original v0.2.0 analytics store, moved behind the
 * AnalyticsSink interface in v0.9.0. Behavior is unchanged.
 *
 * DB location: apps/api/data/analytics.db (gitignored). Override with
 * ANALYTICS_DB (":memory:" in tests).
 */
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import {
  hashSession,
  serializeMetadata,
  type AnalyticsSink,
  type AnalyticsSummary,
  type TrackInput,
} from "./analyticsSink.js";

const here = dirname(fileURLToPath(import.meta.url));
const API_ROOT = join(here, "..", "..");

function resolveDbPath(): string {
  const raw = process.env.ANALYTICS_DB ?? config.analyticsDbPath;
  if (raw === ":memory:") return raw;
  return isAbsolute(raw) ? raw : join(API_ROOT, raw);
}

const FUNNEL_STEPS = ["quote_requested", "quotes_completed", "email_sent"];

interface CarrierMeta {
  carrierId?: string;
  latencyMs?: number;
  success?: boolean;
  rank?: number;
}

export class SqliteSink implements AnalyticsSink {
  readonly kind = "sqlite" as const;
  private db: Database.Database | null = null;

  getDb(): Database.Database {
    if (this.db) return this.db;
    const path = resolveDbPath();
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
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
    return this.db;
  }

  track(input: TrackInput): void {
    const metadataJson = serializeMetadata(input.event, input.page, input.metadata);
    this.getDb()
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

  async summary(): Promise<AnalyticsSummary> {
    const d = this.getDb();

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

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async reset(): Promise<void> {
    // Test hook semantics (matches the pre-v0.9.0 _resetDb): drop the handle.
    // ":memory:" DBs start empty on re-open; file DBs keep their data.
    await this.close();
  }
}

/**
 * Shared process-wide instance. The async sink selector (analyticsSink.ts)
 * and the synchronous getDb() test path MUST share one instance — otherwise
 * ":memory:" databases diverge and tests see empty tables.
 */
let shared: SqliteSink | null = null;

export function getSharedSqliteSink(): SqliteSink {
  if (!shared) shared = new SqliteSink();
  return shared;
}

/** Test hook: drop the shared instance. */
export function _resetSharedSqliteSink(): void {
  shared = null;
}
