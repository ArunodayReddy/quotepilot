/* Shared API contract types — mirrors the backend contract in the task brief.
   Never include PII in analytics metadata. */

export interface DriverInput {
  firstName: string;
  lastName: string;
  age: number;
  gender: "male" | "female" | "nonbinary" | "other" | "prefer_not_to_say";
  yearsLicensed: number;
  accidentsLast5Years: number;
  violationsLast3Years: number;
}

export interface VehicleInput {
  year: number;
  make: string;
  model: string;
  trim: string;
  ownership: "owned" | "financed" | "leased";
  usage: "commute" | "pleasure" | "business";
  annualMileage: number;
  garagedZip: string;
  vinLast4?: string;
}

export interface CoverageInput {
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

export interface ContactInput {
  email: string;
  phone: string;
  state: string;
  zip: string;
}

export interface QuoteRequest {
  contact: ContactInput;
  drivers: DriverInput[];
  vehicles: VehicleInput[];
  coverage: CoverageInput;
  currentPolicy?: {
    carrier: string;
    currentPremium6Mo: number;
    renewalDate: string;
    termMonths: number;
  };
  /** Quote-ready email consent flag. */
  emailOptIn?: boolean;
  /** TCPA express-written-consent flag for marketing calls/texts. */
  phoneOptIn?: boolean;
}

export interface QuoteResult {
  carrierId: string;
  carrierName: string;
  premium6Mo: number;
  premiumMonthly: number;
  coverageMatchPct: number;
  caveats: string[];
  simulated: boolean;
  latencyMs: number;
  rank: number;
}

export type JobStatus = "queued" | "running" | "complete" | "failed";

export interface QuoteJob {
  jobId: string;
  status: JobStatus;
  progress: { completed: number; total: number };
  results: QuoteResult[];
  createdAt: string;
  completedAt?: string;
  /** 2-letter state code the quote was run for (not PII) — drives state disclosures. */
  state: string;
}

export interface QuoteJobCreated {
  jobId: string;
  status: "queued";
  carrierCount: number;
  estimatedSeconds: number;
}

export interface AgentHours {
  weekdays: string;
  saturday: string;
  sunday: string;
}

export interface AgentEntry {
  id: string;
  name: string;
  address: string;
  city: string;
  zip: string;
  phone: string;
  lat: number;
  lng: number;
  hours: AgentHours;
  carriers: string[];
  languages: string[];
  sample: boolean;
  /** Miles from the searched ZIP centroid (1 decimal); null when not geocoded. */
  distance_mi: number | null;
  /** Data provenance: "google_places" → Live data badge, "sample" → Sample data badge. */
  source: "google_places" | "sample";
}

export interface AgentsResponse {
  state: string;
  zip: string | null;
  geocoded: boolean;
  note: string | null;
  agents: AgentEntry[];
}

export type CoverageChannel = "direct" | "agent";

export interface CarrierEntry {
  id: string;
  name: string;
  channel: CoverageChannel;
  statesServed: string[];
  logo: string;
  quotable: boolean;
  notes?: string;
  available?: boolean;
  /** Carrier homepage domain (no protocol), for honest "quote direct" links. */
  website?: string;
}

export interface CarriersResponse {
  state: string;
  carriers: CarrierEntry[];
  note?: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; requestId: string };
}

/** Per-state consumer-education notes from GET /api/disclosures/:state. */
export interface StateDisclosureNote {
  title: string;
  body: string;
}

/** State-mandated minimum auto coverage, where QuotePilot has verified data.
 *  Only present for states in data/disclosures/<STATE>.json that carry it —
 *  never guessed. pip is null where the state requires no PIP. */
export interface StateMinCoverage {
  biPerPerson: number;
  biPerAccident: number;
  propertyDamage: number;
  pip: number | null;
  notes: string;
  verified: string;
}

export interface StateDisclosures {
  state: string;
  stateName: string;
  notes: StateDisclosureNote[];
  sources: string[];
  updated: string;
  educationalOnly: boolean;
  minCoverage?: StateMinCoverage;
}

/* Agent-mediated quote requests (v0.11.0 "Real quotes"). Mirrors
 * packages/shared — the user picks licensed agents; the agents reply with
 * REAL quotes. QuotePilot never claims to generate these itself. */

export type QuoteRequestDeliveryMethod = "emailed" | "handoff";

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
  handoffCard?: QuoteRequestHandoffCard;
}

export interface QuoteRequestContact {
  name: string;
  email: string;
  phone: string;
}

export interface CreateQuoteRequestInput {
  jobId: string;
  agentIds: string[];
  contact: QuoteRequestContact;
  consent: boolean;
}

export interface CreateQuoteRequestResponse {
  refCode: string;
  deliveries: QuoteRequestDelivery[];
  message: string;
}
