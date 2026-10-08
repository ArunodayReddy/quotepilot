import type { InputHTMLAttributes, ReactNode } from "react";
import { Select } from "./Select";

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR",
  "PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

/** Full state names for Apple-grade dropdowns (industry standard: show the name, store the code). */
export const STATE_OPTIONS: { value: string; label: string }[] = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" }, { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" }, { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" }, { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" }, { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" }, { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" }, { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" }, { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" }, { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" }, { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" }, { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" }, { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" }, { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" }, { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" }, { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" }, { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" }, { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
];

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Label + error + hint wrapper. Error is announced via the shared aria-live region. */
export function Field({ id, label, required, error, hint, children }: FieldShellProps) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {required && <span aria-hidden="true"> *</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>
      {children}
      {hint && !error && <div className="field-hint" id={`${id}-hint`}>{hint}</div>}
      {error && (
        <div className="field-error" id={`${id}-error`} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

export function TextField({ id, label, error, hint, required, ...input }: TextFieldProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint} required={required}>
      <input
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        required={required}
        {...input}
      />
    </Field>
  );
}

type SelectFieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
};

/**
 * Accessible custom dropdown (button + listbox). Value-based onChange —
 * call sites receive the selected option value directly.
 */
export function SelectField({
  id,
  label,
  error,
  hint,
  required,
  placeholder,
  disabled,
  value,
  onChange,
  options,
}: SelectFieldProps) {
  return (
    <Select
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      required={required}
      error={error}
      hint={hint}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
