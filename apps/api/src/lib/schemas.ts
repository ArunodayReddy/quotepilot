/**
 * Zod validation schemas — one on every boundary.
 *
 * All schemas use the default "strip" behavior: unknown keys are removed
 * before the data reaches any service. PII validated here is never logged.
 */
import { z } from "zod";

const ZIP = z.string().regex(/^\d{5}$/, "must be a 5-digit ZIP");
const STATE = z.string().regex(/^[A-Z]{2}$/, "must be a 2-letter state code");

export const driverSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  age: z.number().int().min(16).max(100),
  gender: z.enum(["male", "female", "nonbinary", "other", "prefer_not_to_say"]),
  yearsLicensed: z.number().int().min(0).max(84),
  accidentsLast5Years: z.number().int().min(0).max(10),
  violationsLast3Years: z.number().int().min(0).max(10),
});

export const vehicleSchema = z.object({
  year: z.number().int().min(1981).max(2027),
  make: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
  trim: z.string().max(60).optional(),
  ownership: z.enum(["owned", "financed", "leased"]),
  usage: z.enum(["commute", "pleasure", "business", "rideshare"]),
  annualMileage: z.number().int().min(0).max(100000),
  garagedZip: ZIP,
  vinLast4: z.string().regex(/^[A-Za-z0-9]{4}$/, "must be 4 alphanumeric characters").optional(),
});

const nonNegInt = z.number().int().min(0);

export const coverageSchema = z.object({
  bodilyInjuryPerPerson: nonNegInt,
  bodilyInjuryPerAccident: nonNegInt,
  propertyDamage: nonNegInt,
  uninsuredMotoristPerPerson: nonNegInt,
  uninsuredMotoristPerAccident: nonNegInt,
  medicalPayments: nonNegInt,
  collisionDeductible: nonNegInt,
  comprehensiveDeductible: nonNegInt,
  rentalReimbursement: z.boolean(),
  roadsideAssistance: z.boolean(),
});

export const currentPolicySchema = z
  .object({
    carrier: z.string().max(80).optional(),
    currentPremium6Mo: z.number().min(0).optional(),
    policyNumber: z.string().max(60).optional(),
    renewalDate: z.string().max(20).optional(),
    termMonths: z.number().int().min(1).max(24).optional(),
  })
  .optional();

export const quoteRequestSchema = z.object({
  contact: z.object({
    email: z.string().email().max(254),
    phone: z.string().min(7).max(20),
    state: STATE,
    zip: ZIP,
  }),
  drivers: z.array(driverSchema).min(1).max(6),
  vehicles: z.array(vehicleSchema).min(1).max(4),
  coverage: coverageSchema,
  currentPolicy: currentPolicySchema,
  emailOptIn: z.boolean().optional().default(true),
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

export const analyticsEventSchema = z.object({
  event: z.string().min(1).max(100),
  page: z.string().min(1).max(200),
  element: z.string().max(200).optional(),
  sessionId: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});

export const emailNotifySchema = z.object({
  jobId: z.string().uuid(),
  email: z.string().email().max(254),
});

export const agentsQuerySchema = z.object({
  state: STATE,
  zip: ZIP.optional(),
});

export const jobIdParamSchema = z.object({
  jobId: z.string().uuid(),
});
