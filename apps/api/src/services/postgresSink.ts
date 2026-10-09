/**
 * Postgres AnalyticsSink (v0.9.0 scaling).
 *
 * Active when DATABASE_URL is set. Schema-compatible with the SQLite store:
 * the same `events` table shape (SERIAL id instead of AUTOINCREMENT).
 *
 * track() stays best-effort and non-blocking: the INSERT is fired without
 * awaiting so a slow database can never stall the quote flow; failures are
 * logged and dropped. summary() is fully async.
 *
 * `pg` is dynamically imported — never loaded in laptop dev.
 */
import type { Pool } from "pg";
import { logger } from "../lib/logger.js";
import {
  hashSession,
  serializeMetadata,
  type AnalyticsSink,
  type AnalyticsSummary,
  type TrackInput,
} from "./analyticsSink.js";

const FUNNEL_STEPS = ["quote_requested", "quotes_completed", "email_sent"];

interface CarrierMeta {
  carrierId?: string;
  latencyMs?: number;
  success?: boolean;
  rank?: number;
}

export class PostgresSink implements AnalyticsSink {
  readonly kind = "postgres" as const;
  private pool: Pool | null = null;
  private readonly connectionString: string;
  private schemaReady: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  /** Probe the connection and ensure the schema. Rejects when unreachable. */
  async ready(): Promise<void> {
    const { Pool: PoolCtor } = await import("pg");
    const pool: Pool = new PoolCtor({ connectionString: this.connectionString, max: 10 });
    pool.on("error", (err: Error) => logger.warn({ msg: "postgres_pool_error", reason: err.message }));
    // Probe: throws when the database is unreachable → caller falls back.
    await pool.query("SELECT 1");
    this.pool = pool;
    this.schemaReady = this.ensureSchema();
    await this.schemaReady;
    logger.info({ msg: "analytics_postgres_ready" });
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
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
  }

  private db(): Pool | null {
    return this.pool;
  }

  track(input: TrackInput): void {
    const pool = this.db();
    if (!pool) return;
    const metadataJson = serializeMetadata(input.event, input.page, input.metadata);
    // Best-effort: never let analytics block or break the request path.
    void pool
      .query(
        "INSERT INTO events (event, page, element, session_hash, timestamp, metadata) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          input.event,
          input.page,
          input.element ?? null,
          hashSession(input.sessionId),
          new Date().toISOString(),
          metadataJson,
        ],
      )
      .catch((err: Error) => {
        logger.warn({ msg: "analytics_pg_insert_failed", reason: err.message });
      });
  }

  async summary(): Promise<AnalyticsSummary> {
    const pool = this.db();
    if (!pool) throw new Error("postgres sink not ready");
    if (this.schemaReady) await this.schemaReady;

    const clicks = await pool.query(
      `SELECT element, page, COUNT(*) AS count FROM events
       WHERE element IS NOT NULL GROUP BY element, page ORDER BY count DESC`,
    );
    const clicksByElement = clicks.rows.map((r: { element: string; page: string; count: string }) => ({
      element: r.element,
      page: r.page,
      count: Number(r.count),
    }));

    const funnel = [];
    for (const step of FUNNEL_STEPS) {
      const r = await pool.query("SELECT COUNT(DISTINCT session_hash) AS count FROM events WHERE event = $1", [step]);
      const count = Number(r.rows[0]?.count ?? 0);
      funnel.push({ step, completed: count > 0, count });
    }

    const quoteRows = await pool.query(
      "SELECT metadata FROM events WHERE event = 'quote_received' AND metadata IS NOT NULL",
    );
    const byCarrier = new Map<string, { quotes: number; latencySum: number; wins: number }>();
    for (const row of quoteRows.rows as Array<{ metadata: string }>) {
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

    const daily = await pool.query(
      `SELECT substr(timestamp, 1, 10) AS date, COUNT(DISTINCT session_hash) AS sessions
       FROM events GROUP BY date ORDER BY date`,
    );
    const dailySessions = daily.rows.map((r: { date: string; sessions: string }) => ({
      date: r.date,
      sessions: Number(r.sessions),
    }));

    return { clicksByElement, funnel, carriers, dailySessions };
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end().catch(() => undefined);
      this.pool = null;
    }
    this.schemaReady = null;
  }

  async reset(): Promise<void> {
    const pool = this.db();
    if (pool) {
      await pool.query("TRUNCATE events").catch(() => undefined);
    }
  }
}
