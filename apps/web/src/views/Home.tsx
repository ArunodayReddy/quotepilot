"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SimBadge } from "../components/SimBadge";
import { Reveal } from "../components/Reveal";
import { useAnalytics } from "../lib/analytics";
import { api } from "../lib/api";
import { defaultWizardData, loadWizardData, saveWizardData } from "../lib/wizard";
import { ZIP_RE } from "../lib/validation";
import type { CarrierEntry } from "../lib/types";
import { FAQ_DEFS, carriersAnswer } from "../lib/homeContent";

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
  const router = useRouter();
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
    router.push("/quote");
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
              href="/quote"
              className="link-quiet"
              onClick={() => track("cta_clicked", { element: "hero_get_my_quotes" })}
            >
              Start without a ZIP
            </Link>
            <span aria-hidden="true" className="cta-sep">·</span>
            <Link
              href="/quote"
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
              href="/quote"
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
  return (
    <div className="page" style={{ paddingTop: 0 }}>
      <Hero />
      <HowItWorks />
      <CarrierMarquee carriers={carriers} failed={failed} />
      <Faq faqs={faqs} />
      <FinalCta />
    </div>
  );
}
