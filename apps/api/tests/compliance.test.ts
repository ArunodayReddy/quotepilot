/**
 * v0.7.0 compliance tests (docs/COMPLIANCE.md).
 *
 * API half: disclosure registry endpoint, consent-flag schema behavior,
 * non-PII public job view.
 *
 * Web half: static surface checks over the React sources — every quote surface
 * must carry the estimates-not-offers disclosure + simulated badge, the TCPA
 * checkbox must start unchecked, the per-state panel must be wired, and the
 * footer must carry the producer disclaimer + legal links on every page.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { _resetJobs } from "../src/services/jobQueue.js";
import { quoteRequestSchema } from "../src/lib/schemas.js";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..", "..");
const samplePath = resolve(REPO_ROOT, "data", "sample", "profile.sample.json");
const sampleProfile = JSON.parse(readFileSync(samplePath, "utf8")) as Record<string, unknown>;
const { expectedQuoteBand6Mo: _drop, _note: _note2, ...quoteBody } = sampleProfile;

const app = createApp();

beforeEach(async () => {
  await _resetJobs();
});

afterEach(async () => {
  await _resetJobs();
});

function webFile(p: string): string {
  return readFileSync(resolve(REPO_ROOT, "apps", "web", "src", p), "utf8");
}

describe("disclosure registry API", () => {
  for (const st of ["MA", "TX", "CA", "NH"]) {
    it(`GET /api/disclosures/${st} returns sourced notes`, async () => {
      const res = await request(app).get(`/api/disclosures/${st}`);
      expect(res.status).toBe(200);
      expect(res.body.state).toBe(st);
      expect(Array.isArray(res.body.notes)).toBe(true);
      expect(res.body.notes.length).toBeGreaterThanOrEqual(3);
      for (const n of res.body.notes) {
        expect(n.title).toBeTruthy();
        expect(n.body).toBeTruthy();
      }
      expect(res.body.educationalOnly).toBe(true);
      expect(Array.isArray(res.body.sources)).toBe(true);
      expect(res.body.sources.length).toBeGreaterThan(0);
    });
  }

  it("GET /api/disclosures/ZZ → 404 (graceful degradation contract)", async () => {
    const res = await request(app).get("/api/disclosures/ZZ");
    expect(res.status).toBe(404);
  });

  it("lowercase state codes resolve", async () => {
    const res = await request(app).get("/api/disclosures/ma");
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("MA");
  });

  // v0.7.0 minCoverage: verified state minimums ride the disclosures files.
  // States without verified data simply lack the field — never guessed.
  const MIN_STATES = [
    "TX", "CA", "MA", "FL", "NY", "IL", "OH", "PA", "GA", "NC", "VA", "NJ",
    "CT", "WA", "AZ", "CO", "MI", "MN", "NV", "OR", "TN", "WI", "MD", "NH",
  ];

  it("every state with minCoverage has a valid shape", async () => {
    for (const st of MIN_STATES) {
      const res = await request(app).get(`/api/disclosures/${st}`);
      expect(res.status).toBe(200);
      const mc = res.body.minCoverage as Record<string, unknown> | undefined;
      expect(mc, `${st} should carry minCoverage`).toBeDefined();
      expect(typeof mc!.biPerPerson).toBe("number");
      expect(typeof mc!.biPerAccident).toBe("number");
      expect(typeof mc!.propertyDamage).toBe("number");
      expect(mc!.pip === null || typeof mc!.pip === "number").toBe(true);
      expect(typeof mc!.notes).toBe("string");
      expect(typeof mc!.verified).toBe("string");
      // per-accident BI must be >= per-person BI (sanity)
      expect(mc!.biPerAccident as number).toBeGreaterThanOrEqual(mc!.biPerPerson as number);
    }
  });

  it("spot-checks: recently changed minimums are current", async () => {
    const ma = (await request(app).get("/api/disclosures/MA")).body.minCoverage;
    expect(ma.biPerPerson).toBe(25000); // Act H.5111 (2026): was 20/40/5
    expect(ma.propertyDamage).toBe(30000);
    expect(ma.pip).toBe(8000);
    const va = (await request(app).get("/api/disclosures/VA")).body.minCoverage;
    expect(va.biPerPerson).toBe(50000); // raised 2025-01-01: was 30/60/20
    expect(va.propertyDamage).toBe(25000);
    const tn = (await request(app).get("/api/disclosures/TN")).body.minCoverage;
    expect(tn.propertyDamage).toBe(25000); // raised 2023-01-01: was 15k
  });
});

describe("consent flags on the quote contract", () => {
  it("phoneOptIn defaults to false when omitted", () => {
    const parsed = quoteRequestSchema.parse(quoteBody);
    expect(parsed.phoneOptIn).toBe(false);
  });

  it("phoneOptIn: true round-trips through the schema", () => {
    const parsed = quoteRequestSchema.parse({ ...quoteBody, phoneOptIn: true });
    expect(parsed.phoneOptIn).toBe(true);
  });

  it("emailOptIn defaults to true (unchanged)", () => {
    const parsed = quoteRequestSchema.parse(quoteBody);
    expect(parsed.emailOptIn).toBe(true);
  });

  it("public job view carries the state code (2-letter, non-PII) but no consent flags", async () => {
    const create = await request(app)
      .post("/api/quote")
      .send({ ...quoteBody, phoneOptIn: true });
    expect(create.status).toBe(202);
    const jobId = create.body.jobId as string;
    const res = await request(app).get(`/api/quotes/${jobId}`);
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("MA");
    expect(res.body.phoneOptIn).toBeUndefined();
    expect(res.body.emailOptIn).toBeUndefined();
    // No PII on the status endpoint (existing rule, re-verified).
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/driver@example\.com/);
  });
});

describe("web compliance surfaces (static)", () => {
  it("quote results carry the estimates-not-offers disclosure + simulated badge", () => {
    const q = webFile("pages/Quotes.tsx");
    // Doctrine may live on the page or in the shared QuoteDisclaimer component.
    const disc = webFile("components/QuoteDisclaimer.tsx");
    expect(q).toContain("QuoteDisclaimer");
    expect(disc).toMatch(/estimates, not offers/i);
    expect(disc).toMatch(/final premium[\s\S]*carrier(&apos;|&#x27;|&#39;|')s own/);
    expect(disc).toContain("SimBadge");
    expect(q).toContain("StateDisclosurePanel");
    const sim = webFile("components/SimBadge.tsx");
    expect(sim).toContain("Simulated — demo pricing");
  });

  it("TCPA phone consent is unchecked by default, never pre-checked", () => {
    const wz = webFile("pages/Wizard.tsx");
    expect(wz).toContain('id="wz-consent-phone"');
    expect(wz).toMatch(/consent is not a condition/i);
    expect(wz).toMatch(/express written consent/i);
    const lib = webFile("lib/wizard.ts");
    expect(lib).toMatch(/consentPhone:\s*false/);
    // Sample/demo fill must not pre-check TCPA consent either.
    expect(lib).not.toMatch(/consentPhone:\s*true/);
  });

  it("footer carries the producer disclaimer + legal links on every page", () => {
    const layout = webFile("components/Layout.tsx");
    expect(layout).toMatch(/not an insurance company or licensed insurance producer/i);
    expect(layout).toContain('to="/terms"');
    expect(layout).toContain('to="/privacy"');
    expect(layout).toContain('to="/disclosures"');
  });

  it("legal routes are registered", () => {
    const app = webFile("App.tsx");
    expect(app).toContain('path="terms"');
    expect(app).toContain('path="privacy"');
    expect(app).toContain('path="disclosures"');
  });

  it("no guaranteed-savings / best-deal language remains on marketing surfaces", () => {
    for (const p of ["pages/Home.tsx", "pages/About.tsx", "pages/Quotes.tsx", "components/Layout.tsx"]) {
      const src = webFile(p).toLowerCase();
      expect(src).not.toContain("best deal");
      expect(src).not.toContain("best price");
      expect(src).not.toMatch(/guarantee\w* (savings|price|lowest)/);
    }
  });
});
