"use client";

import Link from "next/link";
import { openCookieSettings } from "../lib/analytics";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <h4>QuotePilot</h4>
            <p>One form. Compare carriers side by side. Demo experience with simulated pricing.</p>
          </div>
          <nav aria-label="Footer">
            <h4>Explore</h4>
            <ul>
              <li><Link href="/">Home</Link></li>
              <li><Link href="/quote">Get quotes</Link></li>
              <li><Link href="/agents">Local agents</Link></li>
              <li><Link href="/about">About</Link></li>
            </ul>
          </nav>
          <nav aria-label="Legal">
            <h4>Legal</h4>
            <ul>
              <li><Link href="/terms">Terms of Service</Link></li>
              <li><Link href="/privacy">Privacy Policy</Link></li>
              <li><Link href="/disclosures">Important Disclosures</Link></li>
            </ul>
          </nav>
          <div>
            <h4>Honest pricing</h4>
            <ul>
              <li>All quotes shown are simulated demo pricing</li>
              <li>No personal data is sold or shared</li>
            </ul>
          </div>
        </div>
        <p className="footer-disclaimer">
          QuotePilot is not an insurance company or licensed insurance producer. All prices are
          simulated estimates, not offers of insurance — your final premium is determined by the
          carrier&apos;s underwriting. Carrier availability varies by state.
        </p>
        <div className="footer-bottom">
          <span>© 2026 QuotePilot. Demo build — all prices simulated.</span>
          <span>Sample data only. No real PII.</span>
          <button
            type="button"
            className="btn-danger-ghost"
            onClick={openCookieSettings}
            style={{ padding: 0 }}
          >
            Cookie settings
          </button>
        </div>
      </div>
    </footer>
  );
}
