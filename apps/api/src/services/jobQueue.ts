/**
 * Quote job public API (v0.9.0 scaling).
 *
 * This module is the seam the routes talk to. It wires three pieces:
 *   1. The quote-result cache (quoteCache.ts) — identical rating factors hit
 *      the cache and return a terminal "complete" job with `cached: true`.
 *   2. The JobQueue backend (queue.ts) — MemoryQueue by default, BullMQ when
 *      REDIS_URL is set.
 *   3. Cache population — every completed job's results are stored under the
 *      request's cache key (rating factors only, never PII).
 *
 * adaptersForState is re-exported here (it lives in memoryQueue.ts) because
 * registry.test.ts imports it from this module.
 */
import type { QuoteJob, QuoteRequest } from "../../../../packages/shared/dist/types.js";
import { logger } from "../lib/logger.js";
import { getJobQueue, _resetJobQueue, type NotifyDisposition } from "./queue.js";
import {
  getQuoteCache,
  quoteCacheKey,
  quoteCacheTtlSeconds,
  _resetQuoteCache,
} from "./quoteCache.js";
import { adaptersForState } from "./memoryQueue.js";

export { adaptersForState };

/**
 * Create a quote job. On a cache hit this returns a terminal "complete" job
 * (HTTP 200 upstream) instead of fanning out to carriers.
 */
export async function createQuoteJob(request: QuoteRequest): Promise<QuoteJob> {
  const cache = getQuoteCache();
  const key = quoteCacheKey(request);

  const hit = await cache.get(key);
  if (hit) {
    logger.info({ msg: "quote_cache_hit", state: request.contact.state });
    const now = new Date().toISOString();
    return {
      jobId: `cached-${key.slice(-12)}`,
      status: "complete",
      progress: { completed: hit.length, total: hit.length },
      results: hit,
      carrierCount: hit.length,
      estimatedSeconds: 0,
      createdAt: now,
      completedAt: now,
      state: request.contact.state,
      cached: true,
    };
  }

  const queue = await getJobQueue();
  const job = await queue.enqueue(request);

  // Populate the cache when this job completes (both backends fire onComplete).
  queue.onComplete(job.jobId, (completed) => {
    if (completed.status === "complete" && completed.results.length > 0) {
      void cache
        .set(key, completed.results, quoteCacheTtlSeconds())
        .catch((err: Error) => logger.warn({ msg: "quote_cache_store_failed", reason: err.message }));
    }
  });

  return { ...job, cached: false };
}

export async function getQuoteJob(jobId: string): Promise<QuoteJob | undefined> {
  const queue = await getJobQueue();
  return queue.getJob(jobId);
}

/**
 * Called by POST /api/email/notify. Returns "send-now" when the job already
 * completed (caller should send immediately), "queued" when the address was
 * parked for completion, "not-found" for unknown jobs.
 */
export async function requestNotifyOnComplete(
  jobId: string,
  email: string,
): Promise<NotifyDisposition> {
  const queue = await getJobQueue();
  return queue.requestNotifyOnComplete(jobId, email);
}

/** Test hook: clear all jobs (memory backend) and the quote cache. */
export async function _resetJobs(): Promise<void> {
  await _resetJobQueue();
  _resetQuoteCache();
  // Re-create the memory queue eagerly so subsequent calls don't pay for
  // lazy re-selection inside a test.
  await getJobQueue();
}

// Re-exported for tests that poke the internals.
export { _resetQuoteCache };
