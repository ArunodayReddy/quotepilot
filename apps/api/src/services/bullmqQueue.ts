/**
 * BullMQQueue — the Redis-backed JobQueue (v0.9.0 scaling).
 *
 * Active only when REDIS_URL is set. Job state lives in Redis hashes
 * (`qp:job:<id>`, 24h TTL), so jobs survive API restarts and ANY instance in
 * a fleet can serve GET /api/quotes/:jobId. A BullMQ worker in this process
 * runs the shared jobExecutor logic (concurrency 10); at larger scale the
 * worker can move to dedicated processes without code changes.
 *
 * bullmq/ioredis are dynamically imported — never loaded in laptop dev.
 */
import { randomUUID } from "node:crypto";
import type { Queue, QueueEvents, Worker } from "bullmq";
import type { Redis } from "ioredis";
import type {
  QuoteJob,
  QuoteRequest,
  QuoteResult,
} from "../../../../packages/shared/dist/types.js";
import { logger } from "../lib/logger.js";
import { track } from "./analyticsService.js";
import { finishJob, publicJobView, runCarrierFanout } from "./jobExecutor.js";
import { adaptersForState } from "./memoryQueue.js";
import type { JobQueue, NotifyDisposition } from "./queue.js";

const QUEUE_NAME = "quotepilot-quotes";
const JOB_KEY_PREFIX = "qp:job:";
const NOTIFY_SUFFIX = ":notifyEmails";
const JOB_TTL_SECONDS = 24 * 60 * 60; // bound Redis memory: job state lives 24h

interface JobPayload {
  jobId: string;
}

interface LazyBullMQ {
  queue: Queue<JobPayload>;
  worker: Worker<JobPayload>;
  events: QueueEvents;
  connection: Redis;
}

