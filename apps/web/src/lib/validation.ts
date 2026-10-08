/* Pure validation primitives for the wizard.
 *
 * SINGLE SOURCE OF TRUTH for client-side rules. Every regex and limit here
 * mirrors apps/api/src/lib/schemas.ts (zod) exactly — client/server drift is
 * a 400-class bug (see CONTEXT.md rule log: v0.3.0 gender-enum drift,
 * v0.5.1 ZIP/year/phone drift). If you change a rule here, change the zod
 * schema to match, and vice versa.
 *
 * Error messages follow the voice guide: human, specific, actionable.
 * Never "Invalid input". Never blame the user.
 */
import type { WizardData } from "./wizard";

/* ---------------- regexes & limits (mirror the zod schemas) ---------------- */

/** Server: /^\d{5}$/ — exactly 5 digits. ZIP+4 is NOT accepted by the API. */
export const ZIP_RE = /^\d{5}$/;
/** Server: /^[A-Z]{2}$/ */
export const STATE_RE = /^[A-Z]{2}$/;
/** Server: zod .email() (requires TLD ≥ 2 chars) */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Names: any Unicode letter first, then letters/spaces/hyphens/apostrophes/periods. */
export const NAME_RE = /^\p{L}[\p{L}'’. -]{0,49}$/u;
/** Server: /^[A-Za-z0-9]{4}$/ */
export const VIN4_RE = /^[A-Za-z0-9]{4}$/;
/** DOB format from <input type="date"> */
const DOB_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Server: email max 254 · phone raw 7–20 · names max 50 */
export const EMAIL_MAX = 254;
export const PHONE_RAW_MIN = 7;
export const PHONE_RAW_MAX = 20;
export const PHONE_DIGITS_MIN = 7;
export const PHONE_DIGITS_MAX = 15;
export const NAME_MAX = 50;
export const STREET_MAX = 100;
export const MAKE_MAX = 60;
export const MODEL_MAX = 60;
export const TRIM_MAX = 60;
export const ZIP_LEN = 5;

/** Server: driver age int 16–100 */
export const AGE_MIN = 16;
export const AGE_MAX = 100;
/** Server: yearsLicensed int 0–84 */
export const YEARS_LICENSED_MAX = 84;
/** Server: vehicle year int 1981–2027 */
export const YEAR_MIN = 1981;
export const YEAR_MAX = 2027;
/** Server: annualMileage int 0–100000 */
export const MILEAGE_MAX = 100000;
/** Server: accidents/violations int 0–10 (UI caps at "5 or more" → 5) */
export const COUNT_MAX = 10;

export type FieldErrors = Record<string, string>;

/** Age in whole years from a YYYY-MM-DD date of birth. NaN when invalid. */
export function ageFromDob(dob: string, today: Date = new Date()): number {
  const m = DOB_RE.exec(dob.trim());
  if (!m) return NaN;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  // Reject impossible calendar dates (Feb 30, month 13, …) — the date input
  // allows typing, not just picking.
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return NaN;
  let age = today.getFullYear() - y;
  const hadBirthday =
    today.getMonth() > mo - 1 || (today.getMonth() === mo - 1 && today.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}

/** True when the DOB string parses and is not in the future. */
export function isFutureDob(dob: string, today: Date = new Date()): boolean {
  const age = ageFromDob(dob, today);
  return !Number.isNaN(age) && age < 0;
}

/* ---------------- per-field validators ---------------- */

function driverLabel(i: number): string {
  return `Driver ${i + 1}`;
}
function vehicleLabel(i: number): string {
  return `Vehicle ${i + 1}`;
}

/**
 * Validate ONE field by key. Returns the human error message, or null when valid.
 * Keys mirror the FieldErrors map used by validateStep (e.g. "contact.zip",
 * "drivers.0.dob", "coverage.bi").
 */
export function validateField(key: string, data: WizardData): string | null {
  const c = data.contact;

  if (key === "contact.state") {
    if (!STATE_RE.test(c.state)) return "Pick your state so we can match carriers that serve it.";
    return null;
  }
  if (key === "contact.streetAddress") {
    const v = c.streetAddress.trim();
    if (v.length < 5) return "Enter your street address (e.g. 123 Main St).";
    if (v.length > STREET_MAX) return `Keep it under ${STREET_MAX} characters.`;
    return null;
  }
  if (key === "contact.zip") {
    if (!ZIP_RE.test(c.zip.trim())) return "Enter a valid 5-digit ZIP code (e.g. 02139).";
    return null;
  }
  if (key === "contact.email") {
    const v = c.email.trim();
    if (!v) return "Enter your email — this is where your quotes are sent.";
    if (v.length > EMAIL_MAX) return `Email addresses can't be longer than ${EMAIL_MAX} characters.`;
    if (!EMAIL_RE.test(v)) return "That email doesn't look right — check for typos (e.g. you@example.com).";
    return null;
  }
  if (key === "contact.phone") {
    const raw = c.phone.trim();
    const digits = raw.replace(/\D/g, "");
    if (raw.length < PHONE_RAW_MIN || raw.length > PHONE_RAW_MAX)
      return "Enter a phone number between 7 and 20 characters.";
    if (digits.length < PHONE_DIGITS_MIN || digits.length > PHONE_DIGITS_MAX)
      return "Enter a valid phone number (7–15 digits).";
    return null;
  }
  if (key === "consentEmail") {
    if (!data.consentEmail) return "Please check the box so we can email your quotes when they're ready.";
    return null;
  }

  const driverMatch = /^drivers\.(\d+)\.(firstName|lastName|dob|yearsLicensed|accidentsLast5Years|violationsLast3Years)$/.exec(key);
  if (driverMatch) {
    const i = Number(driverMatch[1]);
    const field = driverMatch[2];
    const d = data.drivers[i];
    if (!d) return null;
    const who = driverLabel(i);
    if (field === "firstName" || field === "lastName") {
      const v = (field === "firstName" ? d.firstName : d.lastName).trim();
      const noun = field === "firstName" ? "first name" : "last name";
      if (!v) return `${who}: enter a ${noun}.`;
      if (v.length > NAME_MAX) return `${who}: keep the ${noun} under ${NAME_MAX} characters.`;
      if (!NAME_RE.test(v))
        return `${who}: use only letters, spaces, hyphens and apostrophes for the ${noun}.`;
      return null;
    }
    if (field === "dob") {
      const age = ageFromDob(d.dob);
      if (!d.dob || Number.isNaN(age)) return `${who}: enter a valid date of birth.`;
      if (age < 0) return `${who}: that date can't be in the future.`;
      if (age < AGE_MIN || age > AGE_MAX)
        return `${who}: drivers must be between ${AGE_MIN} and ${AGE_MAX} years old.`;
      return null;
    }
    if (field === "yearsLicensed") {
      if (!Number.isInteger(d.yearsLicensed) || d.yearsLicensed < 0)
        return `${who}: enter 0 or more years licensed.`;
      if (d.yearsLicensed > YEARS_LICENSED_MAX)
        return `${who}: years licensed can't be more than ${YEARS_LICENSED_MAX}.`;
      const age = ageFromDob(d.dob);
      if (!Number.isNaN(age) && age >= 0 && d.yearsLicensed > age - 15)
        return `${who}: years licensed can't exceed age minus 15.`;
      return null;
    }
    if (field === "accidentsLast5Years" || field === "violationsLast3Years") {
      const v = field === "accidentsLast5Years" ? d.accidentsLast5Years : d.violationsLast3Years;
      if (!Number.isInteger(v) || v < 0 || v > COUNT_MAX) return `${who}: pick 0 to 5 or more.`;
      return null;
    }
  }

  const vehicleMatch = /^vehicles\.(\d+)\.(year|make|model|annualMileage|garagedZip|vinLast4)$/.exec(key);
  if (vehicleMatch) {
    const i = Number(vehicleMatch[1]);
    const field = vehicleMatch[2];
    const v = data.vehicles[i];
    if (!v) return null;
    const what = vehicleLabel(i);
    if (field === "year") {
      if (!Number.isInteger(v.year) || v.year < YEAR_MIN || v.year > YEAR_MAX)
        return `${what}: pick a model year between ${YEAR_MIN} and ${YEAR_MAX}.`;
      return null;
    }
    if (field === "make") {
      const val = v.make.trim();
      if (val.length < 2) return `${what}: enter the make (e.g. Tesla).`;
      if (val.length > MAKE_MAX) return `${what}: keep the make under ${MAKE_MAX} characters.`;
      return null;
    }
    if (field === "model") {
      const val = v.model.trim();
      if (!val) return `${what}: enter the model (e.g. Model Y).`;
      if (val.length > MODEL_MAX) return `${what}: keep the model under ${MODEL_MAX} characters.`;
      return null;
    }
    if (field === "annualMileage") {
      if (!Number.isInteger(v.annualMileage) || v.annualMileage < 0 || v.annualMileage > MILEAGE_MAX)
        return `${what}: annual miles must be between 0 and ${MILEAGE_MAX.toLocaleString()}.`;
      return null;
    }
    if (field === "garagedZip") {
      if (!ZIP_RE.test(v.garagedZip.trim())) return `${what}: enter a valid 5-digit garaging ZIP.`;
      return null;
    }
    if (field === "vinLast4") {
      const val = v.vinLast4?.trim() ?? "";
      if (val && !VIN4_RE.test(val))
        return `${what}: VIN last-4 must be exactly 4 letters or digits — or leave it blank.`;
      return null;
    }
  }

  if (key === "coverage.bi") {
    if (data.coverage.bodilyInjuryPerAccident < data.coverage.bodilyInjuryPerPerson)
      return "The per-accident bodily injury limit can't be lower than the per-person limit.";
    return null;
  }
  if (key === "coverage.um") {
    if (data.coverage.uninsuredMotoristPerAccident < data.coverage.uninsuredMotoristPerPerson)
      return "The per-accident uninsured-motorist limit can't be lower than the per-person limit.";
    return null;
  }

  return null;
}

/** All field keys validated on a given wizard step (0–4). */
export function stepFieldKeys(step: number, data: WizardData): string[] {
  if (step === 0) return ["contact.state", "contact.streetAddress", "contact.zip"];
  if (step === 1)
    return data.drivers.flatMap((_, i) => [
      `drivers.${i}.firstName`,
      `drivers.${i}.lastName`,
      `drivers.${i}.dob`,
      `drivers.${i}.yearsLicensed`,
      `drivers.${i}.accidentsLast5Years`,
      `drivers.${i}.violationsLast3Years`,
    ]);
  if (step === 2)
    return data.vehicles.flatMap((_, i) => [
      `vehicles.${i}.year`,
      `vehicles.${i}.make`,
      `vehicles.${i}.model`,
      `vehicles.${i}.annualMileage`,
      `vehicles.${i}.garagedZip`,
      `vehicles.${i}.vinLast4`,
    ]);
  if (step === 3) return ["coverage.bi", "coverage.um"];
  return ["contact.email", "contact.phone", "consentEmail"];
}

/** Validate a whole step. Same signature as before — now built on validateField. */
export function validateStep(step: number, data: WizardData): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of stepFieldKeys(step, data)) {
    const msg = validateField(key, data);
    if (msg) errors[key] = msg;
  }
  return errors;
}
