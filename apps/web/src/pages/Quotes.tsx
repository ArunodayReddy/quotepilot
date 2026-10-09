import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Seo } from "../components/Seo";
import { SimBadge } from "../components/SimBadge";
import { AgentMap } from "../components/AgentMap";
import { LoadingMessages } from "../components/LoadingMessages";
import { TextField } from "../components/fields";
import { api, ApiError } from "../lib/api";
import { useAnalytics } from "../lib/analytics";
import { readQuoteLocation } from "../lib/wizard";
import { StateDisclosurePanel } from "../components/StateDisclosurePanel";
import { QuoteDisclaimer } from "../components/QuoteDisclaimer";
import { SourceBadge } from "./Agents";
import type { AgentEntry, CarrierEntry, QuoteJob, QuoteResult } from "../lib/types";

const POLL_MS = 2000;

function fmtPremium(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function QuoteCard({
  result,
  isBest,
  compareChecked,
  onCompareToggle,
  compareDisabled,
}: {
  result: QuoteResult;
  isBest: boolean;
  compareChecked: boolean;
  onCompareToggle: (id: string) => void;
  compareDisabled: boolean;
}) {
  const track = useAnalytics("quotes");

  return (
    <article className={`glass quote-card${isBest ? " best" : ""}`} aria-label={`${result.carrierName} quote`}>
      {isBest && <span className="best-ribbon">Lowest estimate</span>}
      <div className="quote-card-top">
        <h2 className="carrier-name">{result.carrierName}</h2>
        <SimBadge />
      </div>
      <p className="quote-price">
        {fmtPremium(result.premium6Mo)} <small>/ 6 mo</small>
      </p>
      <div className="quote-meta">
        <span>≈ {fmtPremium(result.premiumMonthly)} per month</span>
        <span>
          Coverage match: <strong>{result.coverageMatchPct}%</strong>
        </span>
        <div
          className="match-meter"
          role="img"
          aria-label={`Coverage match ${result.coverageMatchPct} percent`}
        >
          <div className="match-fill" style={{ width: `${result.coverageMatchPct}%` }} />
        </div>
      </div>
      <details
        className="quote-details"
        onToggle={(e) => {
          if ((e.target as HTMLDetailsElement).open) {
            track("carrier_card_expanded", { metadata: { carrier: result.carrierId } });
          }
        }}
      >
        <summary>Coverage details & caveats</summary>
        {result.caveats.length > 0 ? (
          <ul>
            {result.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        ) : (
          <p>No caveats reported for this quote.</p>
        )}
        <p className="field-hint">
          Returned in {result.latencyMs}ms · Rank #{result.rank}
        </p>
      </details>
      <div className="quote-card-actions">
        <label className="check-row" htmlFor={`compare-${result.carrierId}`}>
          <input
            id={`compare-${result.carrierId}`}
            type="checkbox"
            checked={compareChecked}
            disabled={compareDisabled && !compareChecked}
            onChange={() => onCompareToggle(result.carrierId)}
          />
          <span>Compare</span>
        </label>
      </div>
    </article>
  );
}

function CompareTable({ results }: { results: QuoteResult[] }) {
  const rows: { label: string; render: (r: QuoteResult) => React.ReactNode }[] = [
    { label: "Premium (6 mo)", render: (r) => fmtPremium(r.premium6Mo) },
    { label: "Per month", render: (r) => fmtPremium(r.premiumMonthly) },
    { label: "Coverage match", render: (r) => `${r.coverageMatchPct}%` },
    { label: "Caveats", render: (r) => (r.caveats.length ? r.caveats.join("; ") : "None") },
    { label: "Pricing", render: () => <SimBadge /> },
  ];
  return (
    <div className="glass compare-table-wrap" role="region" aria-label="Quote comparison table" tabIndex={0}>
      <table className="compare-table">
        <caption className="sr-only">Side-by-side comparison of selected quotes</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Feature</span>
            </th>
            {results.map((r) => (
              <th key={r.carrierId} scope="col">
                {r.carrierName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {results.map((r) => (
                <td key={r.carrierId}>{row.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmailOptIn({ jobId, mode, carrierCount }: { jobId: string; mode: "waiting" | "results"; carrierCount: number }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const track = useAnalytics("quotes");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await api.notifyEmail(jobId, email.trim());
      setDone(true);
      track("email_optin");
      track("inline_email_capture", { metadata: { placement: mode } });
    } catch {
      setError("We couldn't save that email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="glass email-box" role="status">
        <h2>You&apos;re on the list ✓</h2>
        <p>We&apos;ll email your quotes to you as soon as they&apos;re ready.</p>
      </div>
    );
  }

  return (
    <div className="glass email-box">
      <h2>{mode === "waiting" ? "Don't want to wait?" : "Email me these quotes"}</h2>
      <p>
        {mode === "waiting"
          ? `Leave your email and we'll send all ${carrierCount} ranked quotes the moment they land — no spam, ever.`
          : "Get a copy in your inbox so you can compare later — no spam, ever."}
      </p>
      <form className="email-form" onSubmit={submit} noValidate>
        <TextField
          id={mode === "waiting" ? "quotes-email-waiting" : "quotes-email"}
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error ?? undefined}
        />
        <button type="submit" className="btn btn-primary" disabled={sending}>
          {sending ? "Sending…" : mode === "waiting" ? "Notify me" : "Send quotes"}
        </button>
      </form>
    </div>
  );
}


/**
 * Upgraded live progress: per-carrier status rows for finished carriers plus
 * skeleton rows for carriers still being contacted. Fires quotes_progress_view once.
 */
function ProgressSection({ job }: { job: QuoteJob }) {
  const track = useAnalytics("quotes");
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!viewedRef.current) {
      viewedRef.current = true;
      track("quotes_progress_view", { metadata: { total: job.progress.total } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const done = useMemo(
    () => [...job.results].sort((a, b) => (a.premium6Mo ?? Infinity) - (b.premium6Mo ?? Infinity)),
    [job.results],
  );
  const pending = Math.max(0, job.progress.total - job.progress.completed);
  return (
    <div className="glass job-progress" role="status" aria-live="polite">
      <LoadingMessages context="quotes" />
      <p>
        Gathering quotes… {job.progress.completed} of {job.progress.total}
      </p>
      <div className="progress-bar" role="progressbar"
        aria-valuenow={job.progress.completed}
        aria-valuemin={0}
        aria-valuemax={job.progress.total}
        aria-label="Quote gathering progress">
        <div
          className="progress-fill"
          style={{ width: `${job.progress.total ? (job.progress.completed / job.progress.total) * 100 : 0}%` }}
        />
      </div>
      <ul className="carrier-status-list" aria-label="Carrier status">
        {done.map((r) => (
          <li key={r.carrierId} className="carrier-status done">
            <span aria-hidden="true" className="status-check">✓</span>
            <span className="status-name">{r.carrierName}</span>
            <span className="status-value">
              {typeof r.premium6Mo === "number" ? fmtPremium(r.premium6Mo) : "couldn't quote"}
            </span>
          </li>
        ))}
        {Array.from({ length: pending }).map((_, i) => (
          <li key={`pending-${i}`} className="carrier-status pending" aria-hidden="true">
            <span className="skeleton skeleton-dot" />
            <span className="skeleton skeleton-text" style={{ width: `${38 - i * 4}%` }} />
          </li>
        ))}
      </ul>
      <p className="demo-note">Hang tight — carriers respond at their own pace. All prices are simulated.</p>
    </div>
  );
}

/** Truthful savings headline computed from the actual ranked results. */
function SavingsHeadline({ results }: { results: QuoteResult[] }) {
  const track = useAnalytics("quotes");
  const { spread, count } = useMemo(() => {
    const premiums = results
      .filter((r) => typeof r.premium6Mo === "number")
      .map((r) => r.premium6Mo as number);
    if (premiums.length < 2) return { spread: 0, count: premiums.length };
    return { spread: Math.max(...premiums) - Math.min(...premiums), count: premiums.length };
  }, [results]);
  const viewedRef = useRef(false);
  useEffect(() => {
    if (count >= 2 && !viewedRef.current) {
      viewedRef.current = true;
      track("savings_headline_view", { metadata: { spread } });
    }
  }, [count, spread, track]);
  if (count < 2) return null;
  return (
    <div className="glass savings-headline" role="status">
      <p>
        <strong>Up to {fmtPremium(spread)} every 6 months</strong> between the cheapest and
        priciest quote — that&apos;s why comparing pays.
      </p>
    </div>
  );
}

/**
 * Honest degradation for registry carriers with no simulation adapter:
 * no fake prices — direct carriers link out, agent-only carriers link to
 * the local agent directory. Unavailable carriers (e.g. Lemonade in MA)
 * are excluded upstream via `available !== false`.
 */
function MoreCarriers({ state }: { state: string }) {
  const [carriers, setCarriers] = useState<CarrierEntry[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .getCarriers(state)
      .then((r) => {
        if (!cancelled) setCarriers(r.carriers);
      })
      .catch(() => {
        if (!cancelled) setCarriers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [state]);
  const rest = useMemo(
    () => (carriers ?? []).filter((c) => !c.quotable && c.available !== false),
    [carriers],
  );
  if (!rest.length) return null;
  return (
    <section aria-labelledby="more-carriers-title" className="more-carriers">
      <h2 id="more-carriers-title" className="section-heading-sm">
        More carriers in {state} — not instant-quoted here
      </h2>
      <p className="section-sub">
        These carriers don&apos;t plug into our instant engine yet. Go direct, or talk to a local
        agent — no fake prices, ever.
      </p>
      <div className="more-carriers-grid">
        {rest.map((c) => (
          <div key={c.id} className="glass more-carrier-card">
            <div className="more-carrier-top">
              <span className="carrier-emoji" aria-hidden="true">
                {c.logo}
              </span>
              <h3>{c.name}</h3>
            </div>
            <p className="field-hint">{c.channel === "agent" ? "Agent-only carrier" : "Direct carrier"}</p>
            {c.website ? (
              <a
                href={`https://${c.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                Get a quote at {c.website} →
              </a>
            ) : (
              c.channel === "agent" && (
                <Link to={`/agents?state=${state}`} className="btn btn-secondary btn-sm">
                  Find a local agent →
                </Link>
              )
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentMiniCard({ agent, index }: { agent: AgentEntry; index: number }) {
  const track = useAnalytics("quotes");
  const phoneDigits = agent.phone.replace(/\D/g, "");
  return (
    <article className="glass agent-mini" aria-label={`${agent.name}, ${agent.city}`}>
      <div className="agent-mini-top">
        <h3>
          <span className="agent-rank" aria-hidden="true">
            {index + 1}
          </span>{" "}
          {agent.name}
        </h3>
        <SourceBadge source={agent.source} />
      </div>
      {agent.distance_mi != null && (
        <div className="agent-distance" aria-label={`${agent.distance_mi.toFixed(1)} miles away`}>
          📍 {agent.distance_mi.toFixed(1)} mi away
        </div>
      )}
      <address className="agent-address">
        {agent.address}, {agent.city} {agent.zip}
      </address>
      {/^\d+$/.test(phoneDigits) && phoneDigits.length >= 7 ? (
        <a
          className="agent-phone"
          href={`tel:${phoneDigits}`}
          onClick={() => track("agent_phone_clicked", { element: "quotes_agent_card_phone" })}
        >
          📞 {agent.phone}
        </a>
      ) : (
        <span className="agent-phone agent-phone-na">{agent.phone}</span>
      )}
      <div className="field-hint">Mon–Fri: {agent.hours.weekdays}</div>
    </article>
  );
}

/**
 * Unified results: local agents below the online quotes, reusing the
 * compact AgentMap + top-3 cards. Location comes from wizard localStorage;
 * without it we degrade to a link instead of guessing.
 */
function AgentsSection() {
  const track = useAnalytics("quotes");
  const [loc] = useState(() => readQuoteLocation());
  const [agents, setAgents] = useState<AgentEntry[] | null>(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    if (!loc) return;
    let cancelled = false;
    api
      .getAgents(loc.state, loc.zip)
      .then((res) => {
        if (!cancelled) setAgents(res.agents);
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loc]);

  useEffect(() => {
    if (agents && agents.length > 0 && !viewedRef.current) {
      viewedRef.current = true;
      track("agents_section_view", { metadata: { count: agents.length } });
    }
  }, [agents, track]);

  if (!loc) {
    return (
      <section aria-labelledby="agents-near-title" className="glass agents-teaser">
        <h2 id="agents-near-title" className="section-heading-sm">
          Local agents — humans who can help
        </h2>
        <p className="section-sub">
          Some carriers only sell through independent agents.{" "}
          <Link to="/agents">Find agents near you →</Link>
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="agents-near-title" className="agents-section">
      <h2 id="agents-near-title" className="section-heading-sm">
        Local agents near {loc.zip} — humans who can help
      </h2>
      <p className="section-sub">
        Agent-only carriers don&apos;t do instant online quotes. These local agencies can.
      </p>
      {agents === null ? (
        <div className="glass map-panel" aria-label="Loading agents">
          <LoadingMessages context="agents" />
        </div>
      ) : agents.length === 0 ? (
        <div className="glass agents-teaser">
          <p className="section-sub">
            No agent listings near {loc.zip} yet.{" "}
            <Link to={`/agents?zip=${loc.zip}&state=${loc.state}`}>Search the full directory →</Link>
          </p>
        </div>
      ) : (
        <>
          <div className="glass map-panel map-panel-compact">
            <AgentMap agents={agents} height={240} />
          </div>
          <div className="agent-mini-grid">
            {agents.slice(0, 3).map((a, i) => (
              <AgentMiniCard key={a.id} agent={a} index={i} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <Link
              to={`/agents?zip=${loc.zip}&state=${loc.state}`}
              className="btn btn-secondary"
              onClick={() => track("agents_see_all_click")}
            >
              See all {agents.length} agents near {loc.zip} →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}


/** Location-aware extras below the results: local agents + non-instant carriers. */
function QuoteExtras() {
  const [loc] = useState(() => readQuoteLocation());
  if (!loc) return <AgentsSection />;
  return (
    <>
      <AgentsSection />
      <MoreCarriers state={loc.state} />
    </>
  );
}

export function Quotes() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<QuoteJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const track = useAnalytics("quotes");

  const load = useCallback(async () => {
    if (!jobId) return;
    try {
      const j = await api.getQuoteJob(jobId);
      setJob(j);
      if (j.status === "complete") {
        track("quotes_viewed", { metadata: { results: j.results.length } });
      }
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 404
          ? "We couldn't find that quote job. It may have expired — start a fresh quote to try again."
          : "We couldn't load your quotes. Check your connection and we'll keep trying.";
      setError(msg);
    }
  }, [jobId, track]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll every 2s until terminal.
  useEffect(() => {
    if (!job || job.status === "complete" || job.status === "failed") return;
    const t = window.setTimeout(() => void load(), POLL_MS);
    return () => window.clearTimeout(t);
  }, [job, load]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 3);
      if (!prev.includes(id) && next.length >= 2) {
        track("compare_opened", { metadata: { count: next.length } });
      }
      return next;
    });
  };

  const sorted = useMemo(
    () => (job ? [...job.results].sort((a, b) => a.premium6Mo - b.premium6Mo) : []),
    [job],
  );
  const compareResults = useMemo(
    () => sorted.filter((r) => compareIds.includes(r.carrierId)),
    [sorted, compareIds],
  );

  if (!jobId) {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state glass">
            <h2>No quote job selected</h2>
            <p>Tell us about yourself and we'll gather quotes in the background.</p>
            <Link to="/quote" className="btn btn-primary">Start a quote</Link>
          </div>
        </div>
      </div>
    );
  }

  const inProgress = job && (job.status === "queued" || job.status === "running");

  return (
    <div className="page">
      <Seo
        title={job?.status === "complete" ? `Your quotes are ready — QuotePilot` : "Gathering your quotes… — QuotePilot"}
        description="Watch QuotePilot gather car insurance quotes from every carrier in your state, ranked side by side. Simulated demo pricing."
        path={`/quotes/${jobId}`}
      />
      <div className="container">
        <div className="quotes-header">
          <h1>{inProgress ? "Gathering your quotes…" : job?.status === "failed" ? "Something went wrong" : "Your quotes"}</h1>
          {inProgress && job && (
            <p className="results-summary">
              Checking {job.progress.total} carriers so you can compare prices.
            </p>
          )}
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}{" "}
            <Link to="/quote" className="btn btn-secondary" style={{ marginLeft: "0.5rem" }}>
              Start a new quote
            </Link>
          </div>
        )}

        {inProgress && job && (
          <>
            <ProgressSection job={job} />
            <EmailOptIn jobId={job.jobId} mode="waiting" carrierCount={job.progress.total} />
          </>
        )}

        {job?.status === "failed" && (
          <div className="empty-state glass">
            <h2>The quote run hit a snag</h2>
            <p>None of the carriers returned a quote this time. It happens — let's try again.</p>
            <Link to="/quote" className="btn btn-primary">Try again</Link>
          </div>
        )}

        {job?.status === "complete" && (
          <>
            <div className="results-toolbar">
              <p className="results-summary" role="status">
                {sorted.length} quotes from {sorted.length} carriers — ranked by 6-month premium.
              </p>
              <p className="results-summary">
                Select up to 3 quotes to compare side by side.
              </p>
            </div>

            {sorted.length === 0 ? (
              <div className="empty-state glass">
                <h2>No quotes this time</h2>
                <p>No carriers returned a quote for this profile. Try adjusting your coverage or location.</p>
                <Link to="/quote" className="btn btn-primary">Adjust & retry</Link>
              </div>
            ) : (
              <>
                <h2 className="section-heading-sm section-label">Online quotes — instant</h2>
                <SavingsHeadline results={sorted} />
                {compareResults.length >= 2 && <CompareTable results={compareResults} />}
                <div className="quote-grid">
                  {sorted.map((r, i) => (
                    <QuoteCard
                      key={r.carrierId}
                      result={r}
                      isBest={i === 0}
                      compareChecked={compareIds.includes(r.carrierId)}
                      onCompareToggle={toggleCompare}
                      compareDisabled={compareIds.length >= 3}
                    />
                  ))}
                </div>
                <EmailOptIn jobId={job.jobId} mode="results" carrierCount={sorted.length} />
                <StateDisclosurePanel state={job.state} />
                <QuoteDisclaimer />
              </>
            )}
            <QuoteExtras />
          </>
        )}
      </div>
    </div>
  );
}
