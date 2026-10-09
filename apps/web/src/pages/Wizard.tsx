import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Seo } from "../components/Seo";
import { Field, SelectField, TextField, STATE_OPTIONS } from "../components/fields";
import { api, ApiError } from "../lib/api";
import { useAnalytics } from "../lib/analytics";
import type { CoverageInput, VehicleInput } from "../lib/types";
import {
  STEP_TITLES,
  ageFromDob,
  blankDriver,
  clearWizardData,
  defaultWizardData,
  loadWizardData,
  sampleWizardData,
  saveWizardData,
  toQuoteRequest,
  validateStep,
  type FieldErrors,
  type MaritalStatus,
  type WizardData,
  type WizardDriver,
} from "../lib/wizard";
import {
  EMAIL_MAX,
  MAKE_MAX,
  MODEL_MAX,
  NAME_MAX,
  STREET_MAX,
  TRIM_MAX,
  ZIP_LEN,
  validateField,
} from "../lib/validation";
import { MinCoverageHint } from "../components/StateDisclosurePanel";

/* ---------------- helpers ---------------- */

function updateAt<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  return arr.map((item, idx) => (idx === i ? { ...item, ...patch } : item));
}

function parseIntSafe(v: string, fallback = 0): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const fmtLimit = (n: number) => (n === 0 ? "None" : `$${(n / 1000).toLocaleString()}k`);
const fmtMoney = (n: number) => `$${n.toLocaleString()}`;

const todayISO = (() => {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
})();

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "nonbinary", label: "Nonbinary" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const MARITAL_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
];

const COUNT_OPTIONS = [
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5 or more" },
];

const VEHICLE_MAKES = [
  "Toyota", "Honda", "Ford", "Chevrolet", "Nissan", "Hyundai", "Kia", "Subaru",
  "Mazda", "Volkswagen", "BMW", "Mercedes-Benz", "Audi", "Lexus", "Tesla", "Jeep",
  "Ram", "GMC", "Dodge", "Chrysler", "Volvo", "Porsche", "Cadillac", "Acura",
  "Infiniti", "Other",
];

const YEAR_OPTIONS = (() => {
  const top = new Date().getFullYear() + 1;
  const years: number[] = [];
  for (let y = top; y >= 1995; y--) years.push(y);
  return years;
})();

const LIMIT_OPTIONS = [25000, 50000, 100000, 250000, 500000];
const MEDPAY_OPTIONS = [0, 1000, 2000, 5000, 10000, 25000];
const DEDUCTIBLE_OPTIONS = [250, 500, 1000, 2500];

/* ---------------- step 1: location ---------------- */

function StepLocation({
  data,
  setContact,
  errors,
  onBlurField,
}: {
  data: WizardData;
  setContact: (patch: Partial<WizardData["contact"]>) => void;
  errors: FieldErrors;
  onBlurField: (key: string) => void;
}) {
  return (
    <>
      <TextField
        id="wz-street"
        label="Street address"
        required
        autoComplete="street-address"
        placeholder="123 Main St"
        maxLength={STREET_MAX}
        showCount
        value={data.contact.streetAddress}
        onChange={(e) => setContact({ streetAddress: e.target.value })}
        onBlur={() => onBlurField("contact.streetAddress")}
        error={errors["contact.streetAddress"]}
        hint="Carriers use your garaging address to price the policy."
      />
      <div className="field-row">
        <SelectField
          id="wz-state"
          label="State"
          required
          value={data.contact.state}
          onChange={(v) => setContact({ state: v })}
          onBlur={() => onBlurField("contact.state")}
          error={errors["contact.state"]}
          hint="Carrier options and minimum coverage vary by state."
          options={STATE_OPTIONS}
        />
        <TextField
          id="wz-zip"
          label="ZIP code"
          required
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="\d{5}"
          maxLength={ZIP_LEN}
          placeholder="02139"
          value={data.contact.zip}
          onChange={(e) => setContact({ zip: e.target.value })}
          onBlur={() => onBlurField("contact.zip")}
          error={errors["contact.zip"]}
          hint="Used to match carriers and local agents in your area."
        />
      </div>
      <p className="field-hint" role="note" style={{ marginTop: "0.5rem" }}>
        QuotePilot is not a licensed insurance producer — we help you compare;
        carriers issue policies.
      </p>
    </>
  );
}

