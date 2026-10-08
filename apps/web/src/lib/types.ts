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
}

export interface QuoteJobCreated {
  jobId: string;
  status: "queued";
  carrierCount: number;
  estimatedSeconds: number;
}

export interface AgentEntry {
  name: string;
  city: string;
  phone: string;
  carriers: string[];
  languages: string[];
  sample: boolean;
}

export interface AgentsResponse {
  state: string;
  zip: string;
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
}

export interface CarriersResponse {
  state: string;
  carriers: CarrierEntry[];
  note?: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; requestId: string };
}
