import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { SimBadge } from "../components/SimBadge";
import { Reveal } from "../components/Reveal";
import { useAnalytics } from "../lib/analytics";

const CARRIERS = ["GEICO", "Progressive", "Allstate", "Liberty Mutual", "Plymouth Rock", "Amica"];

const FAQS = [
  {
    q: "How does QuotePilot work?",
    a: "You fill out one short form — location, drivers, vehicle, coverage, and contact. QuotePilot then asks every relevant carrier for your state to price that exact profile, and shows the results ranked side by side. When everything is in, we email you a copy too.",
  },
  {
    q: "Are these real insurance quotes?",
    a: "No. This demo build shows simulated pricing in realistic bands anchored to real Massachusetts quote research (for example, Allstate quoted $1,347 / 6 months for our sample profile in October 2026). Every quote card carries a 'Simulated — demo pricing' badge so it's always clear.",
  },
  {
    q: "Which states and carriers are supported?",
    a: "Massachusetts is fully seeded with carriers like GEICO, Progressive, Allstate, Liberty Mutual, Plymouth Rock, and Amica, plus agent-only carriers through the local agent directory. Starter lists exist for NH, CA, and TX. Unknown states degrade gracefully — you'll get a clean empty state, not an error.",
  },
  {
    q: "What happens to my personal information?",
    a: "Nothing leaves the demo. Your wizard answers are saved only in your browser (localStorage) so you can resume where you left off. We never log PII, never sell data, and analytics events carry only anonymous metadata — no names, emails, or addresses.",
  },
  {
    q: "How long does it take?",
    a: "Carriers respond at their own pace, so quoting runs as a background job. You'll see live progress ('4 of 6 carriers'), and most demo runs complete in under a minute. You can leave and come back — the job link keeps working.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "QuotePilot",
  url: "https://quotepilot.example.com",
  description:
    "One form. Every carrier. The best deal. QuotePilot gathers car insurance quotes from every relevant carrier in your state.",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

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
            One form. Every carrier. <span className="gradient-text">The best deal.</span>
          </h1>
        </Reveal>
        <Reveal>
          <p className="hero-sub">
            Tell us about yourself once. QuotePilot quietly gathers car insurance quotes from
            every carrier in your state and ranks them for you — on the site and by email.
          </p>
        </Reveal>
        <Reveal>
          <div className="hero-ctas">
            <Link
              to="/quote"
              className="btn btn-primary btn-lg"
              onClick={() => track("cta_clicked", { element: "hero_get_my_quotes" })}
            >
              Get my quotes →
            </Link>
            <Link
              to="/quote"
              className="btn btn-secondary btn-lg"
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
      title: "Pick the best deal",
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

function CarrierMarquee() {
  // Duplicate the list for a seamless loop.
  const items = [...CARRIERS, ...CARRIERS];
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
      <div className="marquee-wrap" role="list" aria-label="Example carriers (simulated)">
        <div className="marquee">
          {items.map((c, i) => (
            <span key={i} className="carrier-badge" role="listitem" aria-hidden={i >= CARRIERS.length}>
              {c}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
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
          {FAQS.map((f, i) => (
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
  return (
    <div className="page" style={{ paddingTop: 0 }}>
      <Seo
        title="QuotePilot — One form. Every carrier. The best deal."
        description="QuotePilot gathers car insurance quotes from every relevant carrier in your state with one short form. Compare ranked quotes on the site and by email. Demo build with simulated pricing."
        path="/"
        jsonLd={jsonLd}
      />
      <Hero />
      <HowItWorks />
      <CarrierMarquee />
      <Faq />
      <FinalCta />
    </div>
  );
}
