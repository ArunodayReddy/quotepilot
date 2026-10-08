/**
 * In-memory quote job queue.
 *
 * Lifecycle: POST /api/quote → job created (status "queued", 202 returned
 * immediately) → adapters run in parallel in the background ("running",
 * progress updates per carrier) → "complete" with ranked results.
 *
 * Per-carrier timeout: 8s (config.perCarrierTimeoutMs). A slow carrier fails
 * closed into a timeout QuoteResult — it never blocks the job.
 *
 * On completion: if the user opted in (or asked via /api/email/notify), the
 * "your quotes are ready" email goes out through emailService; analytics
 * events are emitted at every step (no PII — see analyticsService).
 *
 * UPGRADE PATH (BullMQ/Redis): this module is intentionally a narrow seam.
 * To scale past one process:
 *   1. Replace the internal Map with a BullMQ queue ("quote-jobs") backed by
 *      Redis; createQuoteJob() becomes queue.add(), workers consume jobs.
 *   2. Move per-carrier fan-out into child jobs or a worker pool; keep the
 *      8s per-carrier timeout as the job's timeout option.
 *   3. Persist job state in Redis (or the analytics DB) instead of the Map;
 *      getQuoteJob() reads it back — the route contract stays identical.
 *   4. Add retries with backoff for transient adapter failures, and a
 *      dead-letter queue for poison profiles.
 * See apps/api/UPGRADE_PATH.md for the full checklist.
 */
import { randomUUID } from "node:crypto";
import type {
  QuoteAdapter,
  QuoteJob,
  QuoteRequest,
  QuoteResult,
} from "../../../../packages/shared/dist/types.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { getCarriersForState } from "./carrierRegistry.js";
import { track } from "./analyticsService.js";
import { sendQuotesReady } from "./emailService.js";
import { allstateAdapter } from "../adapters/allstate.js";
import { amicaAdapter } from "../adapters/amica.js";
import { geicoAdapter } from "../adapters/geico.js";
import { libertyMutualAdapter } from "../adapters/libertyMutual.js";
import { plymouthRockAdapter } from "../adapters/plymouthRock.js";
import { progressiveAdapter } from "../adapters/progressive.js";

const ADAPTERS: QuoteAdapter[] = [
  geicoAdapter,
  progressiveAdapter,
  allstateAdapter,
  libertyMutualAdapter,
  plymouthRockAdapter,
  amicaAdapter,
];

const adapterById = new Map(ADAPTERS.map((a) => [a.carrierId, a]));

interface JobInternal {
  job: QuoteJob;
  request: QuoteRequest;
  email: string;
  emailOptIn: boolean;
  pendingNotifyEmails: Set<string>;
}

const jobs = new Map<string, JobInternal>();

/** Adapters that are both quotable in the registry for this state and wired in code. */
export function adaptersForState(state: string): QuoteAdapter[] {
  const quotableIds = new Set(
    getCarriersForState(state)
      .filter((e) => e.quotable && e.available !== false)
      .map((e) => e.id),
  );
  const picked = ADAPTERS.filter((a) => quotableIds.has(a.carrierId));
  // Fallback: if a state has no quotable registry entries yet, still run the
  // simulation adapters so the demo never dead-ends (marked simulated anyway).
  return picked.length > 0 ? picked : ADAPTERS;
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
  const result = await Promise.race([quote, timeout]);
  return result;
}

function publicJob(internal: JobInternal): QuoteJob {
  // Never expose the raw request (PII) or email addresses on the status endpoint.
  const { job } = internal;
  return {
    jobId: job.jobId,
    status: job.status,
    progress: { ...job.progress },
    results: job.results.map((r) => ({ ...r })),
    carrierCount: job.carrierCount,
    estimatedSeconds: job.estimatedSeconds,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}

export function createQuoteJob(request: QuoteRequest): QuoteJob {
  const adapters = adaptersForState(request.contact.state);
  const jobId = randomUUID();
  const internal: JobInternal = {
    job: {
      jobId,
      status: "queued",
      progress: { completed: 0, total: adapters.length },
      results: [],
      carrierCount: adapters.length,
      // Ceiling of the slowest simulated adapter latency (2500ms) → 3s.
      estimatedSeconds: 3,
      createdAt: new Date().toISOString(),
    },
    request,
    email: request.contact.email,
    emailOptIn: request.emailOptIn ?? true,
    pendingNotifyEmails: new Set(),
  };
  jobs.set(jobId, internal);

  track({ event: "quote_requested", page: "/quote", sessionId: jobId, metadata: { carrierCount: adapters.length } });
  logger.info({ msg: "quote_job_created", jobId, carrierCount: adapters.length, state: request.contact.state });

  // Snapshot the "queued" response BEFORE kicking off background processing.
  const response = publicJob(internal);

  // Fire-and-forget: the HTTP response (202) is already on its way.
  void processJob(jobId, adapters);
  return response;
}

async function processJob(jobId: string, adapters: QuoteAdapter[]): Promise<void> {
  const internal = jobs.get(jobId);
  if (!internal) return;
  internal.job.status = "running";

  const results = await Promise.all(
    adapters.map(async (adapter) => {
      let result: QuoteResult;
      try {
        result = await runAdapter(adapter, internal.request);
      } catch (err) {
        result = errorResult(adapter, err);
      }
      internal.job.progress.completed += 1;
      internal.job.results.push(result);
      logger.info({
        msg: "carrier_quote_done",
        jobId,
        carrierId: result.carrierId,
        success: result.success,
        latencyMs: result.latencyMs,
      });
      return result;
    }),
  );

  // Rank successful quotes cheapest-first for win-rate analytics.
  const ranked = [...results]
    .filter((r) => r.success && r.premium6Mo !== undefined)
    .sort((a, b) => (a.premium6Mo as number) - (b.premium6Mo as number));
  const rankOf = new Map(ranked.map((r, i) => [r.carrierId, i + 1]));
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
  }

  internal.job.status = "complete";
  internal.job.completedAt = new Date().toISOString();
  track({ event: "quotes_completed", page: "/quotes", sessionId: jobId, metadata: { carrierCount: results.length } });
  logger.info({ msg: "quote_job_complete", jobId, results: results.length });

  // Email delivery: opt-in from the wizard, plus any /api/email/notify requests.
  const recipients = new Set<string>();
  if (internal.emailOptIn) recipients.add(internal.email);
  for (const e of internal.pendingNotifyEmails) recipients.add(e);

  const cheapest = ranked[0];
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

export function getQuoteJob(jobId: string): QuoteJob | undefined {
  const internal = jobs.get(jobId);
  return internal ? publicJob(internal) : undefined;
}

/**
 * Called by POST /api/email/notify. Returns "send-now" when the job already
 * completed (caller should send immediately), "queued" when the address was
 * parked for completion, "not-found" for unknown jobs.
 */
export function requestNotifyOnComplete(jobId: string, email: string): "send-now" | "queued" | "not-found" {
  const internal = jobs.get(jobId);
  if (!internal) return "not-found";
  if (internal.job.status === "complete") return "send-now";
  internal.pendingNotifyEmails.add(email);
  return "queued";
}

/** Test hook: clear all jobs between tests. */
export function _resetJobs(): void {
  jobs.clear();
}
