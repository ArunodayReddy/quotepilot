/**
 * Route contract tests against the full Express stack (supertest, no port).
 *
 * Covers: POST /api/quote → 202 + jobId; GET /api/quotes/:jobId polls to
 * complete with 6 results; agents directory; validation 400s; unknown job
 * 404; analytics event ingest + summary; email notify.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { _resetJobs } from "../src/services/jobQueue.js";
import { _resetDb, getDb } from "../src/services/analyticsService.js";

const here = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(here, "..", "..", "..", "data", "sample", "profile.sample.json");
const sampleProfile = JSON.parse(readFileSync(samplePath, "utf8")) as Record<string, unknown>;
// Drop the wizard-only annotation key; the API strips unknown keys anyway.
const { expectedQuoteBand6Mo: _drop, _note: _note2, ...quoteBody } = sampleProfile;

const app = createApp();

beforeEach(() => {
  _resetJobs();
  _resetDb();
});

afterEach(() => {
  _resetJobs();
  _resetDb();
});

async function createJob(body: unknown = quoteBody): Promise<string> {
  const res = await request(app).post("/api/quote").send(body);
  expect(res.status).toBe(202);
  expect(res.body.jobId).toBeDefined();
  expect(res.body.status).toBe("queued");
  expect(res.body.carrierCount).toBe(6);
  return res.body.jobId as string;
}

async function waitForComplete(jobId: string, timeoutMs = 15000): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await request(app).get(`/api/quotes/${jobId}`);
    expect(res.status).toBe(200);
    if (res.body.status === "complete") return res.body;
    if (Date.now() > deadline) throw new Error(`job ${jobId} did not complete in time`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

describe("quote routes", () => {
  it("GET /api/health returns ok + version", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", version: "0.2.0" });
  });

  it("POST /api/quote → 202, then GET /api/quotes/:jobId completes with 6 results", async () => {
    const jobId = await createJob();
    const job = (await waitForComplete(jobId)) as {
      status: string;
      progress: { completed: number; total: number };
      results: Array<{ success: boolean; premium6Mo: number; simulated: boolean }>;
    };
    expect(job.status).toBe("complete");
    expect(job.progress).toEqual({ completed: 6, total: 6 });
    expect(job.results).toHaveLength(6);
    for (const r of job.results) {
      expect(r.success).toBe(true);
      expect(r.simulated).toBe(true);
      expect(r.premium6Mo).toBeGreaterThanOrEqual(1100);
      expect(r.premium6Mo).toBeLessThanOrEqual(1900);
    }
    // The public job view must not leak PII-bearing fields.
    expect(job).not.toHaveProperty("request");
    expect(JSON.stringify(job)).not.toContain("driver@example.com");
  });

  it("POST /api/quote with an invalid body → 400 VALIDATION_ERROR", async () => {
    const res = await request(app).post("/api/quote").send({ contact: { state: "XX" } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.requestId).toBeDefined();
  });

  it("POST /api/quote with a bad email → 400", async () => {
    const bad = { ...quoteBody, contact: { ...(quoteBody.contact as object), email: "not-an-email" } };
    const res = await request(app).post("/api/quote").send(bad);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/quotes/:jobId for an unknown job → 404", async () => {
    const res = await request(app).get("/api/quotes/123e4567-e89b-12d3-a456-426614174000");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("unknown routes → 404", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("agents routes", () => {
  it("GET /api/agents?state=MA returns 8 sample agents", async () => {
    const res = await request(app).get("/api/agents?state=MA&zip=02139");
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("MA");
    expect(res.body.zip).toBe("02139");
    expect(res.body.agents).toHaveLength(8);
    for (const a of res.body.agents) {
      expect(a.sample).toBe(true);
      expect(a.phone).toMatch(/^555-010-/);
      expect(a.source).toBe("sample");
    }
  });

  it("known ZIP → geocoded:true, sorted by distance, Cambridge first for 02139", async () => {
    const res = await request(app).get("/api/agents?state=MA&zip=02139");
    expect(res.status).toBe(200);
    expect(res.body.geocoded).toBe(true);
    const agents = res.body.agents as { city: string; distance_mi: number }[];
    expect(agents[0].city).toBe("Cambridge");
    expect(agents[0].distance_mi).toBe(0);
    const dists = agents.map((a) => a.distance_mi);
    expect([...dists].sort((x, y) => x - y)).toEqual(dists);
    for (const a of agents) {
      expect(a.distance_mi).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(a.distance_mi * 10)).toBe(true); // 1-decimal
    }
  });

  it("unknown ZIP → 200, geocoded:false, unsorted sample list + note", async () => {
    const res = await request(app).get("/api/agents?state=MA&zip=99999");
    expect(res.status).toBe(200);
    expect(res.body.geocoded).toBe(false);
    expect(res.body.note).toMatch(/isn't in our demo geocoder/);
    expect(res.body.agents).toHaveLength(8);
    for (const a of res.body.agents) {
      expect(a.distance_mi).toBeNull();
      expect(a.source).toBe("sample");
    }
  });

  it("unknown state → 200 with empty agents", async () => {
    const res = await request(app).get("/api/agents?state=ZZ");
    expect(res.status).toBe(200);
    expect(res.body.agents).toEqual([]);
  });

  it("bad state code → 400", async () => {
    const res = await request(app).get("/api/agents?state=Mass");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("carriers routes", () => {
  it("GET /api/carriers?state=MA returns the registry with channel info", async () => {
    const res = await request(app).get("/api/carriers?state=MA");
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("MA");
    expect(res.body.carriers.length).toBeGreaterThanOrEqual(6);
    const ids = res.body.carriers.map((c: { id: string }) => c.id);
    expect(ids).toContain("geico");
    expect(ids).toContain("allstate");
    for (const c of res.body.carriers as Array<Record<string, unknown>>) {
      expect(typeof c.id).toBe("string");
      expect(typeof c.name).toBe("string");
      expect(["direct", "agent"]).toContain(c.channel);
      expect(typeof c.quotable).toBe("boolean");
    }
    expect(res.body).not.toHaveProperty("note");
  });

  it("unknown state → 200 with empty carriers + note", async () => {
    const res = await request(app).get("/api/carriers?state=ZZ");
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("ZZ");
    expect(res.body.carriers).toEqual([]);
    expect(typeof res.body.note).toBe("string");
  });

  it("bad state code → 400", async () => {
    const res = await request(app).get("/api/carriers?state=Mass");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("analytics routes", () => {
  it("POST /api/analytics/event → 201 and stores a hashed session", async () => {
    const res = await request(app).post("/api/analytics/event").send({
      event: "click",
      page: "/quotes",
      element: "compare-button",
      sessionId: "sess-abc-123",
      metadata: { carrierId: "geico" },
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });

    const rows = getDb().prepare("SELECT * FROM events").all() as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    // Raw sessionId never stored.
    expect(JSON.stringify(rows[0])).not.toContain("sess-abc-123");
    expect(rows[0].session_hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("metadata containing an email-like pattern is dropped, event kept", async () => {
    const res = await request(app).post("/api/analytics/event").send({
      event: "click",
      page: "/quote",
      sessionId: "sess-pii",
      metadata: { note: "contact me at somebody@example.com please" },
    });
    expect(res.status).toBe(201);
    const rows = getDb().prepare("SELECT * FROM events").all() as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0].metadata).toBeNull();
    expect(JSON.stringify(rows[0])).not.toContain("somebody@example.com");
  });

  it("GET /api/analytics/summary aggregates clicks, funnel, carriers, sessions", async () => {
    // Seed via the real quote flow so carrier/funnel rows exist end-to-end.
    const jobId = await createJob();
    await waitForComplete(jobId);
    await request(app).post("/api/analytics/event").send({
      event: "click",
      page: "/quotes",
      element: "compare-button",
      sessionId: "sess-1",
    });
    await request(app).post("/api/analytics/event").send({
      event: "click",
      page: "/quotes",
      element: "compare-button",
      sessionId: "sess-2",
    });

    const res = await request(app).get("/api/analytics/summary");
    expect(res.status).toBe(200);
    const s = res.body as {
      clicksByElement: Array<{ element: string; page: string; count: number }>;
      funnel: Array<{ step: string; completed: boolean; count: number }>;
      carriers: Array<{ carrierId: string; quotes: number; avgLatencyMs: number; winRate: number }>;
      dailySessions: Array<{ date: string; sessions: number }>;
    };
    expect(s.clicksByElement).toEqual([{ element: "compare-button", page: "/quotes", count: 2 }]);
    expect(s.funnel.map((f) => f.step)).toEqual(["quote_requested", "quotes_completed", "email_sent"]);
    const req = s.funnel.find((f) => f.step === "quote_requested");
    expect(req?.completed).toBe(true);
    expect(req?.count).toBeGreaterThanOrEqual(1);
    expect(s.carriers).toHaveLength(6);
    for (const c of s.carriers) {
      expect(c.quotes).toBeGreaterThanOrEqual(1);
      expect(c.avgLatencyMs).toBeGreaterThanOrEqual(0);
      expect(c.winRate).toBeGreaterThanOrEqual(0);
      expect(c.winRate).toBeLessThanOrEqual(1);
    }
    // Exactly one carrier holds rank 1 → exactly one win recorded.
    expect(s.carriers.reduce((n, c) => n + Math.round(c.winRate * c.quotes), 0)).toBe(1);
    expect(s.dailySessions.length).toBeGreaterThanOrEqual(1);
    expect(s.dailySessions[0].sessions).toBeGreaterThanOrEqual(1);
  });
});

describe("email routes", () => {
  it("POST /api/email/notify → 202 for a live job, 404 for unknown", async () => {
    const jobId = await createJob();
    const ok = await request(app).post("/api/email/notify").send({ jobId, email: "driver@example.com" });
    expect(ok.status).toBe(202);
    expect(ok.body).toEqual({ ok: true });

    const missing = await request(app)
      .post("/api/email/notify")
      .send({ jobId: "123e4567-e89b-12d3-a456-426614174000", email: "driver@example.com" });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");
  });

  it("POST /api/email/notify with a bad email → 400", async () => {
    const jobId = await createJob();
    const res = await request(app).post("/api/email/notify").send({ jobId, email: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
