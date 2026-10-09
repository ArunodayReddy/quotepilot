import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { Reveal } from "../components/Reveal";
import { useAnalytics } from "../lib/analytics";

export function About() {
  const track = useAnalytics("about");
  return (
    <div className="page">
      <Seo
        title="About QuotePilot — honest simulated quote comparison"
        description="QuotePilot's mission: one form, every carrier, compared side by side. Learn how the demo simulation works, how your data is handled, and what we do for security."
        path="/about"
      />
      <div className="container">
        <div className="prose">
          <Reveal>
            <h1 className="section-heading" style={{ textAlign: "left" }}>About QuotePilot</h1>
          </Reveal>
          <Reveal>
            <p className="section-sub" style={{ textAlign: "left", marginLeft: 0 }}>
              Shopping for car insurance shouldn't mean filling out the same form twelve times.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>Our mission</h2>
            <p>
              QuotePilot exists to make car insurance shopping effortless: you describe yourself once, we
              quietly ask every relevant carrier in your state to price that profile, and you compare
              them side by side — on the site and by email. No phone tag. No repeated forms. No dark
              patterns.
            </p>
            <p>
              <strong>QuotePilot is not a licensed insurance producer.</strong> We help you compare;
              carriers issue policies. See our <Link to="/disclosures">Important Disclosures</Link>.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>How the simulation works (honest disclosure)</h2>
            <p>
              This demo build does <strong>not</strong> talk to real carriers. Each carrier is implemented as
              a simulation adapter that prices your profile using pricing bands anchored to real quote
              research. For example, our sample profile (2024 Tesla Model Y, 50/100/50 + UM 50/100, $5k
              med-pay, $500 deductibles, two clean drivers, Cambridge MA) was quoted by Allstate at $1,347 /
              6 months in October 2026 — simulated quotes land in realistic bands around that anchor.
            </p>
            <p>
              Every quote card carries a <strong>"Simulated — demo pricing"</strong> badge so it's never
              ambiguous. The architecture is designed so real carrier integrations can replace the simulation
              adapters one by one without changing the interface — the same job, progress, and results API.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>Security & privacy</h2>
            <ul>
              <li>Wizard answers are stored only in your browser (localStorage) so you can resume later.</li>
              <li>No PII in logs, analytics, or error reports — analytics carry anonymous metadata only.</li>
              <li>Input validation on every boundary, rate limiting, and CSP headers on the API.</li>
              <li>No secrets in the client bundle. Sample data is masked placeholders — never real people, VINs, addresses, or phone numbers.</li>
            </ul>
          </Reveal>

          <Reveal as="div">
            <h2>Documentation</h2>
            <p>
              Technical deep-dives — accessibility statement, SEO plan, logging, security model, and the
              90-second demo script — live in the project docs. This page stays honest: if you're reading
              this in the demo, you're seeing simulated pricing.
            </p>
            <Link
              to="/quote"
              className="btn btn-primary btn-lg"
              onClick={() => track("cta_clicked", { element: "about_cta" })}
            >
              Try the demo →
            </Link>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
