/* Home page content helpers — server-safe (no "use client").
 *
 * Copy lives in the CMS (apps/web/data/content/home.json); this module holds
 * only the dynamic composition logic: the registry-driven carriers FAQ answer
 * and the JSON-LD builder.
 */

import type { FaqItem } from "./cms";

/** Human list: "A, B, and C". */
function formatList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * The states/carriers FAQ answer, composed from the live registry instead of a
 * hardcoded carrier list. The sentence template comes from the CMS item;
 * falls back to the CMS static answer when the registry fetch fails.
 */
export function carriersAnswer(quotable: string[] | null, item: FaqItem): string {
  if (!quotable || quotable.length === 0 || !item.dynamicPrefix || !item.dynamicSuffix) {
    return item.fallback ?? "";
  }
  return `${item.dynamicPrefix}${formatList(quotable)}${item.dynamicSuffix}`;
}

export function buildJsonLd(faqs: { q: string; a: string }[], description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "QuotePilot",
    url: "https://quotepilot.example.com",
    description,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** FAQ list for server-rendered JSON-LD: dynamic slots use their CMS fallback. */
export function staticFaqs(items: FaqItem[]): { q: string; a: string }[] {
  return items.map((item) =>
    item.dynamic === "carriers"
      ? { q: item.q, a: carriersAnswer(null, item) }
      : { q: item.q, a: item.a ?? "" },
  );
}
