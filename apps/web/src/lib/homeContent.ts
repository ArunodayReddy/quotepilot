/* Home page content data — server-safe (no "use client"). Shared by the client
 * Home component and the server app/page.tsx (which renders JSON-LD). */

export const FAQ_DEFS = [
  {
    id: "how",
    q: "How does QuotePilot work?",
    a: "You fill out one short form — location, drivers, vehicle, coverage, and contact. QuotePilot then asks every relevant carrier for your state to price that exact profile, and shows the results ranked side by side. When everything is in, we email you a copy too.",
  },
  {
    id: "real",
    q: "Are these real insurance quotes?",
    a: "No. This demo build shows simulated pricing in realistic bands anchored to real Massachusetts quote research (for example, Allstate quoted $1,347 / 6 months for our sample profile in October 2026). Every quote card carries a 'Simulated — demo pricing' badge so it's always clear.",
  },
  {
    id: "carriers",
    q: "Which states and carriers are supported?",
    a: "", // filled dynamically from the carrier registry (see carriersAnswer)
  },
  {
    id: "privacy",
    q: "What happens to my personal information?",
    a: "Nothing leaves the demo. Your wizard answers are saved only in your browser (localStorage) so you can resume where you left off. We never log PII, never sell data, and analytics events carry only anonymous metadata — no names, emails, or addresses.",
  },
  {
    id: "timing",
    q: "How long does it take?",
    a: "Carriers respond at their own pace, so quoting runs as a background job. You'll see live progress ('4 of 6 carriers'), and most demo runs complete in under a minute. You can leave and come back — the job link keeps working.",
  },
];

/** Human list: "A, B, and C". */
function formatList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * The states/carriers FAQ answer, sourced from the live registry instead of a
 * hardcoded carrier list. Falls back to generic copy when the fetch fails.
 */
export function carriersAnswer(quotable: string[] | null): string {
  const base =
    "Texas is fully seeded too — online carriers plus a Denton-area agent directory. " +
    "Starter lists exist for NH and CA. Unknown states degrade gracefully — you'll get a " +
    "clean empty state, not an error.";
  if (!quotable || quotable.length === 0) {
    return `Massachusetts is fully seeded with direct and agent-only carriers, plus a local agent directory. ${base}`;
  }
  return `Massachusetts is fully seeded with ${formatList(quotable)}, plus agent-only carriers through the local agent directory. ${base}`;
}

export function buildJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "QuotePilot",
    url: "https://quotepilot.example.com",
    description:
      "One form. Every carrier. Compare side by side. QuotePilot gathers car insurance quotes from every relevant carrier in your state.",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Static FAQ list for server-rendered JSON-LD (generic carriers answer). */
export function staticFaqs(): { q: string; a: string }[] {
  return FAQ_DEFS.map((f) =>
    f.id === "carriers" ? { q: f.q, a: carriersAnswer(null) } : { q: f.q, a: f.a },
  );
}
