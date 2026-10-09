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
import type { FaqItem, HomeContent } from "../lib/cms";
import { carriersAnswer } from "../lib/homeContent";

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

/** Resolve a CMS FAQ item to a rendered Q&A. `dynamic: "carriers"` slots in
 *  live registry data; everything else renders verbatim from the CMS. */
function resolveFaq(item: FaqItem, quotableNames: string[] | null): { q: string; a: string } {
  if (item.dynamic === "carriers") {
    return { q: item.q, a: carriersAnswer(quotableNames, item) };
  }
  return { q: item.q, a: item.a ?? "" };
}

/**
 * ZIP-first hero entry: the primary CTA. Validates a 5-digit ZIP, stashes it
 * into the wizard's localStorage (so the location step is prefilled), tracks
 * the event, and routes to the wizard. Unknown-state ZIPs still work — the
 * carriers endpoint degrades gracefully downstream.
 */
function ZipHeroForm({ content }: { content: HomeContent["hero"] }) {
  const track = useAnalytics("home");
  const router = useRouter();
  const [zip, setZip] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const z = zip.trim();
    if (!ZIP_RE.test(z)) {
      setError(content.zipError);
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
        <label htmlFor="zip-hero-input">{content.zipLabel}</label>
        <input
          id="zip-hero-input"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder={content.zipPlaceholder}
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
        {content.zipCta}
      </button>
      <p id="zip-hero-hint" className="field-hint">
        {content.zipHint}
      </p>
      {error && (
        <p id="zip-hero-error" className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function Hero({ content }: { content: HomeContent["hero"] }) {
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
          <span className="hero-eyebrow">{content.eyebrow}</span>
        </Reveal>
        <Reveal>
          <h1 id="hero-title" className="hero-title">
            {content.title} <span className="gradient-text">{content.titleAccent}</span>
          </h1>
        </Reveal>
        <Reveal>
          <p className="hero-sub">{content.subtitle}</p>
        </Reveal>
        <Reveal>
          <ZipHeroForm content={content} />
        </Reveal>
        <Reveal>
          <div className="hero-ctas hero-ctas-secondary">
            {content.secondaryCtas.map((cta, i) => (
              <span key={cta.element}>
                {i > 0 && (
                  <span aria-hidden="true" className="cta-sep">
                    ·
                  </span>
                )}
                <Link
                  href={cta.href}
                  className="link-quiet"
                  onClick={() => track("cta_clicked", { element: cta.element })}
                >
                  {cta.label}
                </Link>
              </span>
            ))}
          </div>
        </Reveal>
        <Reveal>
          <p className="hero-note">{content.note}</p>
        </Reveal>
      </div>
    </section>
  );
}

function HowItWorks({ content }: { content: HomeContent["howItWorks"] }) {
  return (
    <section className="section" aria-labelledby="how-title">
      <div className="container">
        <Reveal>
          <h2 id="how-title" className="section-heading">
            {content.heading}
          </h2>
        </Reveal>
        <Reveal>
          <p className="section-sub">{content.sub}</p>
        </Reveal>
        <div className="steps-grid">
          {content.steps.map((s) => (
            <Reveal key={s.n} className="glass step-card" as="article">
              <div className="step-number" aria-hidden="true">
                {s.n}
              </div>
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
  content,
  carriers,
  failed,
}: {
  content: HomeContent["carriers"];
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
          <h2 id="carriers-title" className="section-heading">
            {content.heading}
          </h2>
        </Reveal>
        <Reveal>
          <p className="section-sub">
            {content.sub} <SimBadge />
          </p>
        </Reveal>
      </div>
      {carriers === null && !failed && (
        <div className="container" aria-label={content.loadingAriaLabel}>
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
            {content.unavailableNote}
          </p>
        </div>
      )}
      {quotable.length > 0 && (
        <div className="marquee-wrap" role="list" aria-label={content.marqueeAriaLabel}>
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

function Faq({
  content,
  faqs,
}: {
  content: HomeContent["faq"];
  faqs: { q: string; a: string }[];
}) {
  return (
    <section className="section" aria-labelledby="faq-title">
      <div className="container">
        <Reveal>
          <h2 id="faq-title" className="section-heading">
            {content.heading}
          </h2>
        </Reveal>
        <Reveal>
          <p className="section-sub">{content.sub}</p>
        </Reveal>
        <div className="faq-list">
          {faqs.map((f, i) => (
            <Reveal key={i} className="glass faq-item" as="div">
              <details>
                <summary className="faq-question">
                  {f.q}
                  <span className="faq-icon" aria-hidden="true">
                    +
                  </span>
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

function FinalCta({ content }: { content: HomeContent["finalCta"] }) {
  const track = useAnalytics("home");
  return (
    <section className="section" aria-labelledby="cta-title">
      <div className="container">
        <Reveal className="glass">
          <div style={{ textAlign: "center", padding: "3.5rem 2rem" }}>
            <h2 id="cta-title" className="section-heading">
              {content.heading}
            </h2>
            <p className="section-sub">{content.sub}</p>
            <Link
              href="/quote"
              className="btn btn-primary btn-lg"
              onClick={() => track("cta_clicked", { element: "final_cta" })}
            >
              {content.cta}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Home({ content }: { content: HomeContent }) {
  const { carriers, failed } = useMaCarriers();
  const quotableNames = useMemo(
    () => (carriers ? carriers.filter((c) => c.quotable).map((c) => c.name) : null),
    [carriers],
  );
  const faqs = useMemo(
    () => content.faq.items.map((item) => resolveFaq(item, quotableNames)),
    [content.faq.items, quotableNames],
  );
  return (
    <div className="page" style={{ paddingTop: 0 }}>
      <Hero content={content.hero} />
      <HowItWorks content={content.howItWorks} />
      <CarrierMarquee content={content.carriers} carriers={carriers} failed={failed} />
      <Faq content={content.faq} faqs={faqs} />
      <FinalCta content={content.finalCta} />
    </div>
  );
}
