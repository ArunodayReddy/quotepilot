"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../lib/api";
import { useAnalytics } from "../lib/analytics";
import { loadWizardData } from "../lib/wizard";
import { SourceBadge } from "../views/Agents";
import type {
  AgentEntry,
  CreateQuoteRequestResponse,
  QuoteRequestContact,
} from "../lib/types";

const MAX_AGENTS = 3;

type Step = "select" | "confirm" | "sending" | "done" | "error";

function draftContact(): QuoteRequestContact | null {
  try {
    const data = loadWizardData();
    if (!data) return null;
    const driver = data.drivers[0];
    const name = driver ? `${driver.firstName} ${driver.lastName}`.trim() : "";
    const { email, phone } = data.contact;
    if (!name || !email || !phone) return null;
    return { name, email, phone };
  } catch {
    return null;
  }
}

/** Plain-text summary the user can paste into an agent's contact form. */
function buildCopyDetails(contact: QuoteRequestContact, agents: AgentEntry[], refCode: string): string {
  const data = loadWizardData();
  const lines = [
    `Quote request ${refCode} via QuotePilot`,
    ``,
    `Contact: ${contact.name} — ${contact.email} — ${contact.phone}`,
  ];
  if (data) {
    lines.push(``, `Drivers:`);
    data.drivers.forEach((d, i) => {
      lines.push(
        `  ${i + 1}. ${d.firstName} ${d.lastName}, licensed ${d.yearsLicensed}y` +
          (d.accidentsLast5Years > 0 ? `, ${d.accidentsLast5Years} accident(s)` : ", clean record"),
      );
    });
    lines.push(``, `Vehicles:`);
    data.vehicles.forEach((v, i) => {
      lines.push(`  ${i + 1}. ${v.year} ${v.make} ${v.model} (${v.ownership}, ${v.usage})`);
    });
    const c = data.coverage;
    lines.push(
      ``,
      `Coverage: BI ${c.bodilyInjuryPerPerson}/${c.bodilyInjuryPerAccident}, ` +
        `PD ${c.propertyDamage}, deductibles ${c.collisionDeductible}/${c.comprehensiveDeductible}`,
    );
  }
  lines.push(``, `Agencies: ${agents.map((a) => a.name).join("; ")}`);
  return lines.join("\n");
}

function AgentSelectCard({
  agent,
  checked,
  disabled,
  onToggle,
  index,
}: {
  agent: AgentEntry;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  index: number;
}) {
  return (
    <label className={`glass agent-select-card${checked ? " selected" : ""}`} htmlFor={`rq-agent-${agent.id}`}>
      <input
        id={`rq-agent-${agent.id}`}
        type="checkbox"
        checked={checked}
        disabled={disabled && !checked}
        onChange={onToggle}
        aria-describedby={`rq-agent-${agent.id}-meta`}
      />
      <span className="agent-select-body">
        <span className="agent-select-name">
          <span className="agent-rank" aria-hidden="true">{index + 1}</span> {agent.name}
        </span>
        <span id={`rq-agent-${agent.id}-meta`} className="field-hint">
          {agent.city} · {agent.phone}
          {agent.distance_mi != null && ` · ${agent.distance_mi.toFixed(1)} mi away`}
        </span>
        <SourceBadge source={agent.source} />
      </span>
    </label>
  );
}

