import { useState } from "react";
import { Seo } from "../components/Seo";
import { Reveal } from "../components/Reveal";
import { AgentMap } from "../components/AgentMap";
import { SelectField, TextField, STATE_OPTIONS } from "../components/fields";
import { api, ApiError } from "../lib/api";
import { useAnalytics } from "../lib/analytics";
import { WIZARD_STORAGE_KEY } from "../lib/wizard";
import type { AgentEntry } from "../lib/types";

const ZIP_RE = /^\d{5}$/;

function readQuoteZip(): string | null {
  try {
    const raw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { contact?: { zip?: string } };
    const zip = parsed?.contact?.zip?.trim() ?? "";
    return ZIP_RE.test(zip) ? zip : null;
  } catch {
    return null;
  }
}

function SourceBadge({ source }: { source: AgentEntry["source"] }) {
  if (source === "google_places") {
    return (
      <span className="live-badge" title="Live listing from the Google Places directory.">
        Live data
      </span>
    );
  }
  return (
    <span className="sim-badge" title="Sample directory data for demonstration.">
      Sample data
    </span>
  );
}

export function Agents() {
  const [state, setState] = useState("MA");
  const [zip, setZip] = useState("");
  const [agents, setAgents] = useState<AgentEntry[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [geocoded, setGeocoded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [quoteZipAvailable, setQuoteZipAvailable] = useState(() => readQuoteZip() !== null);
  const track = useAnalytics("agents");

  const runSearch = async (searchZip: string) => {
    setError(null);
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.getAgents(state, searchZip);
      setAgents(res.agents);
      setNote(res.note);
      setGeocoded(res.geocoded);
      track("cta_clicked", {
        element: "agent_search",
        metadata: { state, resultCount: res.agents.length, geocoded: res.geocoded },
      });
    } catch (e) {
      setError(
        e instanceof ApiError
          ? "We couldn't load agents right now. Please try again in a moment."
          : "Check your connection and try again.",
      );
      setAgents(null);
      setNote(null);
    } finally {
      setLoading(false);
    }
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const z = zip.trim();
    if (!ZIP_RE.test(z)) {
      setError("Enter a valid 5-digit ZIP code.");
      return;
    }
    void runSearch(z);
  };

  const useQuoteZip = () => {
    const z = readQuoteZip();
    if (z) {
      setZip(z);
      setQuoteZipAvailable(true);
      track("cta_clicked", { element: "agent_use_quote_zip" });
      void runSearch(z);
    } else {
      setQuoteZipAvailable(false);
      setError("No ZIP found in your quote — enter one above.");
    }
  };

  const scrollToCard = (id: string) => {
    document.getElementById(`agent-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    track("cta_clicked", { element: "agent_map_pin" });
  };

  return (
    <div className="page">
      <Seo
        title="Local insurance agents near you — QuotePilot"
        description="Find local independent insurance agents near your ZIP — map, distance, addresses, phone numbers, open hours, carriers, and languages."
        path="/agents"
      />
      <div className="container">
        <Reveal>
          <h1 className="section-heading">Local agents</h1>
        </Reveal>
        <Reveal>
          <p className="section-sub">
            Some carriers only sell through independent agents. Enter your ZIP to see agencies near you on the
            map — with addresses, phone numbers, and open hours.
          </p>
        </Reveal>

        <Reveal className="glass search-panel" as="div">
          <form onSubmit={search} style={{ display: "contents" }} aria-label="Search agents by state and ZIP">
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
            <div className="search-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Searching…" : "Find agents"}
              </button>
              {quoteZipAvailable && (
                <button type="button" className="btn btn-secondary" onClick={useQuoteZip} disabled={loading}>
                  Use my quote ZIP
                </button>
              )}
            </div>
          </form>
        </Reveal>

        {loading && (
          <div className="job-progress" role="status" aria-live="polite">
            <div className="spinner" aria-hidden="true" />
            <p>Looking up agents near {zip}…</p>
          </div>
        )}

        {!loading && searched && note && (
          <div className="notice glass" role="status">
            {note}
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
            <p className="results-summary" role="status" style={{ marginBottom: "1rem" }}>
              {agents.length} agent{agents.length === 1 ? "" : "s"}
              {geocoded ? ` near ${zip}, ${state} — nearest first` : ` in ${state}`}.
            </p>

            <div className="glass map-panel">
              <AgentMap agents={agents} onPinClick={scrollToCard} />
              <p className="field-hint" style={{ marginTop: "0.75rem" }}>
                Pins are numbered to match the list below. Map data © OpenStreetMap contributors.
              </p>
            </div>

            <div className="agent-grid" role="list" aria-label="Insurance agents">
              {agents.map((a, i) => (
                <Reveal key={a.id} id={`agent-card-${a.id}`} className="glass agent-card" as="article">
                  <div
                    style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center" }}
                    role="listitem"
                    aria-label={`${a.name}, ${a.city}`}
                  >
                    <h3>
                      <span className="agent-rank" aria-hidden="true">
                        {i + 1}
                      </span>{" "}
                      {a.name}
                    </h3>
                    <SourceBadge source={a.source} />
                  </div>
                  {a.distance_mi != null && (
                    <div className="agent-distance" aria-label={`${a.distance_mi.toFixed(1)} miles away`}>
                      📍 {a.distance_mi.toFixed(1)} mi away
                    </div>
                  )}
                  <address className="agent-address">
                    {a.address}
                    <br />
                    {a.city}, {a.zip}
                  </address>
                  {/^\d+$/.test(a.phone.replace(/\D/g, "")) && a.phone.replace(/\D/g, "").length >= 7 ? (
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
                      📞 {a.phone}
                    </a>
                  ) : (
                    <span className="agent-phone agent-phone-na">{a.phone}</span>
                  )}
                  <div className="agent-hours" aria-label="Open hours">
                    <div>
                      <span>Mon–Fri</span>
                      <span>{a.hours.weekdays}</span>
                    </div>
                    <div>
                      <span>Sat</span>
                      <span>{a.hours.saturday}</span>
                    </div>
                    <div>
                      <span>Sun</span>
                      <span>{a.hours.sunday}</span>
                    </div>
                  </div>
                  {a.carriers.length > 0 && (
                    <div className="tag-row" aria-label="Carriers represented">
                      {a.carriers.map((c) => (
                        <span key={c} className="tag">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  {a.languages.length > 0 && <div className="field-hint">Languages: {a.languages.join(", ")}</div>}
                </Reveal>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
