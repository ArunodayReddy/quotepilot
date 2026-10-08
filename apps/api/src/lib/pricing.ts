/**
 * Shared simulation pricing engine for the carrier adapters.
 *
 * Pricing is anchored to real research (CONTEXT.md §5): Allstate ≈ $1,347/6mo
 * for a MA profile shaped like data/sample/profile.sample.json (2024 Tesla
 * Model Y, 2 clean-record drivers 31/29, 50/100/50 + UM 50/100 + $5k med-pay
 * + $500 comp/collision). BASE_ANCHOR is set so the sample profile's EV and
 * new-car factors land Allstate at ~1347; every adapter multiplies by its own
 * personality factor to stay in the realistic 1100–1900 band.
 *
 * Deterministic-ish: the ±3% jitter and simulated latency both derive from a
 * stable hash of (carrierId + normalized profile fields), so identical inputs
 * → identical quotes. No RNG state, no flakiness.
 */
import type { QuoteRequest } from "../../../../packages/shared/dist/types.js";
import { profilePricingKey, stableUnit, type PricingProfile } from "./hash.js";

/** Project a QuoteRequest onto the identity-free fields that move price. */
function toPricingProfile(request: QuoteRequest): PricingProfile {
  return {
    contact: { state: request.contact.state, zip: request.contact.zip },
    drivers: request.drivers.map((d) => ({
      age: d.age,
      yearsLicensed: d.yearsLicensed,
      accidentsLast5Years: d.accidentsLast5Years,
      violationsLast3Years: d.violationsLast3Years,
    })),
    vehicles: request.vehicles.map((v) => ({
      year: v.year,
      make: v.make,
      model: v.model,
      ownership: v.ownership,
      usage: v.usage,
      annualMileage: v.annualMileage,
      garagedZip: v.garagedZip,
    })),
    coverage: Object.fromEntries(Object.entries(request.coverage)) as Record<string, number | boolean>,
  };
}

/** Calibrated so Allstate × sample-profile factors ≈ $1,347. */
export const BASE_ANCHOR = 1236;

export interface CarrierPersonality {
  carrierId: string;
  carrierName: string;
  /** Price multiplier vs the anchor — each carrier's pricing personality. */
  priceFactor: number;
  /** Simulated network latency range, ms. */
  latencyMinMs: number;
  latencyMaxMs: number;
  caveats: string[];
}

const EV_MAKES = new Set(["tesla", "rivian", "lucid", "polestar"]);
const EV_MODELS = new Set(["model 3", "model y", "model s", "model x", "cybertruck", "ioniq 5", "ev6", "id.4", "mach-e"]);

function isEV(make: string, model: string): boolean {
  return EV_MAKES.has(make.toLowerCase()) || EV_MODELS.has(model.toLowerCase());
}

/** Risk multipliers from driver/vehicle/coverage fields. Identity-free. */
export function profileRiskFactor(request: QuoteRequest): number {
  let f = 1;
  for (const d of request.drivers) {
    if (d.age < 25) f *= 1.15;
    else if (d.age > 70) f *= 1.08;
    if (d.yearsLicensed < 3) f *= 1.05;
    f *= 1 + 0.08 * d.accidentsLast5Years + 0.04 * d.violationsLast3Years;
  }
  for (const v of request.vehicles) {
    if (isEV(v.make, v.model)) f *= 1.06; // EV parts/repair costs
    if (v.year >= 2022) f *= 1.03; // newer = higher replacement value
    if (v.ownership === "leased") f *= 1.02;
    if (v.usage === "business") f *= 1.15;
    if (v.usage === "rideshare") f *= 1.25;
    if (v.annualMileage > 15000) f *= 1.04;
  }
  const c = request.coverage;
  if (c.collisionDeductible < 500 || c.comprehensiveDeductible < 500) f *= 1.05;
  return f;
}

/** Deterministic 6-month premium for a carrier + profile. */
export function pricePremium6Mo(request: QuoteRequest, personality: CarrierPersonality): number {
  const key = profilePricingKey(personality.carrierId, toPricingProfile(request));
  const jitter = 0.97 + stableUnit(key) * 0.06; // ±3%
  const premium = BASE_ANCHOR * personality.priceFactor * profileRiskFactor(request) * jitter;
  return Math.max(300, Math.round(premium));
}

/** Deterministic simulated latency within the carrier's range, ms. */
export function simulatedLatencyMs(request: QuoteRequest, personality: CarrierPersonality): number {
  const key = profilePricingKey(personality.carrierId, toPricingProfile(request)) + ":latency";
  const span = personality.latencyMaxMs - personality.latencyMinMs;
  const raw = personality.latencyMinMs + stableUnit(key) * span;
  const scale = Number(process.env.SIM_LATENCY_SCALE ?? "1");
  return Math.max(1, Math.round(raw * (Number.isFinite(scale) && scale > 0 ? scale : 1)));
}

/** 0–100 fit score: how well the carrier's offering matches requested coverage. */
export function coverageMatchPct(request: QuoteRequest, personality: CarrierPersonality): number {
  const c = request.coverage;
  let score = 94;
  if (c.uninsuredMotoristPerPerson === c.bodilyInjuryPerPerson) score += 2; // full UM stack
  if (c.medicalPayments >= 5000) score += 1;
  if (c.collisionDeductible > 1000 || c.comprehensiveDeductible > 1000) score -= 3;
  if (c.rentalReimbursement && c.roadsideAssistance) score += 1;
  const key = profilePricingKey(personality.carrierId, toPricingProfile(request)) + ":match";
  score += Math.floor(stableUnit(key) * 3); // 0–2 deterministic wobble
  return Math.min(99, Math.max(85, score));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