export function RealQuoteRequest({ jobId, agents }: { jobId: string; agents: AgentEntry[] }) {
  const track = useAnalytics("quotes");
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [contact, setContact] = useState<QuoteRequestContact | null>(null);
  const [manualContact, setManualContact] = useState({ name: "", email: "", phone: "" });
  const [result, setResult] = useState<CreateQuoteRequestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    setContact(draftContact());
  }, []);

  useEffect(() => {
    if (!viewedRef.current) {
      viewedRef.current = true;
      track("real_quotes_view", { metadata: { agents: agents.length } });
    }
  }, [agents.length, track]);

  // Move focus to the step heading for screen-reader users.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const selectedAgents = useMemo(
    () => agents.filter((a) => selected.includes(a.id)),
    [agents, selected],
  );
  const effectiveContact: QuoteRequestContact | null = contact ?? (
    manualContact.name.trim() && /.+@.+\..+/.test(manualContact.email) && manualContact.phone.trim().length >= 7
      ? { name: manualContact.name.trim(), email: manualContact.email.trim(), phone: manualContact.phone.trim() }
      : null
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, MAX_AGENTS);
      if (!prev.includes(id)) track("real_quotes_agent_selected", { metadata: { count: next.length } });
      return next;
    });
  };

  const submit = async () => {
    if (!effectiveContact || selected.length === 0 || !consent) return;
    setStep("sending");
    setError(null);
    try {
      const res = await api.submitQuoteRequest({
        jobId,
        agentIds: selected,
        contact: effectiveContact,
        consent: true,
      });
      setResult(res);
      setStep("done");
      track("real_quotes_submitted", {
        metadata: {
          agents: selected.length,
          emailed: res.deliveries.filter((d) => d.method === "emailed").length,
        },
      });
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 429
          ? "You've sent several requests recently — please wait a bit before sending another."
          : e instanceof ApiError && e.code === "UNKNOWN_AGENTS"
            ? "One of the selected agencies is no longer listed. Please pick again."
            : "We couldn't send your request. Please try again.";
      setError(msg);
      setStep("error");
    }
  };

  const copyDetails = async () => {
    if (!result || !effectiveContact) return;
    try {
      await navigator.clipboard.writeText(buildCopyDetails(effectiveContact, selectedAgents, result.refCode));
      setCopied(true);
      track("real_quotes_copy_details");
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-labelledby="real-quotes-title" className="real-quotes">
      <h2 id="real-quotes-title" className="section-heading-sm" ref={headingRef} tabIndex={-1}>
        Want real numbers? These licensed agents will quote you for real.
      </h2>
      <p className="section-sub">
        Pick up to {MAX_AGENTS} agencies. We send them your details once — they reply with{" "}
        <strong>actual quotes</strong>, not estimates. QuotePilot doesn&apos;t set prices; the agents do.
      </p>

      {step === "select" && (
        <>
          <fieldset className="agent-select-grid">
            <legend className="sr-only">Choose up to {MAX_AGENTS} agencies</legend>
            {agents.slice(0, 6).map((a, i) => (
              <AgentSelectCard
                key={a.id}
                agent={a}
                index={i}
                checked={selected.includes(a.id)}
                disabled={selected.length >= MAX_AGENTS}
                onToggle={() => toggle(a.id)}
              />
            ))}
          </fieldset>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selected.length === 0}
            onClick={() => setStep("confirm")}
          >
            Continue with {selected.length} {selected.length === 1 ? "agency" : "agencies"} →
          </button>
        </>
      )}

      {step === "confirm" && (
        <div className="glass real-quotes-panel">
          <h3 className="section-heading-sm">Review and send</h3>
          <p className="section-sub">
            Requesting quotes from: <strong>{selectedAgents.map((a) => a.name).join(", ")}</strong>
          </p>

          {contact ? (
            <div className="contact-summary">
              <dl>
                <div><dt>Name</dt><dd>{contact.name}</dd></div>
                <div><dt>Email</dt><dd>{contact.email}</dd></div>
                <div><dt>Phone</dt><dd>{contact.phone}</dd></div>
              </dl>
              <Link href="/quote" className="btn btn-secondary btn-sm">
                Edit in wizard →
              </Link>
            </div>
          ) : (
            <div className="contact-manual">
              <p className="field-hint">We couldn&apos;t find your saved details — enter them here:</p>
              <label className="field">
                <span>Full name</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={manualContact.name}
                  onChange={(e) => setManualContact({ ...manualContact, name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={manualContact.email}
                  onChange={(e) => setManualContact({ ...manualContact, email: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Phone</span>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={manualContact.phone}
                  onChange={(e) => setManualContact({ ...manualContact, phone: e.target.value })}
                />
              </label>
            </div>
          )}

          <label className="check-row consent-row" htmlFor="rq-consent">
            <input
              id="rq-consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I agree QuotePilot may share my contact information and insurance details with the
              selected agencies so they can contact me with real quotes. Consent is not a
              condition of using QuotePilot.
            </span>
          </label>

          <div className="real-quotes-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStep("select")}>
              ← Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!consent || !effectiveContact}
              onClick={submit}
            >
              Send my request
            </button>
          </div>
          {!effectiveContact && (
            <p className="field-hint" role="status">Add your contact details above to continue.</p>
          )}
        </div>
      )}

      {step === "sending" && (
        <div className="glass real-quotes-panel" role="status" aria-live="polite">
          <p>Sending your request to {selected.length} {selected.length === 1 ? "agency" : "agencies"}…</p>
        </div>
      )}

      {step === "error" && (
        <div className="alert alert-error" role="alert">
          {error}{" "}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStep("confirm")}>
            Try again
          </button>
        </div>
      )}

      {step === "done" && result && (
        <div className="glass real-quotes-panel" role="status">
          <h3 className="section-heading-sm">Request sent ✓</h3>
          <p className="section-sub">
            Your reference code — mention it if an agency calls you:
          </p>
          <p className="ref-code" aria-label={`Reference code ${result.refCode}`}>
            {result.refCode}
          </p>
          <ul className="delivery-list">
            {result.deliveries.map((d) => (
              <li key={d.agentId} className="delivery-item">
                {d.method === "emailed" ? (
                  <span>✓ Request emailed to <strong>{d.agentName}</strong> — they&apos;ll reply with a real quote.</span>
                ) : (
                  <span>
                    → <strong>{d.agentName}</strong>: we don&apos;t have a verified email for this
                    agency yet, so{" "}
                    <a href={`tel:${(d.handoffCard?.phone ?? "").replace(/\D/g, "")}`}>
                      call {d.handoffCard?.phone}
                    </a>{" "}
                    and mention ref {result.refCode}.
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="field-hint">
            Agencies typically respond within one business day. These will be real quotes from
            licensed agents — not estimates.
          </p>
          <button type="button" className="btn btn-secondary" onClick={copyDetails}>
            {copied ? "Copied ✓" : "Copy my details"}
          </button>
          {copied && <span className="sr-only" role="status">Details copied to clipboard.</span>}
        </div>
      )}
    </section>
  );
}
