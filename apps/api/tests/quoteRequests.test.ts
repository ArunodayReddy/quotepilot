/**
 * Agent-mediated quote requests (v0.11.0 "Real quotes").
 *
 * Covers: TCPA consent enforcement, agent-count limits, unknown job/agent
 * handling, the delivery provider chain (emailed vs handoff), user receipts,
 * ref-code format, the 5/hour rate limit, and the no-raw-PII-in-logs rule.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { _resetJobs } from "../src/services/jobQueue.js";
import { _resetDb } from "../src/services/analyticsService.js";
import { logger } from "../src/lib/logger.js";
import { quoteRequestLimiter } from "../src/middleware/rateLimit.js";
import { ipKeyGenerator } from "express-rate-limit";
import type { AgentWithDistance } from "../../../packages/shared/dist/types.js";

// Transport layer mocked: capture outbound mail without sending anything.
// sendQuotesReady is stubbed too — job completion calls it (emailOptIn
// defaults true) and the mock must not break that path.
const sendMailMock = vi.fn(async () => ({ sent: true, mode: "smtp" as const }));
vi.mock("../src/services/emailService.js", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
  sendQuotesReady: vi.fn(async () => ({ sent: true, mode: "smtp" as const })),
}));

const here = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(here, "..", "..", "..", "data", "sample", "profile.sample.json");
const sampleProfile = JSON.parse(readFileSync(samplePath, "utf8")) as Record<string, unknown>;
const { expectedQuoteBand6Mo: _drop, _note: _note2, ...quoteBody } = sampleProfile;

const app = createApp();

const CONTACT = { name: "Test Driver", email: "driver@example.com", phone: "555-010-0199" };

function sampleAgent(id: string, overrides: Partial<AgentWithDistance> = {}): AgentWithDistance {
  return {
    id,
    name: `Sample Agent — ${id}`,
    address: "123 Sample St",
    city: "Cambridge",
    zip: "02139",
    phone: "555-010-0102",
    lat: 42.3647,
    lng: -71.1042,
    hours: { weekdays: "9–5", saturday: "Closed", sunday: "Closed" },
    carriers: ["hanover"],
    languages: ["English"],
    sample: true,
    distance_mi: 1.2,
    source: "sample",
    ...overrides,
  } as AgentWithDistance;
}

async function createCompletedJob(body: unknown = quoteBody): Promise<string> {
  const res = await request(app).post("/api/quote").send(body);
  expect(res.status).toBe(202);
  const jobId = res.body.jobId as string;
  const deadline = Date.now() + 20000;
  for (;;) {
    const poll = await request(app).get(`/api/quotes/${jobId}`);
    expect(poll.status).toBe(200);
    if (poll.body.status === "complete") return jobId;
    if (Date.now() > deadline) throw new Error("job did not complete in time");
    await new Promise((r) => setTimeout(r, 150));
  }
}

function submit(body: unknown) {
  return request(app).post("/api/quote-requests").send(body);
}

beforeEach(async () => {
  await _resetJobs();
  _resetDb();
  sendMailMock.mockClear();
  vi.restoreAllMocks();
  // The 5/hour contact-vector budget is per-IP and shared across tests in
  // this file — reset it so each test starts with a full budget. v8 masks
  // IPv6 clients to a /56 subnet, so the store key is the masked form.
  await quoteRequestLimiter.resetKey(ipKeyGenerator("::ffff:127.0.0.1", 56));
});

afterEach(async () => {
  await _resetJobs();
  _resetDb();
});

describe("POST /api/quote-requests validation", () => {
  it("rejects consent=false (TCPA: consent must be literally true)", async () => {
    const jobId = await createCompletedJob();
    const res = await submit({
      jobId,
      agentIds: ["ma-cambridge-01"],
      contact: CONTACT,
      consent: false,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects missing consent", async () => {
    const jobId = await createCompletedJob();
    const res = await submit({ jobId, agentIds: ["ma-cambridge-01"], contact: CONTACT });
    expect(res.status).toBe(400);
  });

  it("rejects more than 3 agents", async () => {
    const jobId = await createCompletedJob();
    const res = await submit({
      jobId,
      agentIds: ["a", "b", "c", "d"],
      contact: CONTACT,
      consent: true,
    });
    expect(res.status).toBe(400);
  });

  it("rejects zero agents", async () => {
    const jobId = await createCompletedJob();
    const res = await submit({ jobId, agentIds: [], contact: CONTACT, consent: true });
    expect(res.status).toBe(400);
  });

  it("404s on an unknown jobId", async () => {
    const res = await submit({
      jobId: "00000000-0000-0000-0000-000000000000",
      agentIds: ["ma-cambridge-01"],
      contact: CONTACT,
      consent: true,
    });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("JOB_NOT_FOUND");
  });

  it("422s on an agentId not in the directory", async () => {
    const jobId = await createCompletedJob();
    const res = await submit({
      jobId,
      agentIds: ["no-such-agent"],
      contact: CONTACT,
      consent: true,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("UNKNOWN_AGENTS");
  });
});

describe("delivery provider chain", () => {
  it("handoff delivery for sample agents (no verified email) + user receipt sent", async () => {
    const jobId = await createCompletedJob();
    const res = await submit({
      jobId,
      agentIds: ["ma-cambridge-01", "ma-somerville-01"],
      contact: CONTACT,
      consent: true,
    });
    expect(res.status).toBe(201);
    // Ref code format: QP-XXXXXX, unambiguous alphabet.
    expect(res.body.refCode).toMatch(/^QP-[A-HJKMNP-Z2-9]{6}$/);
    expect(res.body.deliveries).toHaveLength(2);
    for (const d of res.body.deliveries) {
      expect(d.method).toBe("handoff");
      expect(d.handoffCard.phone).toMatch(/555-010-01/);
      expect(d.handoffCard.address).toBeTruthy();
    }
    // The shopper always gets a receipt (dev: logged via mocked transport).
    const receiptCalls = sendMailMock.mock.calls.filter((c) =>
      String((c[0] as { to?: string }).to).includes("driver@example.com"),
    );
    expect(receiptCalls).toHaveLength(1);
    expect((receiptCalls[0][0] as { subject: string }).subject).toContain(res.body.refCode);
  });

  it("emailed delivery when the agent record carries a verified email", async () => {
    const jobId = await createCompletedJob();
    // Swap the directory for one agent WITH a verified email. The service
    // reads the directory through agentDirectory.lookupAgents.
    const dir = await import("../src/services/agentDirectory.js");
    const spy = vi.spyOn(dir, "lookupAgents").mockResolvedValue({
      agents: [sampleAgent("agent-with-email", { email: "agency@example.com" } as never)],
      source: "sample" as const,
      fallbackReason: null,
    });

    const res = await submit({
      jobId,
      agentIds: ["agent-with-email"],
      contact: CONTACT,
      consent: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.deliveries).toHaveLength(1);
    expect(res.body.deliveries[0].method).toBe("emailed");
    expect(res.body.deliveries[0].handoffCard).toBeUndefined();

    // The agent email went through the transport with a professional subject
    // and the shopper's email as reply-to content (in the body).
    const agentCalls = sendMailMock.mock.calls.filter((c) =>
      String((c[0] as { to?: string }).to).includes("agency@example.com"),
    );
    expect(agentCalls).toHaveLength(1);
    const mail = agentCalls[0][0] as { subject: string; text: string };
    expect(mail.subject).toContain(res.body.refCode);
    expect(mail.subject).toContain("02139");
    expect(mail.text).toContain(res.body.refCode);
    expect(mail.text).toContain(CONTACT.name);
    expect(mail.text).toContain(CONTACT.phone);
    // Age bands, not exact ages/DOBs, in the agent-facing summary.
    expect(mail.text).toMatch(/Age band/);
    expect(mail.text).not.toMatch(/"age":/);
    spy.mockRestore();
  });
});

describe("PII handling", () => {
  it("never logs raw phone or email", async () => {
    const infos: unknown[][] = [];
    const errors: unknown[][] = [];
    vi.spyOn(logger, "info").mockImplementation((...a: unknown[]) => void infos.push(a));
    vi.spyOn(logger, "error").mockImplementation((...a: unknown[]) => void errors.push(a));

    const jobId = await createCompletedJob();
    const res = await submit({
      jobId,
      agentIds: ["ma-cambridge-01"],
      contact: CONTACT,
      consent: true,
    });
    expect(res.status).toBe(201);

    const dump = JSON.stringify([...infos, ...errors]);
    expect(dump).not.toContain(CONTACT.phone);
    expect(dump).not.toContain(CONTACT.email);
    expect(dump).not.toContain(CONTACT.name);
    // The phone hash IS logged (auditability without PII).
    expect(dump).toContain("phoneHash");
  });
});

describe("rate limiting", () => {
  it("allows 5 submissions per hour, then 429s", async () => {
    const jobId = await createCompletedJob();
    const body = (i: number) => ({
      jobId,
      agentIds: ["ma-cambridge-01"],
      contact: { ...CONTACT, email: `driver${i}@example.com` },
      consent: true,
    });
    for (let i = 0; i < 5; i++) {
      const res = await submit(body(i));
      expect(res.status).toBe(201);
    }
    const limited = await submit(body(5));
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
  });
});
