/**
 * Shared quote-job execution core (v0.9.0 scaling).
 *
 * Extracted from the original in-memory jobQueue so the BullMQ worker runs
 * byte-identical logic: per-carrier fan-out with timeouts, deterministic
 * ranking, analytics events, and the "quotes ready" email. The queue
 * implementations (memory/BullMQ) own job *storage*; this module owns the
 * *work*.
 */
import type {
  QuoteAdapter,
  QuoteJob,
  QuoteRequest,
  QuoteResult,
} from "../../../../packages/shared/dist/types.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { track } from "./analyticsService.js";
import { sendQuotesReady } from "./emailService.js";

/** Everything the completion step needs that isn't the QuoteRequest itself. */
export interface NotifyOptions {
  email: string;
  emailOptIn: boolean;
  phoneOptIn: boolean;
  pendingNotifyEmails: string[];
}

function timeoutResult(adapter: QuoteAdapter, latencyMs: number): QuoteResult {
  return {
    carrierId: adapter.carrierId,
    carrierName: adapter.carrierName,
    success: false,
    currency: "USD",
    simulated: true,
    latencyMs,
    caveats: [],
    quotedAt: new Date().toISOString(),
    error: "Carrier quote timed out",
    errorCode: "ADAPTER_TIMEOUT",
  };
}

function errorResult(adapter: QuoteAdapter, err: unknown): QuoteResult {
  return {
    carrierId: adapter.carrierId,
    carrierName: adapter.carrierName,
    success: false,
    currency: "USD",
    simulated: true,
    latencyMs: 0,
    caveats: [],
    quotedAt: new Date().toISOString(),
    error: "Carrier quote failed",
    errorCode: "ADAPTER_ERROR",
  };
}

async function runAdapter(adapter: QuoteAdapter, request: QuoteRequest): Promise<QuoteResult> {
  const started = Date.now();
  const quote = adapter.quote(request, { timeoutMs: config.perCarrierTimeoutMs });
  const timeout = new Promise<QuoteResult>((resolve) =>
    setTimeout(() => resolve(timeoutResult(adapter, Date.now() - started)), config.perCarrierTimeoutMs),
  );
  return Promise.race([quote, timeout]);
}

/**
 * Run every adapter in parallel. Never rejects: a slow carrier fails closed
 * into a timeout result, a throwing carrier into an error result.
 * onProgress is called (in completion order) after each carrier resolves.
 */
export async function runCarrierFanout(
  request: QuoteRequest,
  adapters: QuoteAdapter[],
  onProgress?: (completed: number, result: QuoteResult) => void,
): Promise<QuoteResult[]> {
  let completed = 0;
  const results = await Promise.all(
    adapters.map(async (adapter) => {
      let result: QuoteResult;
      try {
        result = await runAdapter(adapter, request);
      } catch {
        result = errorResult(adapter, null);
      }
      completed += 1;
      onProgress?.(completed, result);
      return result;
    }),
  );
  return results;
}

/** Rank successful quotes cheapest-first; returns rank lookup by carrierId. */
export function rankResults(results: QuoteResult[]): Map<string, number> {
  const ranked = [...results]
    .filter((r) => r.success && r.premium6Mo !== undefined)
    .sort((a, b) => (a.premium6Mo as number) - (b.premium6Mo as number));
  return new Map(ranked.map((r, i) => [r.carrierId, i + 1]));
}

/**
 * Completion step: analytics events, ranked metadata, and the "quotes ready"
 * email. Idempotent per job — safe to call once from whichever queue ran the
 * fan-out. Never logs PII (consent booleans only).
 */
export async function finishJob(
  jobId: string,
  results: QuoteResult[],
  notify: NotifyOptions,
): Promise<void> {
  const rankOf = rankResults(results);
  for (const r of results) {
    track({
      event: "quote_received",
      page: "/quotes",
      sessionId: jobId,
      metadata: {
        carrierId: r.carrierId,
        latencyMs: r.latencyMs,
        success: r.success,
        premium6Mo: r.premium6Mo ?? null,
        rank: rankOf.get(r.carrierId) ?? null,
      },
    });
    logger.info({
      msg: "carrier_quote_done",
      jobId,
      carrierId: r.carrierId,
      success: r.success,
      latencyMs: r.latencyMs,
    });
  }

  track({ event: "quotes_completed", page: "/quotes", sessionId: jobId, metadata: { carrierCount: results.length } });
  logger.info({ msg: "quote_job_complete", jobId, results: results.length });

  const recipients = new Set<string>();
  if (notify.emailOptIn) recipients.add(notify.email);
  for (const e of notify.pendingNotifyEmails) recipients.add(e);

  const cheapest = [...results]
    .filter((r) => r.success && r.premium6Mo !== undefined)
    .sort((a, b) => (a.premium6Mo as number) - (b.premium6Mo as number))[0];
  for (const email of recipients) {
    const { sent, mode } = await sendQuotesReady(email, {
      jobId,
      carrierCount: results.length,
      cheapestCarrierName: cheapest?.carrierName,
      cheapestPremium6Mo: cheapest?.premium6Mo,
    });
    if (sent || mode === "smtp") {
      track({ event: "email_sent", page: "/quotes", sessionId: jobId });
    }
  }
}

/** Strip a full job down to the public view (no raw request, no emails). */
export function publicJobView(job: {
  jobId: string;
  status: QuoteJob["status"];
  progress: QuoteJob["progress"];
  results: QuoteResult[];
  carrierCount: number;
  estimatedSeconds: number;
  createdAt: string;
  completedAt?: string;
  state: string;
  cached?: boolean;
}): QuoteJob {
  return {
    jobId: job.jobId,
    status: job.status,
    progress: { ...job.progress },
    results: job.results.map((r) => ({ ...r })),
    carrierCount: job.carrierCount,
    estimatedSeconds: job.estimatedSeconds,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    state: job.state,
    cached: job.cached ?? false,
  };
}
