/**
 * Nationwide registry validity (v0.6.0): every state file must be a well-formed
 * registry, and quotable flags must stay consistent with the wired adapters.
 * Honest-degradation law: quotable:true ⟹ a simulation adapter exists. Never
 * invent pricing — the test enforces it.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { _resetJobs, adaptersForState } from "../src/services/jobQueue.js";
import { getCarriersForState } from "../src/services/carrierRegistry.js";

const here = dirname(fileURLToPath(import.meta.url));
const CARRIERS_DIR = resolve(here, "..", "..", "..", "data", "carriers");

// Carrier ids with a wired simulation adapter (mirrors jobQueue ADAPTERS).
const ADAPTER_IDS = new Set([
  "geico",
  "progressive",
  "allstate",
  "libertyMutual",
  "plymouthRock",
  "amica",
]);

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

function loadState(state: string): Array<Record<string, unknown>> {
  const raw = readFileSync(join(CARRIERS_DIR, `${state}.json`), "utf8");
  const parsed: unknown = JSON.parse(raw);
  expect(Array.isArray(parsed)).toBe(true);
  return parsed as Array<Record<string, unknown>>;
}

describe("nationwide carrier registry", () => {
  it("has a registry file for all 50 states", () => {
    const files = new Set(readdirSync(CARRIERS_DIR).filter((f) => f.endsWith(".json")));
    for (const s of STATES) expect(files.has(`${s}.json`)).toBe(true);
  });

  for (const state of STATES) {
    it(`${state}: entries are well-formed with >=3 carriers`, () => {
      const entries = loadState(state);
      expect(entries.length).toBeGreaterThanOrEqual(3);
      for (const e of entries) {
        expect(typeof e.id).toBe("string");
        expect(typeof e.name).toBe("string");
        expect(["direct", "agent"]).toContain(e.channel);
        expect(typeof e.logo).toBe("string");
        expect(typeof e.quotable).toBe("boolean");
        expect(e.statesServed).toEqual([state]);
        // Honest-degradation law: quotable only with a wired adapter.
        if (e.quotable === true) {
          expect(ADAPTER_IDS.has(e.id as string)).toBe(true);
        }
      }
    });
  }

  it("every state resolves at least one quotable adapter (demo never dead-ends)", () => {
    for (const s of STATES) {
      expect(adaptersForState(s).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("Amica is not quotable in AK/HI", () => {
    for (const s of ["AK", "HI"]) {
      const amica = getCarriersForState(s).find((e) => e.id === "amica");
      expect(amica?.quotable).toBe(false);
    }
  });
});

describe("nationwide quote jobs", () => {
  const app = createApp();
  beforeEach(() => _resetJobs());

  function caPayload(state: string, zip: string) {
    return {
      contact: { email: "driver@example.com", phone: "555-010-0199", state, zip },
      drivers: [
        { firstName: "Alex", lastName: "Rivera", age: 31, gender: "male",
          yearsLicensed: 15, accidentsLast5Years: 0, violationsLast3Years: 0 },
      ],
      vehicles: [
        { year: 2024, make: "Tesla", model: "Y", ownership: "owned", usage: "commute",
          annualMileage: 12000, garagedZip: zip },
      ],
      coverage: {
        bodilyInjuryPerPerson: 50000, bodilyInjuryPerAccident: 100000, propertyDamage: 50000,
        uninsuredMotoristPerPerson: 50000, uninsuredMotoristPerAccident: 100000,
        medicalPayments: 5000, collisionDeductible: 500, comprehensiveDeductible: 500,
        rentalReimbursement: false, roadsideAssistance: true,
      },
    };
  }

  for (const [state, zip] of [["CA", "94102"], ["FL", "33128"], ["NY", "10001"]] as const) {
    it(`POST /api/quote for ${state}/${zip} creates a job with carriers`, async () => {
      const res = await request(app).post("/api/quote").send(caPayload(state, zip));
      expect(res.status).toBe(202);
      expect(res.body.carrierCount).toBeGreaterThanOrEqual(1);
      expect(typeof res.body.jobId).toBe("string");
    });
  }

  it("GET /api/carriers?state=FL lists the national core", async () => {
    const res = await request(app).get("/api/carriers?state=FL");
    expect(res.status).toBe(200);
    const ids = (res.body.carriers as Array<{ id: string }>).map((c) => c.id);
    for (const id of ["geico", "progressive", "allstate", "stateFarm", "usaa"]) {
      expect(ids).toContain(id);
    }
  });
});
