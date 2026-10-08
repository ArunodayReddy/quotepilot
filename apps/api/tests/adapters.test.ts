/**
 * Adapter tests: pricing band, determinism, caveats, simulation flag.
 *
 * The sample profile mirrors data/sample/profile.sample.json (masked demo
 * data — no PII). Pricing is anchored to the real October 2026 Allstate MA
 * quote of $1,347/6mo; every adapter must land inside 1100–1900 for it.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { QuoteAdapter, QuoteRequest } from "../../packages/shared/src/types.js";
import { allstateAdapter } from "../src/adapters/allstate.js";
import { amicaAdapter } from "../src/adapters/amica.js";
import { geicoAdapter } from "../src/adapters/geico.js";
import { libertyMutualAdapter } from "../src/adapters/libertyMutual.js";
import { plymouthRockAdapter } from "../src/adapters/plymouthRock.js";
import { progressiveAdapter } from "../src/adapters/progressive.js";

const here = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(here, "..", "..", "..", "data", "sample", "profile.sample.json");
const sample = JSON.parse(readFileSync(samplePath, "utf8")) as QuoteRequest;

// Strip wizard-only extras so the profile matches the QuoteRequest shape.
const { expectedQuoteBand6Mo: _drop, ...profile } = sample as QuoteRequest & {
  expectedQuoteBand6Mo?: unknown;
};

const ADAPTERS: QuoteAdapter[] = [
  geicoAdapter,
  progressiveAdapter,
  allstateAdapter,
  libertyMutualAdapter,
  plymouthRockAdapter,
  amicaAdapter,
];

describe("carrier adapters", () => {
  for (const adapter of ADAPTERS) {
    it(`${adapter.carrierId}: prices inside 1100–1900 for the sample MA profile`, async () => {
      const result = await adapter.quote(profile, { timeoutMs: 8000 });
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.carrierId).toBe(adapter.carrierId);
      expect(result.premium6Mo).toBeGreaterThanOrEqual(1100);
      expect(result.premium6Mo).toBeLessThanOrEqual(1900);
      expect(result.monthlyEquivalent).toBeCloseTo((result.premium6Mo as number) / 6, 2);
      expect(result.caveats.length).toBeGreaterThan(0);
      expect(result.coverageMatchPct).toBeGreaterThanOrEqual(0);
      expect(result.coverageMatchPct).toBeLessThanOrEqual(100);
      expect(result.currency).toBe("USD");
    });

    it(`${adapter.carrierId}: deterministic on repeat calls`, async () => {
      const a = await adapter.quote(profile, { timeoutMs: 8000 });
      const b = await adapter.quote(profile, { timeoutMs: 8000 });
      expect(a.premium6Mo).toBe(b.premium6Mo);
      expect(a.coverageMatchPct).toBe(b.coverageMatchPct);
      expect(a.caveats).toEqual(b.caveats);
    });
  }

  it("allstate anchors near $1,347 for the sample profile", async () => {
    const result = await allstateAdapter.quote(profile, { timeoutMs: 8000 });
    expect(result.premium6Mo).toBeGreaterThanOrEqual(1247);
    expect(result.premium6Mo).toBeLessThanOrEqual(1447);
  });

  it("personalities are distinct: geico < allstate < amica", async () => {
    const [g, a, m] = await Promise.all([
      geicoAdapter.quote(profile, { timeoutMs: 8000 }),
      allstateAdapter.quote(profile, { timeoutMs: 8000 }),
      amicaAdapter.quote(profile, { timeoutMs: 8000 }),
    ]);
    expect(g.premium6Mo as number).toBeLessThan(a.premium6Mo as number);
    expect(a.premium6Mo as number).toBeLessThan(m.premium6Mo as number);
  });

  it("risk profile moves price: accidents raise the premium", async () => {
    const risky: QuoteRequest = {
      ...profile,
      drivers: profile.drivers.map((d) => ({ ...d, accidentsLast5Years: 2 })),
    };
    const clean = await progressiveAdapter.quote(profile, { timeoutMs: 8000 });
    const crashy = await progressiveAdapter.quote(risky, { timeoutMs: 8000 });
    expect(crashy.premium6Mo as number).toBeGreaterThan(clean.premium6Mo as number);
  });
});