/* ---------------- step 2: drivers ---------------- */

function DriverCard({
  index,
  driver,
  onChange,
  onRemove,
  errors,
  removable,
  onBlurField,
}: {
  index: number;
  driver: WizardDriver;
  onChange: (patch: Partial<WizardDriver>) => void;
  onRemove: () => void;
  errors: FieldErrors;
  removable: boolean;
  onBlurField: (key: string) => void;
}) {
  const p = `drivers.${index}`;
  const age = ageFromDob(driver.dob);
  return (
    <fieldset className="driver-card">
      <legend className="sr-only">Driver {index + 1}</legend>
      <div className="driver-card-header">
        <h3 aria-hidden="true">Driver {index + 1}</h3>
        {removable && (
          <button type="button" className="btn-danger-ghost" onClick={onRemove}>
            Remove driver
          </button>
        )}
      </div>
      <div className="field-row">
        <TextField
          id={`wz-d${index}-first`}
          label="First name"
          required
          autoComplete="given-name"
          maxLength={NAME_MAX}
          showCount
          value={driver.firstName}
          onChange={(e) => onChange({ firstName: e.target.value })}
          onBlur={() => onBlurField(`${p}.firstName`)}
          error={errors[`${p}.firstName`]}
        />
        <TextField
          id={`wz-d${index}-last`}
          label="Last name"
          required
          autoComplete="family-name"
          maxLength={NAME_MAX}
          showCount
          value={driver.lastName}
          onChange={(e) => onChange({ lastName: e.target.value })}
          onBlur={() => onBlurField(`${p}.lastName`)}
          error={errors[`${p}.lastName`]}
        />
      </div>
      <div className="field-row">
        <TextField
          id={`wz-d${index}-dob`}
          label="Date of birth"
          required
          type="date"
          max={todayISO}
          autoComplete="bday"
          value={driver.dob}
          onChange={(e) => onChange({ dob: e.target.value })}
          onBlur={() => onBlurField(`${p}.dob`)}
          error={errors[`${p}.dob`]}
          hint={
            Number.isNaN(age)
              ? "We use this to compute your age for pricing."
              : `Age ${age} — derived from your date of birth for pricing.`
          }
        />
        <SelectField
          id={`wz-d${index}-gender`}
          label="Gender"
          value={driver.gender}
          onChange={(v) => onChange({ gender: v as WizardDriver["gender"] })}
          onBlur={() => onBlurField(`${p}.gender`)}
          options={GENDER_OPTIONS}
          hint="As listed on your driver's license."
        />
      </div>
      <div className="field-row">
        <SelectField
          id={`wz-d${index}-marital`}
          label="Marital status"
          value={driver.maritalStatus}
          onChange={(v) => onChange({ maritalStatus: v as MaritalStatus })}
          onBlur={() => onBlurField(`${p}.marital`)}
          options={MARITAL_OPTIONS}
          hint="Married drivers often qualify for lower rates."
        />
        <TextField
          id={`wz-d${index}-licensed`}
          label="Years licensed"
          required
          type="number"
          min={0}
          max={85}
          inputMode="numeric"
          value={driver.yearsLicensed}
          onChange={(e) => onChange({ yearsLicensed: parseIntSafe(e.target.value, 0) })}
          onBlur={() => onBlurField(`${p}.yearsLicensed`)}
          error={errors[`${p}.yearsLicensed`]}
        />
      </div>
      <div className="field-row">
        <SelectField
          id={`wz-d${index}-accidents`}
          label="Accidents in the last 5 years"
          value={String(Math.min(driver.accidentsLast5Years, 5))}
          onChange={(v) => onChange({ accidentsLast5Years: parseIntSafe(v, 0) })}
          onBlur={() => onBlurField(`${p}.accidentsLast5Years`)}
          options={COUNT_OPTIONS}
          hint="Any accident, at-fault or not."
          error={errors[`${p}.accidentsLast5Years`]}
        />
        <SelectField
          id={`wz-d${index}-violations`}
          label="Moving violations in the last 3 years"
          value={String(Math.min(driver.violationsLast3Years, 5))}
          onChange={(v) => onChange({ violationsLast3Years: parseIntSafe(v, 0) })}
          onBlur={() => onBlurField(`${p}.violationsLast3Years`)}
          options={COUNT_OPTIONS}
          hint="Speeding tickets, red-light runs, etc."
          error={errors[`${p}.violationsLast3Years`]}
        />
      </div>
    </fieldset>
  );
}

