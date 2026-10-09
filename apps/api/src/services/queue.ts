/**
 * JobQueue abstraction (v0.9.0 scaling).
 *
 * MemoryQueue is the default (laptop dev, single instance, zero config).
 * BullMQQueue is selected when REDIS_URL is set — jobs survive API restarts
 * and any instance in a fleet can serve GET /api/quotes/:jobId.
 *
 * The interface is deliberately narrow so a future SQS/Cloud-Tasks backend
 * could slot in without touching the routes. Implementations are loaded with
 * dynamic import so `bullmq`/`ioredis` are never loaded in laptop dev.
 */
import type { QuoteJob, QuoteRequest } from "../../../../packages/shared/dist/types.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

export type NotifyDisposition = "send-now" | "queued" | "not-found";

export interface JobQueue {
  /** Create a job, kick off background processing, return the "queued" snapshot. */
  enqueue(request: QuoteRequest): Promise<QuoteJob>;
  /** Public job view, or undefined for unknown ids. */
  getJob(jobId: string): Promise<QuoteJob | undefined>;
  /** Register a one-shot callback fired when this job completes. */
  onComplete(jobId: string, cb: (job: QuoteJob) => void): void;
  /**
   * Park an email address for the completion notification. "send-now" when
   * the job is already complete (caller sends immediately), "queued" when
   * parked, "not-found" for unknown jobs.
   */
  requestNotifyOnComplete(jobId: string, email: string): Promise<NotifyDisposition>;
  /** Release resources (Redis connections, workers). No-op for memory. */
  close(): Promise<void>;
}

let active: JobQueue | null = null;
let activeKind: "memory" | "bullmq" | null = null;

export async function getJobQueue(): Promise<JobQueue> {
  if (active) return active;
  if (config.redisUrl) {
    const { BullMQQueue } = await import("./bullmqQueue.js");
    active = new BullMQQueue(config.redisUrl);
    activeKind = "bullmq";
    logger.info({ msg: "job_queue_selected", kind: "bullmq" });
  } else {
    const { MemoryQueue } = await import("./memoryQueue.js");
    active = new MemoryQueue();
    activeKind = "memory";
    logger.info({ msg: "job_queue_selected", kind: "memory" });
  }
  return active;
}

/** Which backend is active (for /api/health and tests). */
export async function jobQueueKind(): Promise<"memory" | "bullmq"> {
  await getJobQueue();
  return activeKind ?? "memory";
}

/** Test hook: drop the cached queue so tests can re-select. */
export async function _resetJobQueue(): Promise<void> {
  if (active) {
    await active.close().catch(() => undefined);
    active = null;
    activeKind = null;
  }
}
