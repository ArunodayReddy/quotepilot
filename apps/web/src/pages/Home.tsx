import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Seo } from "../components/Seo";
import { SimBadge } from "../components/SimBadge";
import { Reveal } from "../components/Reveal";
import { useAnalytics } from "../lib/analytics";
import { api } from "../lib/api";
import { defaultWizardData, loadWizardData, saveWizardData } from "../lib/wizard";
import { ZIP_RE } from "../lib/validation";
import type { CarrierEntry } from "../lib/types";

const FAQ_DEFS = [
  {
    id: "how",
    q: "How does QuotePilot work?",
    a: "You fill out one short form — location, drivers, vehicle, coverage, and contact. QuotePilot then asks every relevant carrier for your state to price that exact profile, and shows the results ranked side by side. When everything is in, we email you a copy too.",
  },
  {
    id: "real",
    q: "Are these real insurance quotes?",
    a: "No. This demo build shows simulated pricing in realistic bands anchored to real Massachusetts quote research (for example, Allstate quoted $1,347 / 6 months for our sample profile in October 2026). Every quote card carries a 'Simulated — demo pricing' badge so it's always clear.",
  },
  {
    id: "carriers",
    q: "Which states and carriers are supported?",
    a: "", // filled dynamically from the carrier registry (see carriersAnswer)
  },
  {
    id: "privacy",
    q: "What happens to my personal information?",
    a: "Nothing leaves the demo. Your wizard answers are saved only in your browser (localStorage) so you can resume where you left off. We never log PII, never sell data, and analytics events carry only anonymous metadata — no names, emails, or addresses.",
  },
  {
    id: "timing",
    q: "How long does it take?",
    a: "Carriers respond at their own pace, so quoting runs as a background job. You'll see live progress ('4 of 6 carriers'), and most demo runs complete in under a minute. You can leave and come back — the job link keeps working.",
  },
];

/** Human list: "A, B, and C". */
function formatList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * The states/carriers FAQ answer, sourced from the live registry instead of a
 * hardcoded carrier list. Falls back to generic copy when the fetch fails.
 */
function carriersAnswer(quotable: string[] | null): string {
  const base =
    "Texas is fully seeded too — online carriers plus a Denton-area agent directory. " +
    "Starter lists exist for NH and CA. Unknown states degrade gracefully — you'll get a " +
    "clean empty state, not an error.";
  if (!quotable || quotable.length === 0) {
    return `Massachusetts is fully seeded with direct and agent-only carriers, plus a local agent directory. ${base}`;
  }
  return `Massachusetts is fully seeded with ${formatList(quotable)}, plus agent-only carriers through the local agent directory. ${base}`;
}

function buildJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "QuotePilot",
    url: "https://quotepilot.example.com",
    description:
      "One form. Every carrier. Compare side by side. QuotePilot gathers car insurance quotes from every relevant carrier in your state.",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Shared carrier-registry fetch for the home page (marquee + FAQ). */