function StepDrivers({
  data,
  setDrivers,
  errors,
  onBlurField,
}: {
  data: WizardData;
  setDrivers: (d: WizardDriver[]) => void;
  errors: FieldErrors;
  onBlurField: (key: string) => void;
}) {
  return (
    <>
      {data.drivers.map((d, i) => (
        <DriverCard
          key={i}
          index={i}
          driver={d}
          onChange={(patch) => setDrivers(updateAt(data.drivers, i, patch))}
          onRemove={() => setDrivers(data.drivers.filter((_, idx) => idx !== i))}
          errors={errors}
          removable={data.drivers.length > 1}
          onBlurField={onBlurField}
        />
      ))}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setDrivers([...data.drivers, blankDriver()])}
      >
        + Add another driver
      </button>
    </>
  );
}

/* ---------------- step 3: vehicle ---------------- */

function StepVehicle({
  data,
  setVehicles,
  errors,
  onBlurField,
}: {
  data: WizardData;
  setVehicles: (v: VehicleInput[]) => void;
  errors: FieldErrors;
  onBlurField: (key: string) => void;
}) {
  const v = data.vehicles[0];
  const p = "vehicles.0";
  const makeIsCustom = v.make !== "" && !VEHICLE_MAKES.includes(v.make);
  const makeSelectValue = v.make === "" ? "" : makeIsCustom ? "Other" : v.make;
  return (
    <>
      <div className="field-row">
        <SelectField
          id="wz-year"
          label="Year"
          required
          value={String(v.year)}
          onChange={(val) => setVehicles(updateAt(data.vehicles, 0, { year: parseIntSafe(val, 0) }))}
          options={YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) }))}
          error={errors[`${p}.year`]}
        />
        <div>
          <SelectField
            id="wz-make"
            label="Make"
            required
            placeholder="Select make"
            value={makeSelectValue}
            onChange={(val) => {
              if (val === "Other") {
                if (!makeIsCustom) setVehicles(updateAt(data.vehicles, 0, { make: "" }));
              } else {
                setVehicles(updateAt(data.vehicles, 0, { make: val }));
              }
            }}
            options={VEHICLE_MAKES.map((m) => ({ value: m, label: m }))}
            error={errors[`${p}.make`]}
          />
          {makeSelectValue === "Other" && (
            <TextField
              id="wz-make-other"
              label="Specify make"
              required
              placeholder="e.g. Saab"
              autoComplete="off"
              maxLength={MAKE_MAX}
              showCount
              value={makeIsCustom ? v.make : ""}
              onChange={(e) => setVehicles(updateAt(data.vehicles, 0, { make: e.target.value }))}
              onBlur={() => onBlurField(`${p}.make`)}
              error={errors[`${p}.make`]}
            />
          )}
        </div>
      </div>
      <div className="field-row">
        <TextField
          id="wz-model"
          label="Model"
          required
          placeholder="Model Y"
          autoComplete="off"
          maxLength={MODEL_MAX}
          showCount
          value={v.model}
          onChange={(e) => setVehicles(updateAt(data.vehicles, 0, { model: e.target.value }))}
          onBlur={() => onBlurField(`${p}.model`)}
          error={errors[`${p}.model`]}
        />
        <TextField
          id="wz-trim"
          label="Trim (optional)"
          placeholder="Long Range"
          autoComplete="off"
          maxLength={TRIM_MAX}
          showCount
          value={v.trim}
          onChange={(e) => setVehicles(updateAt(data.vehicles, 0, { trim: e.target.value }))}
          onBlur={() => onBlurField(`${p}.trim`)}
        />
      </div>
      <div className="field-row">
        <SelectField
          id="wz-ownership"
          label="Ownership"
          required
          value={v.ownership}
          onChange={(val) =>
            setVehicles(updateAt(data.vehicles, 0, { ownership: val as VehicleInput["ownership"] }))
          }
          options={[
            { value: "owned", label: "Owned outright" },
            { value: "financed", label: "Financed" },
            { value: "leased", label: "Leased" },
          ]}
        />
        <SelectField
          id="wz-usage"
          label="Primary use"
          required
          value={v.usage}
          onChange={(val) =>
            setVehicles(updateAt(data.vehicles, 0, { usage: val as VehicleInput["usage"] }))
          }
          options={[
            { value: "commute", label: "Commute" },
            { value: "pleasure", label: "Pleasure" },
            { value: "business", label: "Business" },
          ]}
        />
      </div>
      <div className="field-row">
        <div>
          <TextField
            id="wz-mileage"
            label="Annual mileage"
            required
            type="number"
            min={0}
            max={100000}
            step={500}
            inputMode="numeric"
            value={v.annualMileage}
            onChange={(e) =>
              setVehicles(updateAt(data.vehicles, 0, { annualMileage: parseIntSafe(e.target.value, 0) }))
            }
            onBlur={() => onBlurField(`${p}.annualMileage`)}
            error={errors[`${p}.annualMileage`]}
            hint="Your best estimate for the next 12 months."
          />
          <Field id="wz-mileage-slider" label="Adjust with slider">
            <input
              id="wz-mileage-slider"
              type="range"
              className="slider"
              min={0}
              max={60000}
              step={1000}
              value={Math.min(v.annualMileage, 60000)}
              onChange={(e) =>
                setVehicles(updateAt(data.vehicles, 0, { annualMileage: parseIntSafe(e.target.value, 0) }))
              }
              aria-valuetext={`${fmtMoney(v.annualMileage)} miles per year`}
              aria-label="Annual mileage slider"
            />
          </Field>
        </div>
        <TextField
          id="wz-garaged"
          label="Garaging ZIP"
          required
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="\d{5}"
          maxLength={ZIP_LEN}
          placeholder="02139"
          value={v.garagedZip}
          onChange={(e) => setVehicles(updateAt(data.vehicles, 0, { garagedZip: e.target.value }))}
          onBlur={() => onBlurField(`${p}.garagedZip`)}
          error={errors[`${p}.garagedZip`]}
          hint="Where the car sleeps at night."
        />
      </div>
      <TextField
        id="wz-vin4"
        label="Last 4 of VIN (optional)"
        inputMode="text"
        autoComplete="off"
        maxLength={4}
        placeholder="••••"
        value={v.vinLast4 ?? ""}
        onChange={(e) => setVehicles(updateAt(data.vehicles, 0, { vinLast4: e.target.value }))}
        onBlur={() => onBlurField(`${p}.vinLast4`)}
        error={errors[`${p}.vinLast4`]}
        hint="Helps carriers match the exact vehicle. Never the full VIN."
      />
    </>
  );
}

