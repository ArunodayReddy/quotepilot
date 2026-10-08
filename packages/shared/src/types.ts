/**
 * QuotePilot shared types — single source of truth for the API contract.
 *
 * The QuoteAdapter interface is the law (CONTEXT.md rule 7): one adapter per
 * carrier in apps/api/src/adapters/, all implementing this interface.
 * Simulation adapters today, real carrier APIs tomorrow — this interface
 * must NOT change when real integrations land.
 */

export type CoverageChannel = "direct" | "agent";

/** A QuoteRequest mirrors the wizard payload. All PII stays server-side; never logged. */
export interface QuoteRequest {
  contact: {
    email: string;
    phone: string;
    state: string; // 2-letter uppercase, e.g. "MA"
    zip: string; // 5-digit
  };
  drivers: Driver[];
  vehicles: Vehicle[];
  coverage: CoverageSelection;
  currentPolicy?: CurrentPolicy;
  /** When true (default), email the user when their quotes are ready. */
  emailOptIn?: boolean;
}

export interface Driver {
  firstName: string;
  lastName: string;
  age: number;
  gender: "male" | "female" | "nonbinary" | "other" | "prefer_not_to_say";
  yearsLicensed: number;
  accidentsLast5Years: number;
  violationsLast3Years: number;
}

export interface Vehicle {
  year: number;
  make: string;
  model: string;
  trim?: string;
  ownership: "owned" | "financed" | "leased";
  usage: "commute" | "pleasure" | "business" | "rideshare";
  annualMileage: number;
  garagedZip: string;
  vinLast4?: string;
}

export interface CoverageSelection {
  bodilyInjuryPerPerson: number;
  bodilyInjuryPerAccident: number;
  propertyDamage: number;
  uninsuredMotoristPerPerson: number;
  uninsuredMotoristPerAccident: number;
  medicalPayments: number;
  collisionDeductible: number;
  comprehensiveDeductible: number;
  rentalReimbursement: boolean;
  roadsideAssistance: boolean;
}

export interface CurrentPolicy {
  carrier?: string;
  currentPremium6Mo?: number;
  policyNumber?: string;
  renewalDate?: string;
  termMonths?: number;
}

/** Context handed to every adapter call. Real integrations will use timeoutMs
 *  to bound their HTTP calls; simulation adapters use it as a hard ceiling. */
export interface QuoteContext {
  timeoutMs: number;
}

/** THE adapter contract. Do not add required members — extend via optional
 *  fields only, so existing adapters keep compiling when real APIs land. */
export interface QuoteAdapter {
  readonly carrierId: string;
  readonly carrierName: string;
  quote(request: QuoteRequest, ctx: QuoteContext): Promise<QuoteResult>;
}

export interface QuoteResult {
  carrierId: string;
  carrierName: string;
  /** false when the carrier errored or timed out; see error/errorCode. */
  success: boolean;
  /** 6-month premium in USD, present when success is true. */
  premium6Mo?: number;
  monthlyEquivalent?: number;
  currency: "USD";
  /** true for simulation adapters; false once a real carrier API is wired. */
  simulated: boolean;
  /** How long the adapter took, ms (includes simulated network latency). */
  latencyMs: number;
  /** 0–100: how well the carrier's offering matched the requested coverage. */
  coverageMatchPct?: number;
  /** Human-readable pricing notes, discounts applied, telematics caveats, etc. */
  caveats: string[];
  quotedAt: string; // ISO-8601
  error?: string;
  errorCode?: "ADAPTER_TIMEOUT" | "ADAPTER_ERROR" | "CARRIER_UNAVAILABLE";
}

export interface Agent {
  name: string;
  city: string;
  phone: string;
  carriers: string[];
  languages: string[];
  /** true for seeded demo entries — never real people's numbers. */
  sample: boolean;
}

export interface CarrierRegistryEntry {
  id: string;
  name: string;
  channel: CoverageChannel;
  statesServed: string[];
  /** Emoji/text placeholder until real brand assets are licensed. */
  logo: string;
  /** Whether QuotePilot can actually produce a quote for this carrier. */
  quotable: boolean;
  notes?: string;
  available?: boolean;
}

export interface AnalyticsEvent {
  event: string;
  page: string;
  element?: string;
  /** sessionHash (SHA-256 of sessionId, truncated) — raw sessionId is never stored. */
  sessionHash: string;
  timestamp: string; // ISO-8601
  metadata?: Record<string, unknown> | null;
}

export type JobStatus = "queued" | "running" | "complete" | "failed";

export interface QuoteJob {
  jobId: string;
  status: JobStatus;
  progress: { completed: number; total: number };
  results: QuoteResult[];
  carrierCount: number;
  estimatedSeconds: number;
  createdAt: string;
  completedAt?: string;
}
