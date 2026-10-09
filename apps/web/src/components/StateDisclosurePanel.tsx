import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { StateDisclosures, StateMinCoverage } from "../lib/types";

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Renders a verified state-minimum coverage line, e.g. "30/60/25 + $8k PIP". */
function MinCoverageLine({ min }: { min: StateMinCoverage }) {
  const bi = `${fmtMoney(min.biPerPerson).replace("$", "")}/${fmtMoney(min.biPerAccident).replace("$", "")}`;
  const pd = fmtMoney(min.propertyDamage).replace("$", "");
  return (
    <div className="min-coverage-line">
      <strong>State minimum liability: {bi}/{pd}</strong>
      {min.pip !== null && <span> + {fmtMoney(min.pip)} PIP</span>}
      <span className="field-hint" style={{ display: "block", marginTop: "0.25rem" }}>
        {min.notes} Verify current requirements with your state&apos;s department of insurance.
      </span>
    </div>
  );
}

/**
 * "Good to know in {state}" panel — per-state consumer-education notes from
 * GET /api/disclosures/:state (data/disclosures/<STATE>.json).
 *
 * Graceful degradation: unknown states (404) or fetch failures render nothing,
 * so the results page never breaks on a missing file.
 */
export function StateDisclosurePanel({ state }: { state: string }) {
  const [data, setData] = useState<StateDisclosures | null>(null);

  useEffect(() => {
    const code = state.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return;
    let alive = true;
    api
      .getDisclosures(code)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        // 404 = no disclosure file for this state: degrade silently.
        if (alive && !(e instanceof ApiError && e.status === 404)) setData(null);
      });
    return () => {
      alive = false;
    };
  }, [state]);

  if (!data || (data.notes.length === 0 && !data.minCoverage)) return null;

  return (
    <section className="glass state-disclosures" aria-labelledby="state-disclosures-heading">
      <h2 id="state-disclosures-heading">Good to know in {data.stateName}</h2>
      {data.minCoverage && <MinCoverageLine min={data.minCoverage} />}
      <ul className="state-disclosure-list">
        {data.notes.map((n) => (
          <li key={n.title}>
            <strong>{n.title}.</strong> {n.body}
          </li>
        ))}
      </ul>
      <p className="disclosure-fineprint">
        Educational notes only — not insurance or legal advice.{" "}
        <Link to="/disclosures">Read all disclosures</Link>
      </p>
    </section>
  );
}

/**
 * Compact minimum-coverage hint for the wizard coverage step. Renders nothing
 * when the state has no verified minimums (never guessed).
 */
export function MinCoverageHint({ state }: { state: string }) {
  const [min, setMin] = useState<StateMinCoverage | null>(null);

  useEffect(() => {
    const code = state.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return;
    let alive = true;
    api
      .getDisclosures(code)
      .then((d) => {
        if (alive) setMin(d.minCoverage ?? null);
      })
      .catch(() => {
        if (alive) setMin(null);
      });
    return () => {
      alive = false;
    };
  }, [state]);

  if (!min) return null;

  const bi = `${fmtMoney(min.biPerPerson).replace("$", "")}/${fmtMoney(min.biPerAccident).replace("$", "")}`;
  const pd = fmtMoney(min.propertyDamage).replace("$", "");
  return (
    <p className="field-hint" role="note" style={{ marginBottom: "1rem" }}>
      <strong>State minimum for {state.toUpperCase()}: {bi}/{pd}</strong>
      {min.pip !== null && ` + ${fmtMoney(min.pip)} PIP`}. Minimums are a legal
      floor, not a recommendation — verify with your state&apos;s department of
      insurance.
    </p>
  );
}
