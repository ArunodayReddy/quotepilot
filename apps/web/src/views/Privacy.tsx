import Link from "next/link";
import { Reveal } from "../components/Reveal";

export function Privacy() {
  return (
    <div className="page">
      <div className="container">
        <div className="prose">
          <Reveal>
            <h1 className="section-heading" style={{ textAlign: "left" }}>Privacy Policy</h1>
            <p className="section-sub" style={{ textAlign: "left", marginLeft: 0 }}>
              Last updated: October 8, 2026. We collect as little as possible — and we never sell
              your personal data.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>What we collect</h2>
            <ul>
              <li><strong>Contact details</strong> — email and phone, so we can deliver your quotes and (only with your opt-in) contact you about them.</li>
              <li><strong>Quote inputs</strong> — driver details, vehicle details, and coverage choices, used solely to generate your quote comparison.</li>
              <li><strong>Quote results</strong> — which carriers priced your profile and the simulated prices shown, so you can revisit and compare.</li>
              <li><strong>Usage analytics</strong> — clicks, step completions, and page views with anonymous session IDs (truncated hashes). Anything that looks like an email address is dropped before storage.</li>
            </ul>
          </Reveal>

          <Reveal as="div">
            <h2>Why we collect it</h2>
            <ul>
              <li>To generate and deliver your insurance quote comparison.</li>
              <li>To email you when your quotes are ready (only if you asked).</li>
              <li>To contact you by phone or text (only if you checked the optional consent box).</li>
              <li>To improve the product — aggregated, never tied to you.</li>
            </ul>
          </Reveal>

          <Reveal as="div">
            <h2>What we never do</h2>
            <ul>
              <li><strong>We never sell your personal data</strong> — not to carriers, agents, data brokers, or anyone else.</li>
              <li>We never put full PII in logs or analytics.</li>
              <li>We never send marketing email you didn't ask for. Quote-delivery emails only go to people who requested quotes.</li>
            </ul>
          </Reveal>

          <Reveal as="div">
            <h2>Sharing</h2>
            <p>
              Your quote request is processed by QuotePilot to produce your comparison. In this demo
              build, carrier pricing is simulated in-house — your details are not transmitted to real
              carriers. If you contact a listed agent yourself, you're sharing information directly
              with them under their own policies.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>Your rights</h2>
            <p>
              You may ask to <strong>know</strong> what we have about you, <strong>delete</strong> it,
              or <strong>correct</strong> it, and to <strong>opt out</strong> of any sharing. We won't
              treat you differently for exercising these rights. To make a request, email us from the
              address you used on the site — details are on our <Link href="/about">About</Link> page.
            </p>
          </Reveal>

          <Reveal as="div">
            <h2>Retention & storage</h2>
            <ul>
              <li>Wizard answers stay in your browser (localStorage) so you can resume; they're cleared when you submit.</li>
              <li>Quote jobs are kept only as long as needed to serve your quotes and run the demo.</li>
              <li>Contact preferences (email and phone consent) are stored with your quote request as yes/no flags.</li>
            </ul>
          </Reveal>

          <Reveal as="div">
            <h2>Children</h2>
            <p>
              QuotePilot is for adults shopping for car insurance. We don't knowingly collect
              information from children under 13.
            </p>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
