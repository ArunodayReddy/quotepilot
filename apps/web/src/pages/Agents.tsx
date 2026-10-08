import { useState } from "react";
import { Seo } from "../components/Seo";
import { Reveal } from "../components/Reveal";
import { SelectField, TextField, STATE_OPTIONS } from "../components/fields";
import { api, ApiError } from "../lib/api";
import { useAnalytics } from "../lib/analytics";
import type { AgentEntry } from "../lib/types";

export function Agents() {
  const [state, setState] = useState("MA");
  const [zip, setZip] = useState("");
  const [agents, setAgents] = useState<AgentEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const track = useAnalytics("agents");

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{5}(-\d{4})?$/.test(zip.trim())) {
      setError("Enter a valid 5-digit ZIP code.");
      return;
    }
    setError(null);
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.getAgents(state, zip.trim());
      setAgents(res.agents);
      track("cta_clicked", {
        element: "agent_search",
        metadata: { state, resultCount: res.agents.length },
      });
    } catch (e) {
      setError(
        e instanceof ApiError
          ? "We couldn't load agents right now. Please try again in a moment."
          : "Check your connection and try again.",
      );
      setAgents(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <Seo
        title="Local insurance agents near you — QuotePilot"
        description="Find local independent insurance agents in your state and ZIP — names, cities, phone numbers, carriers, and languages. Sample directory data."
        path="/agents"
      />
      <div className="container">
        <Reveal>
          <h1 className="section-heading">Local agents</h1>
        </Reveal>
        <Reveal>
          <p className="section-sub">
            Some carriers only sell through independent agents. Find one near you — call, compare, and get the
            human touch when you want it.
          </p>
        </Reveal>

        <Reveal className="glass search-panel" as="div">
          <form
            onSubmit={search}
            style={{ display: "contents" }}
            aria-label="Search agents by state and ZIP"
          >
            <SelectField
              id="agents-state"
              label="State"
              value={state}
              onChange={(v) => setState(v)}
              options={STATE_OPTIONS}
            />
            <TextField
              id="agents-zip"
              label="ZIP code"
              inputMode="numeric"
              placeholder="02139"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              error={error ?? undefined}
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Searching…" : "Find agents"}
            </button>
          </form>
        </Reveal>

        {loading && (
          <div className="job-progress" role="status" aria-live="polite">
            <div className="spinner" aria-hidden="true" />
            <p>Looking up agents…</p>
          </div>
        )}

        {!loading && searched && agents && agents.length === 0 && (
          <div className="empty-state glass">
            <h2>No agents found</h2>
            <p>
              We don't have agent listings for {state} {zip} yet. Try a nearby ZIP, or get direct-carrier
              quotes instead.
            </p>
          </div>
        )}

        {!loading && agents && agents.length > 0 && (
          <>
            <p className="results-summary" role="status" style={{ marginBottom: "1.5rem" }}>
              {agents.length} agent{agents.length === 1 ? "" : "s"} near {zip}, {state}.
            </p>
            <div className="agent-grid">
              {agents.map((a, i) => (
                <Reveal key={i} className="glass agent-card" as="article">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center" }}>
                    <h3>{a.name}</h3>
                    {a.sample && (
                      <span className="sim-badge" title="Sample directory data for demonstration.">
                        Sample data
                      </span>
                    )}
                  </div>
                  <div className="agent-city">{a.city}</div>
                  <a
                    className="agent-phone"
                    href={`tel:${a.phone.replace(/\D/g, "")}`}
                    onClick={() =>
                      track("agent_phone_clicked", {
                        element: "agent_card_phone",
                        metadata: { state },
                      })
                    }
                  >
                    {a.phone}
                  </a>
                  {a.carriers.length > 0 && (
                    <div className="tag-row" aria-label="Carriers represented">
                      {a.carriers.map((c) => (
                        <span key={c} className="tag">{c}</span>
                      ))}
                    </div>
                  )}
                  {a.languages.length > 0 && (
                    <div className="field-hint">Languages: {a.languages.join(", ")}</div>
                  )}
                </Reveal>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
