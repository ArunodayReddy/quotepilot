"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  fireAnalytics,
  getConsentDecision,
  setConsentDecision,
} from "../lib/analytics";

/**
 * Cookie/analytics consent banner. First visit only (all pages via Layout).
 * - Accept → anonymous analytics enabled (hashed session IDs, no PII).
 * - Decline → analytics event sending disabled entirely.
 * - Choice persists in localStorage `quotepilot.consent.v1`.
 * - "Cookie settings" footer link re-opens via the
 *   `quotepilot:cookie-settings` window event.
 * Accessible: role=dialog, focus moves to the heading on open, Escape = decline.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (getConsentDecision() === null) setVisible(true);
    const reopen = () => setVisible(true);
    window.addEventListener("quotepilot:cookie-settings", reopen);
    return () => window.removeEventListener("quotepilot:cookie-settings", reopen);
  }, []);

  useEffect(() => {
    if (visible) headingRef.current?.focus();
  }, [visible]);

  const decide = (accepted: boolean) => {
    setConsentDecision(accepted);
    setVisible(false);
    if (accepted) {
      fireAnalytics("consent_given", { page: window.location.pathname });
    }
  };

  if (!visible) return null;

  return (
    <div
      className="glass cookie-banner"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-banner-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") decide(false);
      }}
    >
      <h2 id="cookie-banner-title" ref={headingRef} tabIndex={-1}>
        A quick word on cookies
      </h2>
      <p>
        We remember your quote progress on your device, and — only if you allow
        it — collect anonymous analytics (clicks and page views, never personal
        data) to improve QuotePilot. Read our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <div className="cookie-banner-actions">
        <button type="button" className="btn btn-primary" onClick={() => decide(true)}>
          Accept analytics
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => decide(false)}>
          Decline
        </button>
      </div>
    </div>
  );
}
