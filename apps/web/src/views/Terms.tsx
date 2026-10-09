import Link from "next/link";
import { Reveal } from "../components/Reveal";

export function Terms() {
  return (
    <div className="page">
      <div className="container">
        <div className="prose">
          <Reveal>
            <h1 className="section-heading" style={{ textAlign: "left" }}>Terms of Service</h1>
            <p className="section-sub" style={{ textAlign: "left", marginLeft: 0 }}>
              Last updated: October 8, 2026. Plain-language summary of how QuotePilot works.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>What QuotePilot is</h2>
            <p>
              QuotePilot is a demo insurance-comparison website. You enter details once, and we show
              side-by-side price <strong>estimates</strong> from carriers that serve your state — plus a
              directory of local independent agents. QuotePilot is <strong>not an insurance company
              and not a licensed insurance producer</strong>. We don't sell policies, issue coverage,
              collect premiums, or bind insurance.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>Simulated pricing</h2>
            <p>
              In this demo build, <strong>every price shown is simulated demo pricing</strong> — realistic
              bands anchored to real quote research, not real carrier offers. Nothing on this site is an
              offer of insurance, a promise of a particular price, or a guarantee that a carrier will
              insure you. Your final premium is determined solely by the carrier's underwriting when you
              apply with them directly.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>Use the site fairly</h2>
            <ul>
              <li>Provide accurate information — quotes only make sense when the inputs do.</li>
              <li>Don't scrape, hammer, or try to break the service.</li>
              <li>Don't enter anyone else's personal information.</li>
              <li>Don't rely on simulated prices for financial decisions.</li>
            </ul>
          </Reveal>

          <Reveal as="div">
            <h2>Your information</h2>
            <p>
              Wizard answers stay in your browser until you submit a quote request. How we handle what
              you share is described in our <Link href="/privacy">Privacy Policy</Link>. We don't sell
              personal data — ever.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>Availability</h2>
            <p>
              Carrier coverage varies by state; our per-state carrier registries reflect which carriers
              we have data for. Not every carrier serves every state, and coverage can change. Check the
              <Link href="/disclosures"> Important Disclosures</Link> page for state-specific notes.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>Limitation of liability</h2>
            <p>
              QuotePilot is provided "as is" for demonstration purposes, without warranties of any kind.
              We're not responsible for decisions made from simulated prices or for any carrier's actual
              underwriting, pricing, or claims handling.
            </p>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
