import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { Reveal } from "../components/Reveal";

export function Disclosures() {
  return (
    <div className="page">
      <Seo
        title="Important Disclosures — QuotePilot"
        description="The fine print, made readable: who QuotePilot is, what simulated pricing means, consent choices, and state-specific insurance notes."
        path="/disclosures"
      />
      <div className="container">
        <div className="prose">
          <Reveal>
            <h1 className="section-heading" style={{ textAlign: "left" }}>Important Disclosures</h1>
            <p className="section-sub" style={{ textAlign: "left", marginLeft: 0 }}>
              The fine print — written like a human. Last updated: October 8, 2026.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>Who we are</h2>
            <p>
              QuotePilot is an insurance <strong>comparison and lead-generation website</strong>. We are
              <strong> not an insurance company and not a licensed insurance producer</strong>. We do not
              sell, issue, underwrite, or bind insurance, and we do not collect premiums. Nothing on this
              site should be read as insurance advice.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>Estimates, not offers</h2>
            <p>
              Every price shown in this demo is a <strong>simulated estimate</strong>, not an offer of
              insurance. Estimates are based on the information you entered and pricing bands anchored to
              real quote research. Your actual premium — and whether a carrier will insure you at all —
              is determined solely by the carrier's own underwriting when you apply with them directly.
              Coverage requirements, discounts, and surcharges vary by state and by carrier.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>State notes</h2>
            <p>
              Insurance is regulated state by state. When you view quotes for a supported state, we show
              a "Good to know" panel with educational notes about that state's rules (for example,
              mandatory coverages and how driving records affect rates). These notes are for education
              only — they are not legal or insurance advice. We currently publish notes for
              24 states (including verified minimum-coverage figures); other states show
              results without the panel while notes are prepared.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>Your contact choices</h2>
            <ul>
              <li>
                <strong>Email quotes (required for email delivery):</strong> checking this box lets us
                email your quotes when they're ready. You can stop these emails at any time by replying
                STOP or using the unsubscribe link.
              </li>
              <li>
                <strong>Phone contact (optional):</strong> this checkbox starts <em>unchecked</em>. If
                you check it, you give express written consent for QuotePilot and the carriers and
                licensed agents shown with your quotes to call or text you about your quotes, including
                with automated dialing or prerecorded messages. Consent is <strong>not a condition</strong> of
                getting quotes or buying insurance.
              </li>
            </ul>
          </Reveal>

          <Reveal as="div">
            <h2>Agent directory</h2>
            <p>
              The local-agent directory lists independent agents for convenience. Sample listings are
              clearly badged as sample data with placeholder phone numbers (555-01xx) — they are not real
              businesses. We don't endorse any agent, and we don't receive compensation from directory
              listings.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>Data</h2>
            <p>
              We collect only what's needed to run your quote comparison, we never sell personal data,
              and we never log full PII. Details are in the <Link to="/privacy">Privacy Policy</Link>;
              the full rulebook lives in the project docs
              (<code>docs/COMPLIANCE.md</code> in the source repository).
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>Questions</h2>
            <p>
              See <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>,
              or start a <Link to="/quote">new quote</Link>.
            </p>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