/* ---------------- step 4: coverage ---------------- */

function LimitSelect({
  id,
  label,
  value,
  onChange,
  options,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  options: number[];
  hint?: string;
}) {
  return (
    <SelectField
      id={id}
      label={label}
      value={String(value)}
      onChange={(v) => onChange(parseInt(v, 10))}
      hint={hint}
      options={options.map((n) => ({ value: String(n), label: fmtLimit(n) }))}
    />
  );
}

function DeductibleSelect({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <SelectField
      id={id}
      label={label}
      value={String(value)}
      onChange={(v) => onChange(parseInt(v, 10))}
      hint={hint}
      options={DEDUCTIBLE_OPTIONS.map((n) => ({ value: String(n), label: fmtMoney(n) }))}
    />
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <div className="field">
      <label className="toggle" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <span className="toggle-track" aria-hidden="true">
          <span className="toggle-thumb" />
        </span>
        <span>{label}</span>
      </label>
      {hint && (
        <div className="field-hint" id={`${id}-hint`}>
          {hint}
        </div>
      )}
    </div>
  );
}

function StepCoverage({
  data,
  setCoverage,
  errors,
}: {
  data: WizardData;
  setCoverage: (patch: Partial<CoverageInput>) => void;
  errors: FieldErrors;
}) {
  const c = data.coverage;
  return (
    <>
      <MinCoverageHint state={data.contact.state} />
      <div className="field-row">
        <LimitSelect
          id="wz-bi-person"
          label="Bodily injury — per person"
          value={c.bodilyInjuryPerPerson}
          onChange={(n) => setCoverage({ bodilyInjuryPerPerson: n })}
          options={LIMIT_OPTIONS}
        />
        <LimitSelect
          id="wz-bi-accident"
          label="Bodily injury — per accident"
          value={c.bodilyInjuryPerAccident}
          onChange={(n) => setCoverage({ bodilyInjuryPerAccident: n })}
          options={LIMIT_OPTIONS}
        />
      </div>
      {errors["coverage.bi"] && (
        <div className="field-error" role="alert" style={{ marginBottom: "1rem" }}>
          {errors["coverage.bi"]}
        </div>
      )}
      <div className="field-row">
        <LimitSelect
          id="wz-pd"
          label="Property damage"
          value={c.propertyDamage}
          onChange={(n) => setCoverage({ propertyDamage: n })}
          options={LIMIT_OPTIONS}
        />
        <LimitSelect
          id="wz-medpay"
          label="Medical payments"
          value={c.medicalPayments}
          onChange={(n) => setCoverage({ medicalPayments: n })}
          options={MEDPAY_OPTIONS}
          hint="Covers medical bills for you and passengers, regardless of fault."
        />
      </div>
      <div className="field-row">
        <LimitSelect
          id="wz-um-person"
          label="Uninsured motorist — per person"
          value={c.uninsuredMotoristPerPerson}
          onChange={(n) => setCoverage({ uninsuredMotoristPerPerson: n })}
          options={LIMIT_OPTIONS}
        />
        <LimitSelect
          id="wz-um-accident"
          label="Uninsured motorist — per accident"
          value={c.uninsuredMotoristPerAccident}
          onChange={(n) => setCoverage({ uninsuredMotoristPerAccident: n })}
          options={LIMIT_OPTIONS}
        />
      </div>
      {errors["coverage.um"] && (
        <div className="field-error" role="alert" style={{ marginBottom: "1rem" }}>
          {errors["coverage.um"]}
        </div>
      )}
      <div className="field-row">
        <DeductibleSelect
          id="wz-coll-ded"
          label="Collision deductible"
          value={c.collisionDeductible}
          onChange={(n) => setCoverage({ collisionDeductible: n })}
          hint="What you pay out of pocket before collision coverage kicks in."
        />
        <DeductibleSelect
          id="wz-comp-ded"
          label="Comprehensive deductible"
          value={c.comprehensiveDeductible}
          onChange={(n) => setCoverage({ comprehensiveDeductible: n })}
          hint="Covers theft, glass, weather, and animal damage."
        />
      </div>
      <ToggleRow
        id="wz-rental"
        label="Rental reimbursement"
        hint="Pays for a rental car while yours is being repaired."
        checked={c.rentalReimbursement}
        onChange={(b) => setCoverage({ rentalReimbursement: b })}
      />
      <ToggleRow
        id="wz-roadside"
        label="Roadside assistance"
        hint="Towing, jump-starts, lockouts, and flat tires."
        checked={c.roadsideAssistance}
        onChange={(b) => setCoverage({ roadsideAssistance: b })}
      />
    </>
  );
}

