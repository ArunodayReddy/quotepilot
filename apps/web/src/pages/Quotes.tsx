import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Seo } from "../components/Seo";
import { SimBadge } from "../components/SimBadge";
import { TextField } from "../components/fields";
import { api, ApiError } from "../lib/api";
import { useAnalytics } from "../lib/analytics";
import type { QuoteJob, QuoteResult } from "../lib/types";

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
      {isBest && <span className="best-ribbon">Best deal</span>}
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

function EmailOptIn({ jobId }: { jobId: string }) {
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
    } catch {
      setError("We couldn't save that email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="glass email-box" role="status">
        <h2>You're on the list ✓</h2>
        <p>We'll email your quotes to you as soon as they're ready.</p>
      </div>
    );
  }

  return (
    <div className="glass email-box">
      <h2>Email me these quotes</h2>
      <p>Get a copy in your inbox so you can compare later — no spam, ever.</p>
      <form className="email-form" onSubmit={submit} noValidate>
        <TextField
          id="quotes-email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error ?? undefined}
        />
        <button type="submit" className="btn btn-primary" disabled={sending}>
          {sending ? "Sending…" : "Send quotes"}
        </button>
      </form>
    </div>
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
              Checking {job.progress.total} carriers for your best price.
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
          <div className="glass job-progress" role="status" aria-live="polite">
            <div className="spinner" aria-hidden="true" />
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
            <p className="demo-note">Hang tight — carriers respond at their own pace. All prices are simulated.</p>
          </div>
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
                <EmailOptIn jobId={job.jobId} />
                <p className="demo-note">
                  All prices on this page are <strong>simulated demo pricing</strong> — realistic bands anchored to
                  real Massachusetts quote research, not real carrier offers.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