export class BullMQQueue implements JobQueue {
  private readonly redisUrl: string;
  private lazy: Promise<LazyBullMQ> | null = null;

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
  }

  private init(): Promise<LazyBullMQ> {
    if (this.lazy) return this.lazy;
    this.lazy = (async (): Promise<LazyBullMQ> => {
      const [{ Queue, Worker, QueueEvents }, { Redis: RedisCtor }] = await Promise.all([
        import("bullmq"),
        import("ioredis"),
      ]);
      const connection: Redis = new RedisCtor(this.redisUrl, { maxRetriesPerRequest: null });
      connection.on("error", (err: Error) => logger.warn({ msg: "redis_error", reason: err.message }));

      const queue = new Queue<JobPayload>(QUEUE_NAME, { connection: connection as never });
      const events = new QueueEvents(QUEUE_NAME, { connection: connection as never });
      await events.waitUntilReady();

      const worker = new Worker<JobPayload>(
        QUEUE_NAME,
        async (job) => this.processJob(job.data.jobId, job),
        { connection: connection as never, concurrency: 10 },
      );
      worker.on("failed", (job, err) => {
        logger.warn({ msg: "quote_job_failed", jobId: job?.data.jobId, reason: err.message });
      });

      logger.info({ msg: "bullmq_worker_started", queue: QUEUE_NAME });
      return { queue, worker, events, connection };
    })();
    return this.lazy;
  }

  private jobKey(jobId: string): string {
    return `${JOB_KEY_PREFIX}${jobId}`;
  }

  async enqueue(request: QuoteRequest): Promise<QuoteJob> {
    const { queue, connection } = await this.init();
    const adapters = adaptersForState(request.contact.state);
    const jobId = randomUUID();
    const createdAt = new Date().toISOString();
    const snapshot: QuoteJob = {
      jobId,
      status: "queued",
      progress: { completed: 0, total: adapters.length },
      results: [],
      carrierCount: adapters.length,
      estimatedSeconds: 3,
      createdAt,
      state: request.contact.state,
      cached: false,
    };

    const key = this.jobKey(jobId);
    await connection.hset(key, {
      status: "queued",
      progressJson: JSON.stringify(snapshot.progress),
      resultsJson: "[]",
      carrierCount: String(adapters.length),
      estimatedSeconds: "3",
      createdAt,
      completedAt: "",
      state: request.contact.state,
      requestJson: JSON.stringify(request),
      notifyJson: JSON.stringify({
        email: request.contact.email,
        emailOptIn: request.emailOptIn ?? true,
        phoneOptIn: request.phoneOptIn ?? false,
      }),
    });
    await connection.expire(key, JOB_TTL_SECONDS);
    await connection.del(key + NOTIFY_SUFFIX);

    await queue.add("quote", { jobId }, {
      jobId,
      attempts: 2,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 200,
      removeOnFail: 200,
    });

    track({ event: "quote_requested", page: "/quote", sessionId: jobId, metadata: { carrierCount: adapters.length } });
    logger.info({
      msg: "quote_job_created",
      jobId,
      carrierCount: adapters.length,
      state: request.contact.state,
      backend: "bullmq",
    });
    return snapshot;
  }

  async getJob(jobId: string): Promise<QuoteJob | undefined> {
    const { connection } = await this.init();
    const h = await connection.hgetall(this.jobKey(jobId));
    if (!h || !h.status) return undefined;
    return publicJobView({
      jobId,
      status: h.status as QuoteJob["status"],
      progress: JSON.parse(h.progressJson || '{"completed":0,"total":0}'),
      results: JSON.parse(h.resultsJson || "[]") as QuoteResult[],
      carrierCount: Number(h.carrierCount || 0),
      estimatedSeconds: Number(h.estimatedSeconds || 3),
      createdAt: h.createdAt,
      completedAt: h.completedAt || undefined,
      state: h.state || "",
      cached: false,
    });
  }

  onComplete(jobId: string, cb: (job: QuoteJob) => void): void {
    void (async () => {
      const already = await this.getJob(jobId);
      if (already && already.status === "complete") {
        cb(already);
        return;
      }
      const { events } = await this.init();
      const handler = async ({ jobId: doneId }: { jobId: string }) => {
        if (doneId !== jobId) return;
        await events.off("completed", handler);
        const job = await this.getJob(jobId);
        if (job) cb(job);
      };
      await events.on("completed", handler);
    })().catch((err: Error) => {
      logger.warn({ msg: "bullmq_oncomplete_failed", jobId, reason: err.message });
    });
  }

  async requestNotifyOnComplete(jobId: string, email: string): Promise<NotifyDisposition> {
    const { connection } = await this.init();
    const key = this.jobKey(jobId);
    const status = await connection.hget(key, "status");
    if (!status) return "not-found";
    if (status === "complete") return "send-now";
    await connection.sadd(key + NOTIFY_SUFFIX, email);
    return "queued";
  }

  async close(): Promise<void> {
    if (!this.lazy) return;
    const { worker, events, queue, connection } = await this.lazy;
    await Promise.all([
      worker.close().catch(() => undefined),
      events.close().catch(() => undefined),
      queue.close().catch(() => undefined),
    ]);
    await connection.quit().catch(() => undefined);
    this.lazy = null;
  }

  private async processJob(
    jobId: string,
    bullJob: { updateProgress: (p: { completed: number; total: number }) => Promise<void> },
  ): Promise<void> {
    const { connection } = await this.init();
    const key = this.jobKey(jobId);
    const requestJson = await connection.hget(key, "requestJson");
    const notifyJson = await connection.hget(key, "notifyJson");
    if (!requestJson) throw new Error(`job payload missing for ${jobId}`);
    const request = JSON.parse(requestJson) as QuoteRequest;
    const notifyBase = JSON.parse(notifyJson || "{}") as { email: string; emailOptIn: boolean; phoneOptIn: boolean };

    const adapters = adaptersForState(request.contact.state);
    await connection.hset(key, "status", "running");

    const results: QuoteResult[] = [];
    await runCarrierFanout(request, adapters, (completed, result) => {
      results.push(result);
      const progress = { completed, total: adapters.length };
      void connection.hset(key, "progressJson", JSON.stringify(progress));
      void bullJob.updateProgress(progress).catch(() => undefined);
    });

    const pendingNotifyEmails = await connection.smembers(key + NOTIFY_SUFFIX);
    await finishJob(jobId, results, {
      email: notifyBase.email,
      emailOptIn: notifyBase.emailOptIn ?? true,
      phoneOptIn: notifyBase.phoneOptIn ?? false,
      pendingNotifyEmails,
    });

    await connection.hset(key, {
      status: "complete",
      progressJson: JSON.stringify({ completed: adapters.length, total: adapters.length }),
      resultsJson: JSON.stringify(results),
      completedAt: new Date().toISOString(),
    });
    await connection.expire(key, JOB_TTL_SECONDS);
  }
}
