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
  /**
   * TCPA express-written-consent flag for marketing calls/texts to the phone
   * number provided. Must be unchecked by default on the client.
   */
  phoneOptIn?: boolean;
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

export interface AgentHours {
  weekdays: string;
  saturday: string;
  sunday: string;
}

export interface Agent {
  id: string;
  name: string;
  /** Street address (demo: obviously-sample street numbers). */
  address: string;
  city: string;
  zip: string;
  phone: string;
  /** Approximate coordinates (demo-grade; production uses a real directory feed). */
  lat: number;
  lng: number;
  hours: AgentHours;
  carriers: string[];
  languages: string[];
  /** true for seeded demo entries — never real people's numbers. */
  sample: boolean;
}

/** Where an agent listing came from. */
export type AgentSource = "google_places" | "sample";

/** Agent as returned by GET /api/agents when a ZIP was geocoded. */
export interface AgentWithDistance extends Agent {
  /** Miles from the searched ZIP centroid, 1 decimal; null when not geocoded. */
  distance_mi: number | null;
  /** Data provenance — "live" badge vs "sample" badge in the UI. */
  source: AgentSource;
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
  /** Carrier homepage domain (no protocol), for honest "quote direct" links. */
  website?: string;
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
  /** 2-letter state code the quote was run for (not PII) — drives state disclosures. */
  state: string;
  /**
   * True when this result was served from the quote-result cache rather than a
   * fresh carrier fan-out. Set by the API; never stored.
   */
  cached?: boolean;
}

// ---------------------------------------------------------------------------
// Agent-mediated quote requests (v0.11.0 "Real quotes").
// The real working model while carrier APIs don't exist: the user submits
// once; licensed local agents receive a professional quote request and reply
// with REAL quotes. This is lead-gen infrastructure, not simulation.
// ---------------------------------------------------------------------------

/** How a quote request reached an agent. */
export type QuoteRequestDeliveryMethod = "emailed" | "handoff";

/** Contact the user consented to share with the selected agencies (TCPA). */
export interface QuoteRequestContact {
  name: string;
  email: string;
  phone: string;
}

/** What the user sees when an agent has no verified email to receive one. */
export interface QuoteRequestHandoffCard {
  phone: string;
  address: string;
  city: string;
  zip: string;
}

export interface QuoteRequestDelivery {
  agentId: string;
  agentName: string;
  method: QuoteRequestDeliveryMethod;
  /** Present only for "handoff" deliveries. */
  handoffCard?: QuoteRequestHandoffCard;
}

/** Client → POST /api/quote-requests. */
export interface CreateQuoteRequestInput {
  jobId: string;
  /** 1–3 agent ids, selected by the user on the results page. */
  agentIds: string[];
  contact: QuoteRequestContact;
  /** Must be literally true — TCPA express written consent. */
  consent: boolean;
}

/** Server → client after a successful submission. */
export interface CreateQuoteRequestResponse {
  /** e.g. "QP-7KQ2XA" — the user quotes this when an agent calls back. */
  refCode: string;
  deliveries: QuoteRequestDelivery[];
  message: string;
}

/** Persisted lead record (server-side only, never in logs or analytics). */
export interface QuoteRequestRecord {
  id: string;
  refCode: string;
  jobId: string;
  agentIds: string[];
  contact: QuoteRequestContact;
  deliveries: QuoteRequestDelivery[];
  consentAt: string; // ISO-8601
  createdAt: string; // ISO-8601
}