/* ---------------- step 5: contact ---------------- */

function StepContact({
  data,
  setContact,
  setConsent,
  setPhoneConsent,
  errors,
  onBlurField,
}: {
  data: WizardData;
  setContact: (patch: Partial<WizardData["contact"]>) => void;
  setConsent: (b: boolean) => void;
  setPhoneConsent: (b: boolean) => void;
  errors: FieldErrors;
  onBlurField: (key: string) => void;
}) {
  return (
    <>
      <TextField
        id="wz-email"
        label="Email"
        required
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        maxLength={EMAIL_MAX}
        showCount
        value={data.contact.email}
        onChange={(e) => setContact({ email: e.target.value })}
        onBlur={() => onBlurField("contact.email")}
        error={errors["contact.email"]}
        hint="Quotes are delivered here when they're ready."
      />
      <TextField
        id="wz-phone"
        label="Phone"
        required
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        maxLength={20}
        placeholder="(555) 010-0199"
        value={data.contact.phone}
        onChange={(e) => setContact({ phone: e.target.value })}
        onBlur={() => onBlurField("contact.phone")}
        error={errors["contact.phone"]}
        hint="Only used if a carrier needs to reach you about your quote. We never call or text for marketing — ever."
      />
      <div className="field">
        <label className="check-row" htmlFor="wz-consent">
          <input
            id="wz-consent"
            type="checkbox"
            checked={data.consentEmail}
            onChange={(e) => setConsent(e.target.checked)}
            aria-describedby={errors["consentEmail"] ? "wz-consent-error" : "wz-consent-hint"}
            aria-invalid={errors["consentEmail"] ? true : undefined}
          />
          <span>
            Yes, email me my quotes when they're ready.{" "}
            <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </span>
        </label>
        <div className="field-hint" id="wz-consent-hint">
          No spam, no selling your info — just your quotes. See our{" "}
          <Link to="/privacy">Privacy Policy</Link> for how your information is used.
        </div>
        {errors["consentEmail"] && (
          <div className="field-error" id="wz-consent-error" role="alert">
            {errors["consentEmail"]}
          </div>
        )}
      </div>
      {/* TCPA express-written-consent: optional, UNCHECKED by default, never
          pre-checked programmatically (COMPLIANCE.md §3). */}
      <div className="field">
        <label className="check-row" htmlFor="wz-consent-phone">
          <input
            id="wz-consent-phone"
            type="checkbox"
            checked={data.consentPhone}
            onChange={(e) => setPhoneConsent(e.target.checked)}
            aria-describedby="wz-consent-phone-hint"
          />
          <span>
            Yes — I give my express written consent for QuotePilot and the
            insurance carriers and licensed agents shown with my quotes to call
            or text me at the phone number I entered about my quotes and
            insurance options, including with automated dialing or prerecorded
            messages. <strong>Consent is not a condition of getting quotes or
            purchasing insurance.</strong> Message and data rates may apply.
          </span>
        </label>
        <div className="field-hint" id="wz-consent-phone-hint">
          Optional — leave this unchecked if you&apos;d rather not be contacted
          by phone.
        </div>
      </div>
    </>
  );
}

