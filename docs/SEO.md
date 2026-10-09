# QuotePilot — SEO

> SEO from day one (CONTEXT rule 4). Last updated: 2026-10-08 (v0.10.1 — Next.js metadata API).

## 1. Per-page title / meta / OG / canonical strategy

Every route gets a unique `<title>`, `meta description`, Open Graph + Twitter tags, and a
canonical URL — rendered **server-side** via the Next.js metadata API
(`generateMetadata` per route in `apps/web/src/app/`, shared helpers in
`src/lib/metadata.ts`), replacing the client-side `react-helmet-async` used before
v0.10.0. Crawlers and link previews now see full tags in the first HTML response;
no JavaScript required. The dashboard (`:5174`) is `noindex, nofollow` — it's an internal tool.

| Page      | Path        | Title (≤ 60 chars)                                  | Meta description (≤ 160 chars)                                                        | Canonical              |
| --------- | ----------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------- |
| Home      | `/`         | QuotePilot — Compare Car Insurance Quotes in Minutes | Enter your details once. QuotePilot pulls quotes from every carrier in your state, on-site and by email. | `https://quotepilot.app/` |
| Wizard    | `/quote`    | Get Your Quotes — QuotePilot                        | Answer 5 quick steps. We fetch real-time quotes from GEICO, Progressive, Allstate and more. | `https://quotepilot.app/quote` |
| Quotes    | `/quotes`   | Your Quotes Are Ready — QuotePilot                  | Your ranked car-insurance quotes, side by side. Compare price, coverage, and deductibles. | `https://quotepilot.app/quotes` |
| Compare   | `/compare`  | Compare Quotes Side by Side — QuotePilot            | Line up carriers on price, coverage limits, and deductibles. Pick the best deal with confidence. | `https://quotepilot.app/compare` |
| Agents    | `/agents`   | Find Local Insurance Agents — QuotePilot            | Local independent agents near you, with phone numbers, for carriers that sell through agents. | `https://quotepilot.app/agents` |
| About     | `/about`    | How QuotePilot Works — QuotePilot                   | One form, every carrier, quotes by email. How our quote engine and agent directory work. | `https://quotepilot.app/about` |
| Dashboard | `:5174`     | QuotePilot · Usage Dashboard                        | Internal analytics — `noindex, nofollow`.                                           | —                      |

OG defaults (all public pages): `og:type=website`, `og:site_name=QuotePilot`,
`og:image=https://quotepilot.app/og/cover.png` (1200×630), `twitter:card=summary_large_image`.
Quote-result pages (`/quotes/:jobId`) are `noindex` — personalized content must never be indexed.

### SSR rendering split (v0.10.0) and what it means for SEO

- **Fully server-rendered HTML:** `/about`, `/terms`, `/privacy`, `/disclosures`,
  `not-found` — crawlers get complete content with zero JS.
- **SSR SEO shell + client islands:** `/` ships server-rendered title/meta/OG/
  canonical and FAQ JSON-LD; the hero ZIP form, carrier marquee, and FAQ
  accordion hydrate as client islands (interactive by nature, not crawlable content).
- **Client-rendered by design:** `/quote`, `/quotes/[jobId]`, `/agents` need the
  browser (localStorage, polling, Leaflet). Nothing indexable lives behind a form
  or a job id — server-rendering them would add complexity for zero crawlable
  content, so the SEO-critical metadata is still correct while the bodies hydrate.
- The Quotes page SSR title uses the "gathering" variant; the client flips to
  "Your quotes are ready" on completion (document.title, as before).

## 2. sitemap.xml

Served at `/sitemap.xml`, generated at build time from the route table (never from user data):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://quotepilot.app/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://quotepilot.app/quote</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://quotepilot.app/agents</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://quotepilot.app/compare</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>https://quotepilot.app/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
</urlset>
```

State-specific agent pages (`/agents/ma`, `/agents/nh`, …) are added as the directory grows —
each gets its own row with `changefreq=weekly`.

## 3. robots.txt

```
User-agent: *
Allow: /
Disallow: /quotes/
Disallow: /api/

Sitemap: https://quotepilot.app/sitemap.xml
```

Personalized quote pages and all API routes stay out of the index. The analytics dashboard
runs on a separate port and sends `noindex, nofollow` regardless.

## 4. JSON-LD structured data

**Organization** (on `/`, in `<head>`):

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "QuotePilot",
  "url": "https://quotepilot.app/",
  "description": "One form, quotes from every car-insurance carrier in your state — on-site and by email.",
  "sameAs": []
}
```

**FAQPage** (on `/` and `/about` — real questions from the wizard UX):

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How does QuotePilot get my quotes?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You enter your details once. Our quote engine queries every carrier serving your state in the background, then shows ranked results on-site and emails them to you."
      }
    },
    {
      "@type": "Question",
      "name": "Is my personal information shared with carriers?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Only the rating factors carriers need — ZIP code, vehicle class, and coverage selections. We never log or store full personal details in analytics."
      }
    },
    {
      "@type": "Question",
      "name": "Which states are supported?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "All 50 states. Carrier registries are state-aware: the national core everywhere, regional carriers where verified, each state graded for data quality."
      }
    }
  ]
}
```

Validate with Google's Rich Results Test before each release.

## 5. Performance budget (SEO is speed)

| Metric              | Budget        | How we hold it                                              |
| ------------------- | ------------- | ----------------------------------------------------------- |
| LCP                 | < 2.5 s       | Critical CSS inline; hero image preloaded, AVIF/WebP, sized |
| Initial JS          | < 200 KB gzip | Route-level code splitting; no heavy chart lib (hand-rolled SVG) |
| CLS                 | < 0.1         | Reserved space for quote cards / skeletons; no layout-shifting ads |
| INP                 | < 200 ms      | Debounced wizard inputs; adapter work stays server-side     |
| Time to interactive | < 3.5 s       | Next.js code splitting, minimal deps, `prefers-reduced-motion` respected |

Lighthouse CI runs on every PR: performance ≥ 90, accessibility ≥ 95, SEO = 100.
Anything below fails the build.

## 6. Semantic HTML rules

- Exactly one `<h1>` per page; heading levels never skipped (`h1 → h2 → h3`).
- Quote results use `<article>` per carrier card inside a `<section aria-label="Your quotes">`.
- Forms: real `<form>`, `<fieldset>` + `<legend>` per wizard step, `<label>` for every input.
- Navigation in `<nav>`, footer content in `<footer>`, main content in `<main>`.
- Images: descriptive `alt`; decorative images get `alt=""`.
- URLs are human-readable and stable (`/agents/ma`, not `/agents?state=MA&v=2`).
- `lang="en"` on `<html>`; phone numbers use `tel:` links; addresses use `<address>`.
