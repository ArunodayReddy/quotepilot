/**
 * MemoryQueue — the default JobQueue (laptop dev, single instance, zero config).
 *
 * Lifecycle: enqueue() creates the job (status "queued"), fires the carrier
 * fan-out in the background without awaiting it, and returns the queued
 * snapshot. onComplete callbacks fire once when the job finishes.
 *
 * This is the original v0.2.0 in-memory behavior, moved behind the JobQueue
 * interface in v0.9.0. Jobs are lost on process restart — that is the
 * documented trade-off; set REDIS_URL for the BullMQ backend.
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
import { finishJob, publicJobView, runCarrierFanout } from "./jobExecutor.js";
import type { JobQueue, NotifyDisposition } from "./queue.js";
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

interface JobInternal {
  job: QuoteJob;
  request: QuoteRequest;
  email: string;
  emailOptIn: boolean;
  /** TCPA marketing-call/text consent flag, persisted for audit (boolean only). */
  phoneOptIn: boolean;
  pendingNotifyEmails: Set<string>;
  completionCallbacks: Array<(job: QuoteJob) => void>;
}

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

export class MemoryQueue implements JobQueue {
  private readonly jobs = new Map<string, JobInternal>();

  async enqueue(request: QuoteRequest): Promise<QuoteJob> {
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
        // 2-letter state code (non-PII) — drives the state disclosure panel.
        state: request.contact.state,
        cached: false,
      },
      request,
      email: request.contact.email,
      emailOptIn: request.emailOptIn ?? true,
      phoneOptIn: request.phoneOptIn ?? false,
      pendingNotifyEmails: new Set(),
      completionCallbacks: [],
    };
    this.jobs.set(jobId, internal);

    track({ event: "quote_requested", page: "/quote", sessionId: jobId, metadata: { carrierCount: adapters.length } });
    // Consent booleans only — never PII (CONTEXT.md rule 5).
    logger.info({
      msg: "quote_job_created",
      jobId,
      carrierCount: adapters.length,
      state: request.contact.state,
      emailOptIn: internal.emailOptIn,
      phoneOptIn: internal.phoneOptIn,
    });

    // Snapshot the "queued" response BEFORE kicking off background processing.
    const response = publicJobView(internal.job);

    // Fire-and-forget: the HTTP response (202) is already on its way.
    void this.processJob(jobId, adapters);
    return response;
  }

  async getJob(jobId: string): Promise<QuoteJob | undefined> {
    const internal = this.jobs.get(jobId);
    return internal ? publicJobView(internal.job) : undefined;
  }

  async getJobRequest(jobId: string): Promise<QuoteRequest | undefined> {
    return this.jobs.get(jobId)?.request;
  }

  onComplete(jobId: string, cb: (job: QuoteJob) => void): void {
    const internal = this.jobs.get(jobId);
    if (!internal) return;
    if (internal.job.status === "complete") {
      cb(publicJobView(internal.job));
      return;
    }
    internal.completionCallbacks.push(cb);
  }

  async requestNotifyOnComplete(jobId: string, email: string): Promise<NotifyDisposition> {
    const internal = this.jobs.get(jobId);
    if (!internal) return "not-found";
    if (internal.job.status === "complete") return "send-now";
    internal.pendingNotifyEmails.add(email);
    return "queued";
  }

  async close(): Promise<void> {
    // Nothing to release for the in-memory backend.
  }

  private async processJob(jobId: string, adapters: QuoteAdapter[]): Promise<void> {
    const internal = this.jobs.get(jobId);
    if (!internal) return;
    internal.job.status = "running";

    // Results stream in completion order so pollers see live progress,
    // exactly like the pre-v0.9.0 behavior.
    await runCarrierFanout(
      internal.request,
      adapters,
      (completed, result) => {
        internal.job.progress.completed = completed;
        internal.job.results.push(result);
      },
    );
    const results = internal.job.results;

    await finishJob(jobId, results, {
      email: internal.email,
      emailOptIn: internal.emailOptIn,
      phoneOptIn: internal.phoneOptIn,
      pendingNotifyEmails: [...internal.pendingNotifyEmails],
    });

    internal.job.status = "complete";
    internal.job.completedAt = new Date().toISOString();

    const view = publicJobView(internal.job);
    for (const cb of internal.completionCallbacks.splice(0)) {
      try {
        cb(view);
      } catch (err) {
        logger.warn({ msg: "job_completion_callback_failed", jobId, reason: (err as Error).message });
      }
    }
  }

  /** Test hook: clear all jobs. */
  _reset(): void {
    this.jobs.clear();
  }
}