/* ---------------- page ---------------- */

const STEP_SUBS = [
  "Where should we look for carriers?",
  "Who will be driving?",
  "Tell us about the car.",
  "Pick the protection that fits.",
  "Where should we send your quotes?",
];

export function Wizard() {
  const initial = useMemo(() => {
    const saved = loadWizardData();
    return { data: saved ?? defaultWizardData(), hadSaved: saved !== null };
  }, []);
  const [data, setData] = useState<WizardData>(initial.data);
  const [showResume, setShowResume] = useState(initial.hadSaved);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const track = useAnalytics("wizard");
  const navigate = useNavigate();

  // Persist as the user types.
  useEffect(() => {
    saveWizardData(data);
  }, [data]);

  // Focus management: heading gets focus on every step change.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const setContact = (patch: Partial<WizardData["contact"]>) =>
    applyData({ ...data, contact: { ...data.contact, ...patch } });
  const setDrivers = (drivers: WizardDriver[]) => applyData({ ...data, drivers });
  const setVehicles = (vehicles: VehicleInput[]) => applyData({ ...data, vehicles });
  const setCoverage = (patch: Partial<CoverageInput>) =>
    applyData({ ...data, coverage: { ...data.coverage, ...patch } });

  /**
   * Re-validate any fields currently showing errors whenever data changes,
   * so an error clears the moment the field becomes valid — no waiting for
   * the next Continue click.
   */
  function applyData(next: WizardData) {
    setData(next);
    setErrors((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      const nextErrs: FieldErrors = { ...prev };
      let changed = false;
      for (const k of keys) {
        const msg = validateField(k, next);
        if (!msg && nextErrs[k]) {
          delete nextErrs[k];
          changed = true;
        } else if (msg && nextErrs[k] !== msg) {
          nextErrs[k] = msg;
          changed = true;
        }
      }
      return changed ? nextErrs : prev;
    });
  }

  /** Validate a single field on blur — instant, specific feedback. */
  const handleBlur = (key: string) => {
    const msg = validateField(key, data);
    setErrors((prev) => {
      if (!msg) {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key] === msg) return prev;
      return { ...prev, [key]: msg };
    });
  };

  const announceErrors = (errs: FieldErrors) => {
    const count = Object.keys(errs).length;
    if (liveRef.current) {
      liveRef.current.textContent =
        count === 0
          ? ""
          : `${count} problem${count > 1 ? "s" : ""} to fix: ${Object.values(errs).join(" ")}`;
    }
  };

  const goNext = () => {
    const errs = validateStep(step, data);
    setErrors(errs);
    announceErrors(errs);
    if (Object.keys(errs).length > 0) {
      headingRef.current?.focus();
      return;
    }
    track("wizard_step_completed", { metadata: { step: step + 1 } });
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
  };

  const goBack = () => {
    setErrors({});
    announceErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const fillSample = () => {
    setData(sampleWizardData());
    setErrors({});
    track("cta_clicked", { element: "wizard_sample_fill" });
    headingRef.current?.focus();
  };

  const submit = async () => {
    const errs = validateStep(STEP_TITLES.length - 1, data);
    setErrors(errs);
    announceErrors(errs);
    if (Object.keys(errs).length > 0) {
      headingRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const job = await api.createQuoteJob(toQuoteRequest(data));
      track("quote_job_created", { metadata: { carriers: job.carrierCount } });
      clearWizardData();
      navigate(`/quotes/${encodeURIComponent(job.jobId)}`);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `Something went wrong on our side (${e.code}). Please try again in a moment.`
          : "We couldn't reach the quote service. Check your connection and try again.";
      setSubmitError(msg);
      liveRef.current && (liveRef.current.textContent = msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isLast = step === STEP_TITLES.length - 1;

  return (
    <div className="page">
      <Seo
        title="Get car insurance quotes — QuotePilot"
        description="Answer a few quick questions and QuotePilot gathers car insurance quotes from every carrier in your state. Simulated demo pricing, delivered by email."
        path="/quote"
      />
      <div className="container wizard-shell">
        {showResume && (
          <div className="glass resume-banner" role="status">
            <div>
              <strong>Resume where you left off.</strong>
              <div className="field-hint">We saved your answers from your last visit.</div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowResume(false); }}>
                Continue
              </button>
              <button
                type="button"
                className="btn-danger-ghost"
                onClick={() => {
                  setData(defaultWizardData());
                  setShowResume(false);
                  track("cta_clicked", { element: "wizard_start_over" });
                }}
              >
                Start over
              </button>
            </div>
          </div>
        )}

        <div className="progress-wrap" aria-hidden="true">
          <ol className="step-indicator">
            {STEP_TITLES.map((t, i) => (
              <li key={t} aria-current={i === step ? "step" : undefined}>
                {i + 1}. {t}
              </li>
            ))}
          </ol>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
            />
          </div>
        </div>
        <p className="sr-only" role="status">
          Step {step + 1} of {STEP_TITLES.length}: {STEP_TITLES[step]}
        </p>

        <div className="glass wizard-card">
          <div ref={liveRef} className="sr-only" role="status" aria-live="polite" />
          <h1 ref={headingRef} tabIndex={-1} className="wizard-step-title">
            {STEP_TITLES[step]}
          </h1>
          <p className="wizard-step-sub">{STEP_SUBS[step]}</p>

          {step === 0 && <StepLocation data={data} setContact={setContact} errors={errors} onBlurField={handleBlur} />}
          {step === 1 && <StepDrivers data={data} setDrivers={setDrivers} errors={errors} onBlurField={handleBlur} />}
          {step === 2 && <StepVehicle data={data} setVehicles={setVehicles} errors={errors} onBlurField={handleBlur} />}
          {step === 3 && <StepCoverage data={data} setCoverage={setCoverage} errors={errors} />}
          {step === 4 && (
            <StepContact
              data={data}
              setContact={setContact}
              setConsent={(b) => applyData({ ...data, consentEmail: b })}
              setPhoneConsent={(b) => applyData({ ...data, consentPhone: b })}
              errors={errors}
              onBlurField={handleBlur}
            />
          )}

          {submitError && (
            <div className="alert alert-error" role="alert">
              {submitError}
            </div>
          )}

          <div className="wizard-nav">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={goBack}
              disabled={step === 0 || submitting}
            >
              ← Back
            </button>
            {isLast ? (
              <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={submitting}>
                {submitting ? "Sending…" : "Get my quotes →"}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={goNext}>
                Continue →
              </button>
            )}
          </div>
        </div>

        <p className="demo-note">
          In a hurry?{" "}
          <button
            type="button"
            className="btn-danger-ghost"
            style={{ color: "var(--accent-strong)", borderColor: "var(--accent-soft)" }}
            onClick={fillSample}
          >
            Try with sample data
          </button>{" "}
          — one click fills the whole form with a demo profile.
        </p>
      </div>
    </div>
  );
}
