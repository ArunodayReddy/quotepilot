/**
 * Deterministic hashing helpers.
 *
 * Pricing must be deterministic-ish: identical inputs -> identical quotes.
 * We derive a stable pseudo-random factor from a hash of (carrierId +
 * normalized profile fields) and use it for the ±3% quote jitter and for
 * simulated latency, so runs are reproducible without any RNG state.
 */
import { createHash } from "node:crypto";

/** SHA-256 hex digest of the input. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Deterministic number in [0, 1) from an arbitrary string key. */
export function stableUnit(key: string): number {
  const hex = sha256Hex(key).slice(0, 8);
  return parseInt(hex, 16) / 0xffffffff;
}

/** mulberry32 PRNG seeded from a string — for a short deterministic sequence. */
export function seededRandom(seedKey: string): () => number {
  let a = parseInt(sha256Hex(seedKey).slice(0, 8), 16) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Normalized profile key: carrier + the fields that legitimately move price.
 * Deliberately EXCLUDES name, email, phone, and exact address — pricing
 * personality comes from risk fields, never identity fields.
 */
export interface PricingProfile {
  contact: { state: string; zip: string };
  drivers: Array<{
    age: number;
    yearsLicensed: number;
    accidentsLast5Years: number;
    violationsLast3Years: number;
  }>;
  vehicles: Array<{
    year: number;
    make: string;
    model: string;
    ownership: string;
    usage: string;
    annualMileage: number;
    garagedZip: string;
  }>;
  coverage: Record<string, number | boolean>;
}

export function profilePricingKey(carrierId: string, profile: PricingProfile): string {
  const drivers = profile.drivers
    .map((d) => [d.age, d.yearsLicensed, d.accidentsLast5Years, d.violationsLast3Years].join(","))
    .sort()
    .join("|");
  const vehicles = profile.vehicles
    .map((v) =>
      [v.year, v.make.toLowerCase(), v.model.toLowerCase(), v.ownership, v.usage, v.annualMileage, v.garagedZip].join(","),
    )
    .sort()
    .join("|");
  const coverage = Object.keys(profile.coverage)
    .sort()
    .map((k) => `${k}=${profile.coverage[k]}`)
    .join(",");
  return [carrierId, profile.contact.state, profile.contact.zip, drivers, vehicles, coverage].join("~");
}
