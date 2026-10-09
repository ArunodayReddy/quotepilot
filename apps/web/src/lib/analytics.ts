/* Analytics: every user interaction fires an event to /api/analytics/event.
   Contract: { event, page, element?, sessionId, metadata? } — metadata must NEVER contain PII. */
import { useCallback } from "react";

const SESSION_KEY = "quotepilot.session";
const CONSENT_KEY = "quotepilot.consent.v1";

export type ConsentDecision = boolean | null;

/** Read the stored analytics consent decision: true/false, or null if undecided. */
export function getConsentDecision(): ConsentDecision {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as { analytics?: boolean };
    return parsed.analytics === true;
  } catch {
    return null;
  }
}

/** Persist the user's analytics consent choice. */
export function setConsentDecision(accepted: boolean): void {
  try {
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ analytics: accepted, decidedAt: new Date().toISOString() }),
    );
  } catch {
    // Storage unavailable — consent simply won't persist.
  }
}

/** Re-open the cookie banner (used by the footer's "Cookie settings" link). */
export function openCookieSettings(): void {
  window.dispatchEvent(new CustomEvent("quotepilot:cookie-settings"));
}

export function getSessionId(): string {
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(SESSION_KEY, id);
    }
  } catch {
    // Storage unavailable (private mode); fall back to an ephemeral id.
    id = id ?? `ephemeral-${Date.now()}`;
  }
  return id;
}

export type AnalyticsEventName =
  | "page_view"
  | "wizard_step_completed"
  | "cta_clicked"
  | "quote_job_created"
  | "quotes_viewed"
  | "carrier_card_expanded"
  | "compare_opened"
  | "email_optin"
  | "agent_phone_clicked"
  | "zip_search_submitted"
  | "quotes_progress_view"
  | "savings_headline_view"
  | "inline_email_capture"
  | "agents_section_view"
  | "agents_see_all_click"
  | "loading_view"
  | "consent_given";

interface FireOptions {
  page: string;
  element?: string;
  metadata?: Record<string, string | number | boolean>;
}

const eventQueue: FireOptions[] = [];

/** Fire-and-forget analytics POST. Never throws; never blocks UI.
 *  Gated on cookie consent: events are only sent after the user accepts
 *  analytics in the cookie banner. Declined or undecided → dropped silently. */
export function fireAnalytics(event: AnalyticsEventName, opts: FireOptions): void {
  if (getConsentDecision() !== true) return;
  const payload = {
    event,
    page: opts.page,
    element: opts.element,
    sessionId: getSessionId(),
    metadata: opts.metadata,
    ts: new Date().toISOString(),
  };
  try {
    void fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      /* analytics must never break the app */
    });
  } catch {
    eventQueue.push(opts);
  }
}

/** React hook returning a bound fire function for the current page. */
export function useAnalytics(page: string) {
  return useCallback(
    (event: AnalyticsEventName, extra?: Omit<FireOptions, "page">) =>
      fireAnalytics(event, { page, ...(extra ?? {}) }),
    [page],
  );
}
