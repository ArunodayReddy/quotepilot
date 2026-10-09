/* Wizard state: defaults, sample profile, validation, localStorage persistence. */
import type {
  ContactInput,
  CoverageInput,
  DriverInput,
  QuoteRequest,
  VehicleInput,
} from "../lib/types";

export const WIZARD_STORAGE_KEY = "quotepilot.wizard.v3";

import { ageFromDob, isFutureDob, validateField, validateStep, stepFieldKeys } from "./validation";
export { ageFromDob, isFutureDob, validateField, validateStep, stepFieldKeys };
export type { FieldErrors } from "./validation";

export const STEP_TITLES = [
  "Location",
  "Drivers",
  "Vehicle",
  "Coverage",
  "Contact",
] as const;

export type MaritalStatus = "single" | "married" | "divorced" | "widowed";

/**
 * Wizard-side driver: carries a date of birth (industry-standard field) and
 * marital status. Age is derived from the DOB at submit time so the API
 * contract (which takes `age`) never changes.
 */
export interface WizardDriver extends Omit<DriverInput, "age"> {
  dob: string; // YYYY-MM-DD
  maritalStatus: MaritalStatus;
}

export interface WizardContact extends ContactInput {
  streetAddress: string;
}

export interface WizardData {
  contact: WizardContact;
  drivers: WizardDriver[];
  vehicles: VehicleInput[];
  coverage: CoverageInput;
  /** Quote-ready email consent (required to deliver quotes by email). */
  consentEmail: boolean;
  /**
   * TCPA express-written consent for marketing calls/texts. MUST default to
   * false and stay unchecked until the user clicks it (see COMPLIANCE.md §3).
   */
  consentPhone: boolean;
}

export function blankDriver(): WizardDriver {
  return {
    firstName: "",
    lastName: "",
    dob: "",
    gender: "prefer_not_to_say",
    maritalStatus: "single",
    yearsLicensed: 5,
    accidentsLast5Years: 0,
    violationsLast3Years: 0,
  };
}

export function blankVehicle(): VehicleInput {
  return {
    year: 2022,
    make: "",
    model: "",
    trim: "",
    ownership: "owned",
    usage: "commute",
    annualMileage: 12000,
    garagedZip: "",
    vinLast4: "",
  };
}

export function defaultWizardData(): WizardData {
  return {
    contact: { email: "", phone: "", state: "MA", zip: "", streetAddress: "" },
    drivers: [blankDriver()],
    vehicles: [blankVehicle()],
    coverage: {
      bodilyInjuryPerPerson: 50000,
      bodilyInjuryPerAccident: 100000,
      propertyDamage: 50000,
      uninsuredMotoristPerPerson: 50000,
      uninsuredMotoristPerAccident: 100000,
      medicalPayments: 5000,
      collisionDeductible: 500,
      comprehensiveDeductible: 500,
      rentalReimbursement: false,
      roadsideAssistance: true,
    },
    consentEmail: false,
    consentPhone: false,
  };
}

/** Masked sample profile for the one-click demo fill (from CONTEXT §6, placeholders only).
 *  DOBs are chosen so the derived ages match the original sample ages (31 and 29). */
export function sampleWizardData(): WizardData {
  return {
    contact: {
      email: "driver@example.com",
      phone: "555-010-0199",
      state: "MA",
      zip: "02139",
      streetAddress: "123 Sample St",
    },
    drivers: [
      { firstName: "Sample", lastName: "Driver", dob: "1995-04-22", gender: "prefer_not_to_say", maritalStatus: "single", yearsLicensed: 12, accidentsLast5Years: 0, violationsLast3Years: 0 },
      { firstName: "Sample", lastName: "Passenger", dob: "1997-02-10", gender: "prefer_not_to_say", maritalStatus: "married", yearsLicensed: 10, accidentsLast5Years: 0, violationsLast3Years: 0 },
    ],
    vehicles: [
      {
        year: 2024,
        make: "Tesla",
        model: "Model Y",
        trim: "Long Range",
        ownership: "owned",
        usage: "commute",
        annualMileage: 12000,
        garagedZip: "02139",
        vinLast4: "",
      },
    ],
    coverage: {
      bodilyInjuryPerPerson: 50000,
      bodilyInjuryPerAccident: 100000,
      propertyDamage: 50000,
      uninsuredMotoristPerPerson: 50000,
      uninsuredMotoristPerAccident: 100000,
      medicalPayments: 5000,
      collisionDeductible: 500,
      comprehensiveDeductible: 500,
      rentalReimbursement: false,
      roadsideAssistance: true,
    },
    consentEmail: true,
    // Sample stays TCPA-clean: phone consent must never be pre-checked.
    consentPhone: false,
  };
}

export function loadWizardData(): WizardData | null {
  try {
    const raw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WizardData;
    if (!parsed || !parsed.contact || !Array.isArray(parsed.drivers)) return null;
    return { ...defaultWizardData(), ...parsed };
  } catch {
    return null;
  }
}

/**
 * Shared helper: read the quote's { state, zip } from wizard localStorage.
 * Used by the results page ("agents near {ZIP}") and the agents page
 * ("use my quote ZIP"). Returns null when nothing usable is stored.
 */
export function readQuoteLocation(): { state: string; zip: string } | null {
  try {
    const data = loadWizardData();
    const state = data?.contact?.state?.trim().toUpperCase() ?? "";
    const zip = data?.contact?.zip?.trim() ?? "";
    if (!/^[A-Z]{2}$/.test(state) || !/^\d{5}$/.test(zip)) return null;
    return { state, zip };
  } catch {
    return null;
  }
}

export function saveWizardData(data: WizardData): void {
  try {
    window.localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage may be unavailable; wizard still works in-memory */
  }
}

export function clearWizardData(): void {
  try {
    window.localStorage.removeItem(WIZARD_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Assemble the API payload from wizard data.
 *  Age is derived from the DOB so the API contract never changes; marital
 *  status and street address are form-parity fields the simulation doesn't
 *  price on yet (real adapters will consume them later). */
export function toQuoteRequest(data: WizardData): QuoteRequest {
  return {
    contact: {
      email: data.contact.email.trim(),
      phone: data.contact.phone.trim(),
      state: data.contact.state,
      zip: data.contact.zip.trim(),
    },
    drivers: data.drivers.map((d) => ({
      firstName: d.firstName.trim(),
      lastName: d.lastName.trim(),
      age: ageFromDob(d.dob),
      gender: d.gender,
      yearsLicensed: d.yearsLicensed,
      accidentsLast5Years: d.accidentsLast5Years,
      violationsLast3Years: d.violationsLast3Years,
    })),
    vehicles: data.vehicles.map((v) => ({
      year: v.year,
      make: v.make.trim(),
      model: v.model.trim(),
      trim: v.trim.trim(),
      ownership: v.ownership,
      usage: v.usage,
      annualMileage: v.annualMileage,
      garagedZip: v.garagedZip.trim(),
      ...(v.vinLast4?.trim() ? { vinLast4: v.vinLast4.trim() } : {}),
    })),
    coverage: { ...data.coverage },
    // Consent choices persist with the quote request (COMPLIANCE.md §3).
    emailOptIn: data.consentEmail,
    phoneOptIn: data.consentPhone,
  };
}
