/**
 * Analytics service facade (v0.9.0 scaling).
 *
 * The store moved behind the AnalyticsSink interface: SQLite by default,
 * Postgres when DATABASE_URL is set. This module keeps the original export
 * surface (track / summary / hashSession / getDb / _resetDb) so callers and
 * tests are untouched.
 *
 * PII policy is unchanged: the raw sessionId is NEVER stored (only a
 * truncated SHA-256 hash); metadata containing email-like patterns is
 * dropped on write (see serializeMetadata in analyticsSink.ts).
 */
import {
  _resetAnalyticsSink,
  getAnalyticsSink,
  hashSession,
  type AnalyticsSummary,
  type TrackInput,
} from "./analyticsSink.js";
import { _resetSharedSqliteSink, getSharedSqliteSink } from "./sqliteSink.js";

export type { TrackInput, AnalyticsSummary };
export { hashSession };

/**
 * Best-effort, non-blocking. Safe to call from hot paths — analytics must
 * never break the quote flow.
 */
export function track(input: TrackInput): void {
  void getAnalyticsSink()
    .then((sink) => sink.track(input))
    .catch(() => undefined);
}

export async function summary(): Promise<AnalyticsSummary> {
  const sink = await getAnalyticsSink();
  return sink.summary();
}

/**
 * Direct DB handle for tests and raw queries. Only meaningful when the
 * SQLite sink is active (the default); shares the process-wide instance with
 * the async sink selector so ":memory:" databases never diverge.
 */
export function getDb(): ReturnType<ReturnType<typeof getSharedSqliteSink>["getDb"]> {
  return getSharedSqliteSink().getDb();
}

/** Test hook: reset the cached DB handle (used when swapping to :memory:). */
export function _resetDb(): void {
  _resetSharedSqliteSink();
  void _resetAnalyticsSink().catch(() => undefined);
}
