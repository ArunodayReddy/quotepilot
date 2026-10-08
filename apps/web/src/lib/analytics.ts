/* Analytics: every user interaction fires an event to /api/analytics/event.
   Contract: { event, page, element?, sessionId, metadata? } — metadata must NEVER contain PII. */
import { useCallback } from "react";

const SESSION_KEY = "quotepilot.session";

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
  | "agents_see_all_click";

interface FireOptions {
  page: string;
  element?: string;
  metadata?: Record<string, string | number | boolean>;
}

const eventQueue: FireOptions[] = [];

/** Fire-and-forget analytics POST. Never throws; never blocks UI. */
export function fireAnalytics(event: AnalyticsEventName, opts: FireOptions): void {
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