function useMaCarriers(): { carriers: CarrierEntry[] | null; failed: boolean } {
  const [carriers, setCarriers] = useState<CarrierEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api
      .getCarriers("MA")
      .then((r) => {
        if (!cancelled) setCarriers(r.carriers);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { carriers, failed };
}

/**
 * ZIP-first hero entry: the primary CTA. Validates a 5-digit ZIP, stashes it
 * into the wizard's localStorage (so the location step is prefilled), tracks
 * the event, and routes to the wizard. Unknown-state ZIPs still work — the
 * carriers endpoint degrades gracefully downstream.
 */
function ZipHeroForm() {
  const track = useAnalytics("home");
  const navigate = useNavigate();
  const [zip, setZip] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const z = zip.trim();
    if (!ZIP_RE.test(z)) {
      setError("Enter a valid 5-digit ZIP code.");
      return;
    }
    setError(null);
    try {
      const saved = loadWizardData() ?? defaultWizardData();
      saveWizardData({ ...saved, contact: { ...saved.contact, zip: z } });
    } catch {
      /* storage unavailable — the wizard still works, just without prefill */
    }
    track("zip_search_submitted", { metadata: { zipPrefix: z.slice(0, 3) } });
    navigate("/quote");
  };

  const describedBy = error ? "zip-hero-error zip-hero-hint" : "zip-hero-hint";

  return (
    <form className="zip-hero-form glass" onSubmit={submit} noValidate aria-label="Start with your ZIP code">
      <div className="zip-hero-field">
        <label htmlFor="zip-hero-input">Enter your ZIP code</label>
        <input
          id="zip-hero-input"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="76201"
          maxLength={5}
          value={zip}
          onChange={(e) => {
            setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      </div>
      <button type="submit" className="btn btn-primary btn-lg">
        Get my quotes →
      </button>
      <p id="zip-hero-hint" className="field-hint">
        We check every carrier licensed in your state — online quotes plus local agents.
      </p>
      {error && (
        <p id="zip-hero-error" className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function Hero() {
  const track = useAnalytics("home");
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-orbs" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <div className="container hero-inner">
        <Reveal>
          <span className="hero-eyebrow">
            <span aria-hidden="true">✨</span> Demo build — simulated pricing
          </span>
        </Reveal>
        <Reveal>
          <h1 id="hero-title" className="hero-title">
            One form. Every carrier. <span className="gradient-text">Compare side by side.</span>
          </h1>
        </Reveal>
        <Reveal>
          <p className="hero-sub">
            Tell us about yourself once. QuotePilot quietly gathers car insurance quotes from
            every carrier in your state and ranks them for you — on the site and by email.
          </p>
        </Reveal>
        <Reveal>
          <ZipHeroForm />
        </Reveal>
        <Reveal>
          <div className="hero-ctas hero-ctas-secondary">
            <Link
              to="/quote"
              className="link-quiet"
              onClick={() => track("cta_clicked", { element: "hero_get_my_quotes" })}
            >
              Start without a ZIP
            </Link>
            <span aria-hidden="true" className="cta-sep">·</span>
            <Link
              to="/quote"
              className="link-quiet"
              onClick={() => track("cta_clicked", { element: "hero_try_sample" })}
            >
              Try with sample data
            </Link>
          </div>
        </Reveal>
        <Reveal>
          <p className="hero-note">Takes about 2 minutes · No account needed · Free forever</p>
        </Reveal>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Answer once",
      text: "A five-step wizard — location, drivers, vehicle, coverage, contact — with smart defaults and inline help. Your progress saves automatically.",
    },
    {
      n: "2",
      title: "We ask everyone",
      text: "QuotePilot pings every relevant carrier for your state in the background while you watch live progress. Nobody is left out.",
    },
    {
      n: "3",
      title: "Compare and pick",
      text: "Quotes arrive ranked by price with coverage-match scores, expandable details, a side-by-side compare view, and an emailed copy.",
    },
  ];
  return (
    <section className="section" aria-labelledby="how-title">
      <div className="container">
        <Reveal>
          <h2 id="how-title" className="section-heading">How it works</h2>
        </Reveal>
        <Reveal>
          <p className="section-sub">Three steps. Zero phone calls. Zero repeated forms.</p>
        </Reveal>
        <div className="steps-grid">
          {steps.map((s) => (
            <Reveal key={s.n} className="glass step-card" as="article">
              <div className="step-number" aria-hidden="true">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CarrierMarquee({
  carriers,
  failed,
}: {
  carriers: CarrierEntry[] | null;
  failed: boolean;
}) {
  const quotable = (carriers ?? []).filter((c) => c.quotable);
  // Duplicate the list for a seamless loop.
  const items = [...quotable, ...quotable];
  return (
    <section className="section" aria-labelledby="carriers-title">
      <div className="container">
        <Reveal>
          <h2 id="carriers-title" className="section-heading">Carriers we check</h2>
        </Reveal>
        <Reveal>
          <p className="section-sub">
            Direct and agent-only carriers for your state. <SimBadge />
          </p>
        </Reveal>
      </div>
      {carriers === null && !failed && (
        <div className="container" aria-label="Loading carriers">
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="skeleton" style={{ width: "9rem", height: "2.25rem" }} aria-hidden="true" />
            ))}
          </div>
        </div>
      )}
      {failed && (
        <div className="container">
          <p className="section-sub" role="status">
            The carrier list is unavailable right now — the demo still works, and carriers
            load on the results page.
          </p>
        </div>
      )}
      {quotable.length > 0 && (
        <div className="marquee-wrap" role="list" aria-label="Example carriers (simulated)">
          <div className="marquee">
            {items.map((c, i) => (
              <span key={`${c.id}-${i}`} className="carrier-badge" role="listitem" aria-hidden={i >= quotable.length}>
                {c.logo} {c.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Faq({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <section className="section" aria-labelledby="faq-title">
      <div className="container">
        <Reveal>
          <h2 id="faq-title" className="section-heading">Questions, answered</h2>
        </Reveal>
        <Reveal>
          <p className="section-sub">The honest version — including what's simulated and what isn't.</p>
        </Reveal>
        <div className="faq-list">
          {faqs.map((f, i) => (
            <Reveal key={i} className="glass faq-item" as="div">
              <details>
                <summary className="faq-question">
                  {f.q}
                  <span className="faq-icon" aria-hidden="true">+</span>
                </summary>
                <div className="faq-answer">{f.a}</div>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const track = useAnalytics("home");
  return (
    <section className="section" aria-labelledby="cta-title">
      <div className="container">
        <Reveal className="glass" >
          <div style={{ textAlign: "center", padding: "3.5rem 2rem" }}>
            <h2 id="cta-title" className="section-heading">Ready to see your number?</h2>
            <p className="section-sub">
              Two minutes now could save you hundreds on your next six months.
            </p>
            <Link
              to="/quote"
              className="btn btn-primary btn-lg"
              onClick={() => track("cta_clicked", { element: "final_cta" })}
            >
              Get my quotes →
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Home() {
  const { carriers, failed } = useMaCarriers();
  const quotableNames = useMemo(
    () => (carriers ? carriers.filter((c) => c.quotable).map((c) => c.name) : null),
    [carriers],
  );
  const faqs = useMemo(
    () =>
      FAQ_DEFS.map((f) =>
        f.id === "carriers" ? { q: f.q, a: carriersAnswer(quotableNames) } : { q: f.q, a: f.a },
      ),
    [quotableNames],
  );
  const jsonLd = useMemo(() => buildJsonLd(faqs), [faqs]);
  return (
    <div className="page" style={{ paddingTop: 0 }}>
      <Seo
        title="QuotePilot — One form. Every carrier. Compare side by side."
        description="QuotePilot gathers car insurance quotes from every relevant carrier in your state with one short form. Compare ranked quotes on the site and by email. Demo build with simulated pricing."
        path="/"
        jsonLd={jsonLd}
      />
      <Hero />
      <HowItWorks />
      <CarrierMarquee carriers={carriers} failed={failed} />
      <Faq faqs={faqs} />
      <FinalCta />
    </div>
  );
}
