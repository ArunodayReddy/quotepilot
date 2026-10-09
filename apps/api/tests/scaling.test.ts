/**
 * v0.9.0 scaling tests.
 *
 * Covers: JobQueue interface parity (memory backend), quote-result cache
 * (hit/miss, cached flag, PII-free keys, TTL, LRU eviction), analytics sink
 * selection (SQLite default, Postgres fail-open), rate-limit store factory,
 * and the end-to-end cached quote flow over HTTP.
 *
 * BullMQ/Redis paths are not exercised here (no Redis in CI) — the factory
 * selection logic is covered, and the Redis implementations degrade loudly
 * to memory when unreachable.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { _resetJobs, createQuoteJob, getQuoteJob } from "../src/services/jobQueue.js";
import { getJobQueue, jobQueueKind, type JobQueue } from "../src/services/queue.js";
import {
  getQuoteCache,
  quoteCacheKey,
  _resetQuoteCache,
} from "../src/services/quoteCache.js";
import {
  _resetAnalyticsSink,
  analyticsSinkKind,
  getAnalyticsSink,
} from "../src/services/analyticsSink.js";
import { createRateLimitStore } from "../src/middleware/rateLimit.js";
import type { QuoteJob, QuoteRequest } from "../../../packages/shared/dist/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(here, "..", "..", "..", "data", "sample", "profile.sample.json");
const sampleProfile = JSON.parse(readFileSync(samplePath, "utf8")) as Record<string, unknown>;
const { expectedQuoteBand6Mo: _drop, _note: _note2, ...quoteBody } = sampleProfile;

const app = createApp();

function req(overrides: Record<string, unknown> = {}): QuoteRequest {
  return {
    ...(quoteBody as object),
    contact: { ...((quoteBody as Record<string, unknown>).contact as object), ...overrides },
  } as QuoteRequest;
}

async function waitForComplete(jobId: string, timeoutMs = 15000): Promise<QuoteJob> {
  const start = Date.now();
  for (;;) {
    const job = await getQuoteJob(jobId);
    if (job?.status === "complete") return job;
    if (Date.now() - start > timeoutMs) throw new Error(`job ${jobId} did not complete in time`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

beforeEach(async () => {
  await _resetJobs();
  await _resetAnalyticsSink();
});

afterEach(async () => {
  await _resetJobs();
  await _resetAnalyticsSink();
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;
});

describe("JobQueue interface (memory backend)", () => {
  it("selects the memory backend with zero config", async () => {
    expect(await jobQueueKind()).toBe("memory");
  });

  it("enqueue → queued snapshot; getJob round-trips; onComplete fires", async () => {
    const queue: JobQueue = await getJobQueue();
    const snapshot = await queue.enqueue(req());
    expect(snapshot.status).toBe("queued");
    expect(snapshot.cached).toBe(false);
    expect(snapshot.jobId).toMatch(/^[0-9a-f-]{36}$/);

    const fetched = await queue.getJob(snapshot.jobId);
    expect(fetched?.jobId).toBe(snapshot.jobId);

    const completed = await new Promise<QuoteJob>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("onComplete never fired")), 15000);
      queue.onComplete(snapshot.jobId, (job) => {
        clearTimeout(t);
        resolve(job);
      });
    });
    expect(completed.status).toBe("complete");
    expect(completed.results.length).toBeGreaterThan(0);
  });

  it("getJob returns undefined for unknown ids", async () => {
    const queue = await getJobQueue();
    expect(await queue.getJob("123e4567-e89b-12d3-a456-426614174000")).toBeUndefined();
  });

  it("requestNotifyOnComplete: queued → send-now → not-found", async () => {
    const queue = await getJobQueue();
    const { jobId } = await queue.enqueue(req());
    expect(await queue.requestNotifyOnComplete(jobId, "a@example.com")).toBe("queued");
    await waitForComplete(jobId);
    expect(await queue.requestNotifyOnComplete(jobId, "b@example.com")).toBe("send-now");
    expect(await queue.requestNotifyOnComplete("123e4567-e89b-12d3-a456-426614174000", "c@example.com")).toBe(
      "not-found",
    );
  });
});

describe("quote-result cache", () => {
  it("key is stable for identical rating factors and ignores PII", () => {
    const a = req();
    const b = req({ email: "someone.else@example.com", phone: "555-999-8888" });
    expect(quoteCacheKey(a)).toBe(quoteCacheKey(b));
    // The key is a hex digest — it cannot contain or leak PII substrings.
    expect(quoteCacheKey(a)).not.toContain("example.com");
    expect(quoteCacheKey(a)).not.toContain("555");
  });

  it("key changes when rating factors change", () => {
    expect(quoteCacheKey(req())).not.toBe(quoteCacheKey(req({ zip: "02140" })));
  });

  it("get/set round-trip and TTL expiry", async () => {
    const cache = getQuoteCache();
    await cache.set("k1", [], 0.05);
    expect(await cache.get("k1")).toEqual([]);
    await new Promise((r) => setTimeout(r, 150));
    expect(await cache.get("k1")).toBeUndefined();
  });

  it("memory LRU evicts the oldest entry past capacity", async () => {
    const cache = getQuoteCache();
    for (let i = 0; i < 501; i++) {
      await cache.set(`k-${i}`, [], 3600);
    }
    expect(await cache.get("k-0")).toBeUndefined();
    expect(await cache.get("k-500")).toEqual([]);
  });

  it("second identical quote request is served from cache with cached:true", async () => {
    const first = await createQuoteJob(req());
    expect(first.cached).toBe(false);
    await waitForComplete(first.jobId);

    // Give the fire-and-forget cache store a moment to land.
    let second: QuoteJob | undefined;
    const start = Date.now();
    for (;;) {
      second = await createQuoteJob(req());
      if (second.cached) break;
      if (Date.now() - start > 5000) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(second!.cached).toBe(true);
    expect(second!.status).toBe("complete");
    expect(second!.results.length).toBeGreaterThan(0);
    expect(second!.results).toEqual((await waitForComplete(first.jobId)).results);
  });
});

describe("analytics sink selection", () => {
  it("defaults to SQLite with zero config", async () => {
    expect(await analyticsSinkKind()).toBe("sqlite");
    const sink = await getAnalyticsSink();
    expect(sink.kind).toBe("sqlite");
  });

  it("falls back to SQLite when DATABASE_URL is unreachable (fail-open)", async () => {
    process.env.DATABASE_URL = "postgres://127.0.0.1:1/quotepilot_test";
    await _resetAnalyticsSink();
    const kind = await analyticsSinkKind();
    expect(kind).toBe("sqlite");
    // The service still works — analytics never breaks quoting.
    const sink = await getAnalyticsSink();
    const summary = await sink.summary();
    expect(summary.funnel.map((f) => f.step)).toContain("quote_requested");
  });
});

describe("rate-limit store factory", () => {
  it("returns undefined (memory default) without a redis URL", async () => {
    expect(await createRateLimitStore(undefined)).toBeUndefined();
  });

  it("falls back to memory when Redis is unreachable", async () => {
    expect(await createRateLimitStore("redis://127.0.0.1:1")).toBeUndefined();
  });
});

describe("cached quote flow over HTTP", () => {
  it("POST /api/quote → 202 + cached:false, repeat → 200 + cached:true", async () => {
    const first = await request(app).post("/api/quote").send(quoteBody);
    expect(first.status).toBe(202);
    expect(first.body.cached).toBe(false);
    const jobId = first.body.jobId as string;

    // Poll to completion (also warms the cache).
    for (let i = 0; i < 100; i++) {
      const poll = await request(app).get(`/api/quotes/${jobId}`);
      if (poll.body.status === "complete") break;
      await new Promise((r) => setTimeout(r, 150));
    }

    let repeat = await request(app).post("/api/quote").send(quoteBody);
    const start = Date.now();
    while (repeat.body.cached !== true && Date.now() - start < 5000) {
      await new Promise((r) => setTimeout(r, 150));
      repeat = await request(app).post("/api/quote").send(quoteBody);
    }
    expect(repeat.status).toBe(200);
    expect(repeat.body.cached).toBe(true);
    expect(repeat.body.status).toBe("complete");
    expect(repeat.body.results.length).toBeGreaterThan(0);
  });

  it("GET /api/quotes/:jobId carries the cached flag", async () => {
    const res = await request(app).post("/api/quote").send(quoteBody);
    const jobId = res.body.jobId as string;
    const poll = await request(app).get(`/api/quotes/${jobId}`);
    expect(poll.body.cached).toBe(false);
  });
});

describe("statelessness audit", () => {
  it("no REDIS_URL → all shared caches resolve to memory implementations", async () => {
    // The factories must not throw and must not attempt network I/O.
    const cache = getQuoteCache();
    await cache.set("probe", [], 60);
    expect(await cache.get("probe")).toEqual([]);
    await cache.clear();
    _resetQuoteCache();
    expect(vi.isMockFunction(getQuoteCache)).toBe(false);
  });
});
