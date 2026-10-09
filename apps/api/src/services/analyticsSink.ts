/**
 * AnalyticsSink abstraction (v0.9.0 scaling).
 *
 * SQLite (better-sqlite3) is the default — zero config, perfect for laptop
 * dev and demo. Postgres (via `pg`) is selected when DATABASE_URL is set, for
 * write throughput a single SQLite file can't sustain. Schema-compatible:
 * both backends expose the same `events` table shape.
 *
 * track() is synchronous and best-effort by design: analytics must never
 * break the quote flow. The Postgres implementation fires the INSERT without
 * awaiting and logs failures. summary() is async in both backends.
 */
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { sha256Hex } from "../lib/hash.js";

export interface TrackInput {
  event: string;
  page: string;
  element?: string;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsSummary {
  clicksByElement: Array<{ element: string; page: string; count: number }>;
  funnel: Array<{ step: string; completed: boolean; count: number }>;
  carriers: Array<{ carrierId: string; quotes: number; avgLatencyMs: number; winRate: number }>;
  dailySessions: Array<{ date: string; sessions: number }>;
}

export interface AnalyticsSink {
  readonly kind: "sqlite" | "postgres";
  track(input: TrackInput): void;
  summary(): Promise<AnalyticsSummary>;
  /** Release resources. Test hook doubles as reset when implemented. */
  close(): Promise<void>;
  /** Test hook: wipe all events. */
  reset(): Promise<void>;
}

const EMAIL_LIKE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** Truncated SHA-256 of the session id — the only stored identity token. */
export function hashSession(sessionId: string): string {
  return sha256Hex(`quotepilot-session:${sessionId}`).slice(0, 16);
}

/**
 * Serialize metadata, dropping it entirely when it smuggles email-like PII.
 * Shared by both sinks — the PII policy lives in exactly one place.
 */
export function serializeMetadata(
  event: string,
  page: string,
  metadata: Record<string, unknown> | undefined,
): string | null {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  const serialized = JSON.stringify(metadata);
  if (EMAIL_LIKE.test(serialized)) {
    logger.warn({ msg: "analytics_metadata_dropped", event, page });
    return null;
  }
  return serialized;
}

let active: AnalyticsSink | null = null;
let activeKind: "sqlite" | "postgres" | null = null;

export async function getAnalyticsSink(): Promise<AnalyticsSink> {
  if (active) return active;
  if (config.databaseUrl) {
    try {
      const { PostgresSink } = await import("./postgresSink.js");
      const sink = new PostgresSink(config.databaseUrl);
      await sink.ready();
      active = sink;
      activeKind = "postgres";
      logger.info({ msg: "analytics_sink_selected", kind: "postgres" });
      return active;
    } catch (err) {
      // Analytics must never break quoting: fall back loudly, don't crash.
      logger.warn({
        msg: "postgres_unavailable_falling_back_to_sqlite",
        reason: (err as Error).message,
      });
    }
  }
  const { getSharedSqliteSink } = await import("./sqliteSink.js");
  active = getSharedSqliteSink();
  activeKind = "sqlite";
  logger.info({ msg: "analytics_sink_selected", kind: "sqlite" });
  return active;
}

/** Which backend is active. */
export async function analyticsSinkKind(): Promise<"sqlite" | "postgres"> {
  await getAnalyticsSink();
  return activeKind ?? "sqlite";
}

/** Test hook: drop the cached sink. */
export async function _resetAnalyticsSink(): Promise<void> {
  if (active) {
    await active.close().catch(() => undefined);
    active = null;
    activeKind = null;
  }
}
