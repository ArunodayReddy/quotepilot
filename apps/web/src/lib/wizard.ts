/* Wizard state: defaults, sample profile, validation, localStorage persistence. */
import type {
  ContactInput,
  CoverageInput,
  DriverInput,
  QuoteRequest,
  VehicleInput,
} from "../lib/types";

export const WIZARD_STORAGE_KEY = "quotepilot.wizard.v2";

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
  consentEmail: boolean;
}

/** Age in whole years from a YYYY-MM-DD date of birth. NaN when invalid. */
export function ageFromDob(dob: string, today: Date = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!m) return NaN;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return NaN;
  let age = today.getFullYear() - y;
  const hadBirthday =
    today.getMonth() > mo - 1 || (today.getMonth() === mo - 1 && today.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
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

export type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const PHONE_DIGITS_RE = /^\d{7,15}$/;
const NAME_RE = /^[A-Za-z][A-Za-z' -]{0,48}$/;
const VIN4_RE = /^[A-Za-z0-9]{4}$/;

export function validateStep(step: number, data: WizardData): FieldErrors {
  const errors: FieldErrors = {};
  if (step === 0) {
    if (!data.contact.state) errors["contact.state"] = "Pick your state so we can match carriers that serve it.";
    if (data.contact.streetAddress.trim().length < 5)
      errors["contact.streetAddress"] = "Enter your street address (e.g. 123 Main St).";
    if (!ZIP_RE.test(data.contact.zip.trim()))
      errors["contact.zip"] = "Enter a valid 5-digit ZIP code (e.g. 02139).";
  } else if (step === 1) {
    data.drivers.forEach((d, i) => {
      const p = `drivers.${i}`;
      if (!NAME_RE.test(d.firstName.trim()))
        errors[`${p}.firstName`] = `Driver ${i + 1}: enter a first name (letters, spaces, hyphens).`;
      if (!NAME_RE.test(d.lastName.trim()))
        errors[`${p}.lastName`] = `Driver ${i + 1}: enter a last name (letters, spaces, hyphens).`;
      const age = ageFromDob(d.dob);
      if (!d.dob || Number.isNaN(age))
        errors[`${p}.dob`] = `Driver ${i + 1}: enter a valid date of birth.`;
      else if (age < 16 || age > 100)
        errors[`${p}.dob`] = `Driver ${i + 1}: drivers must be between 16 and 100 years old.`;
      if (!Number.isInteger(d.yearsLicensed) || d.yearsLicensed < 0 || (!Number.isNaN(age) && d.yearsLicensed > age - 15))
        errors[`${p}.yearsLicensed`] = `Driver ${i + 1}: years licensed can't exceed age minus 15.`;
      if (!Number.isInteger(d.accidentsLast5Years) || d.accidentsLast5Years < 0 || d.accidentsLast5Years > 10)
        errors[`${p}.accidentsLast5Years`] = `Driver ${i + 1}: pick 0 to 5 or more.`;
      if (!Number.isInteger(d.violationsLast3Years) || d.violationsLast3Years < 0 || d.violationsLast3Years > 10)
        errors[`${p}.violationsLast3Years`] = `Driver ${i + 1}: pick 0 to 5 or more.`;
    });
  } else if (step === 2) {
    data.vehicles.forEach((v, i) => {
      const p = `vehicles.${i}`;
      const thisYear = new Date().getFullYear();
      if (!Number.isInteger(v.year) || v.year < 1980 || v.year > thisYear + 1)
        errors[`${p}.year`] = `Vehicle ${i + 1}: year must be between 1980 and ${thisYear + 1}.`;
      if (v.make.trim().length < 2) errors[`${p}.make`] = `Vehicle ${i + 1}: enter the make (e.g. Tesla).`;
      if (v.model.trim().length < 1) errors[`${p}.model`] = `Vehicle ${i + 1}: enter the model (e.g. Model Y).`;
      if (!Number.isInteger(v.annualMileage) || v.annualMileage < 0 || v.annualMileage > 100000)
        errors[`${p}.annualMileage`] = `Vehicle ${i + 1}: annual miles must be between 0 and 100,000.`;
      if (!ZIP_RE.test(v.garagedZip.trim()))
        errors[`${p}.garagedZip`] = `Vehicle ${i + 1}: enter a valid 5-digit garaging ZIP.`;
      if (v.vinLast4 && !VIN4_RE.test(v.vinLast4.trim()))
        errors[`${p}.vinLast4`] = `Vehicle ${i + 1}: VIN last-4 must be exactly 4 letters or digits — or leave it blank.`;
    });
  } else if (step === 3) {
    const c = data.coverage;
    if (c.bodilyInjuryPerAccident < c.bodilyInjuryPerPerson)
      errors["coverage.bi"] = "The per-accident bodily injury limit can't be lower than the per-person limit.";
    if (c.uninsuredMotoristPerAccident < c.uninsuredMotoristPerPerson)
      errors["coverage.um"] = "The per-accident uninsured-motorist limit can't be lower than the per-person limit.";
  } else if (step === 4) {
    if (!EMAIL_RE.test(data.contact.email.trim()))
      errors["contact.email"] = "Enter a valid email address — this is where quotes are sent.";
    const digits = data.contact.phone.replace(/\D/g, "");
    if (!PHONE_DIGITS_RE.test(digits))
      errors["contact.phone"] = "Enter a valid phone number (7–15 digits).";
    if (!data.consentEmail)
      errors["consentEmail"] = "Please check the box so we can email your quotes when they're ready.";
  }
  return errors;
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
  };
}
