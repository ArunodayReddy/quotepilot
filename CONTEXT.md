# QuotePilot — Project Context

> **Living document.** This file is the single source of truth for the project's goals, non-negotiable rules,
> architecture, and data. Every agent working on QuotePilot must read this file first, build toward it, and
> append new rules here (under "Rule log") as decisions are made — never edit the project against rules that
> contradict this file without updating it first.
> Last updated: 2026-10-08 · Status: v0.1.0 kickoff

---

## 1. Mission

Build the best car-insurance quote comparison site on the internet. A user enters their details once, easily;
in the background QuotePilot pulls quotes from every relevant insurance company for their state; quotes are
delivered on the website and by email when ready; the user compares side-by-side and picks the best deal.
If 10 projects are submitted to a hackathon, this one stands out as the best. If someone tries to break it,
it holds.

Owner's mandate: Apple-grade UI/UX, futuristic but effortless, zero-hassle experience, WCAG-grade
accessibility, full SEO, structured logging, click analytics with a usage dashboard, per-state carrier
coverage, local-agent directory with phone numbers, and a hardened security posture ("unhackable" mindset).

## 2. Non-negotiable rules

1. **UI bar: Apple-level.** Generous whitespace, fluid motion, dark/light adaptive, glassy surfaces, buttery
   transitions, one primary action per screen. Every new screen must be reviewed against the visual language
   in `docs/VISUALS.md`. No clutter, no dead ends.
2. **Effortless data entry.** Multi-step wizard with smart defaults, inline validation, progress saved locally
   (resumable), plain-language questions, minimal typing (pickers, sliders, VIN decode assist).
3. **Accessibility is not optional.** WCAG 2.2 AA: semantic HTML, labeled controls, focus management, visible
   focus states, keyboard-complete flows, `prefers-reduced-motion` support, color-contrast ≥ 4.5:1, screen-reader
   tested landmarks. See `docs/ACCESSIBILITY.md`.
4. **SEO from day one.** Semantic markup, unique titles/meta/OG tags per page, sitemap, robots.txt, canonical
   URLs, JSON-LD structured data, performance budget (LCP < 2.5s). See `docs/SEO.md`.
5. **Every feature ships with logging.** Structured JSON logs (request id, user id hashed, event, duration,
   outcome). Never log PII, secrets, or raw form payloads. See `docs/LOGGING.md`.
6. **Every user interaction is an analytics event.** Clicks, step completions, quote views, comparisons, email
   opt-ins, agent calls — all funneled into the usage dashboard in `analytics/dashboard/`.
7. **Quote engine = adapter pattern.** One adapter per carrier (`apps/api/src/adapters/<carrier>.ts`), all
   implementing the shared `QuoteAdapter` interface in `packages/shared`. Simulation adapters today, real
   carrier APIs tomorrow — the interface must not change when real integrations land.
8. **State-aware everything.** Carrier list, required coverages, minimum limits, and agent directory all key
   off the user's state. `data/carriers/<STATE>.json` is the registry; unknown states degrade gracefully.
9. **Async quote delivery.** Quotes run as background jobs. User gets a job id, sees live progress on-site, and
   receives quotes by email when ready. Never block the UI on a carrier.
10. **Security-first ("unhackable" mindset).** Input validation on every boundary, parameterized everything,
    rate limiting, CSRF protection, CSP headers, no secrets in client bundles, dependency scanning, no PII in
    logs/analytics. See `docs/SECURITY.md`.
11. **Sample data only.** Test fixtures live in `data/sample/` and contain masked/demo data derived from the
    owner's real policy. Real PII (VINs, policy numbers, exact addresses, phone numbers) is never committed.
12. **Changelog + context discipline.** Every work session appends to `CHANGELOG.md` and records new durable
    rules in this file's Rule log. Visual design data lives in `docs/VISUALS.md` and grows with the UI.
13. **Hackathon-demo ready.** The project must always be runnable with `scripts/dev.sh` and demo-able from a
    clean checkout in under 2 minutes. `docs/DEMO.md` holds the 90-second pitch script.

## 3. Architecture (target)

```
quote-pilot/
├── CONTEXT.md              ← this file (rules, always current)
├── README.md               ← what it is, how to run it
├── CHANGELOG.md            ← what changed, when
├── docs/                   ← VISUALS, SECURITY, SEO, ACCESSIBILITY, LOGGING, ARCHITECTURE, DEMO
├── apps/
│   ├── web/                ← React + Vite + TypeScript. Pages: Home, Wizard, Quotes, Compare, Agents, Dashboard, About
│   └── api/                ← Node + Express + TypeScript
│       └── src/
│           ├── routes/     ← /api/quote, /api/quotes/:jobId, /api/agents, /api/analytics, /api/email
│           ├── services/   ← jobQueue, emailService, analyticsService, carrierRegistry
│           ├── adapters/   ← one file per carrier, implements QuoteAdapter
│           ├── middleware/ ← validate, rateLimit, auth, errorHandler
│           └── lib/        ← logger, config, validation schemas
├── packages/shared/        ← shared TypeScript types + QuoteAdapter interface + state data helpers
├── data/
│   ├── carriers/           ← <STATE>.json registry: carrier id, name, channel (direct/agent), states served, logo
│   ├── agents/             ← <STATE>.json local-agent directory seed (name, city, phone, carriers)
│   └── sample/             ← masked test profile derived from owner's policy (see §6)
├── analytics/
│   └── dashboard/          ← usage dashboard app (clicks, funnels, carrier performance)
├── scripts/                ← dev.sh, build.sh, seed.sh
└── tests/                  ← unit + e2e (fixtures use data/sample only)
```

Data flow: Wizard form → POST /api/quote (validated) → job created → adapters run in background with
per-carrier timeouts → results stream to /api/quotes/:jobId → email sent when job completes → every step
emits analytics events.

## 4. MVP scope (v0.1.0 kickoff → v0.2.0 demo)

- [ ] Home page with hero + how-it-works + live demo CTA
- [ ] Quote wizard (5 steps: location → drivers → vehicle → coverage → contact) with validation + resume
- [ ] State-aware carrier registry: MA fully seeded; NH + CA + TX starter lists
- [ ] Quote engine with simulation adapters for 6+ MA carriers (pricing anchored to real quote research)
- [ ] Quotes results page: ranked cards, side-by-side compare, coverage breakdown
- [ ] Email delivery: "email me when ready" + completed-quotes email (dev: logged; prod: SMTP)
- [ ] Local agents page: per-state/ZIP directory with names + phone numbers
- [ ] Analytics dashboard: clicks, funnel, carrier latency/win-rate
- [ ] SEO tags, sitemap, accessibility pass, security headers, structured logging
- [ ] 90-second demo script + demo video script in docs/DEMO.md

## 5. Carrier registry — Massachusetts (seeded 2026-10-08 from real quote research)

Direct-to-consumer: GEICO, Progressive, Allstate, Liberty Mutual, Plymouth Rock, Amica, State Farm, USAA.
Agent-only (independent agents): Commerce (MAPFRE), Safety Insurance, Arbella, Hanover, Norfolk & Dedham,
Plymouth Rock (also agent). Lemonade Car: NOT available in MA (waiting list only) — show as "coming soon",
never as quotable.
Anchor data point: Allstate MA quoted $1,347 / 6 months paid in full for 50/100/50 + UM 50/100 + $500
comp/collision (Oct 2026, owner research). Simulation adapters must price within realistic bands of this.

## 6. Sample test data (masked from owner's State Farm declarations, 2026-10-08)

See `data/sample/profile.sample.json`. Masking applied: VIN truncated to last 4, policy number redacted,
address generalized to ZIP, emails/phones replaced with `example.com`/`555-0100` placeholders, agent name
kept as "Sample Agent". Never unmask in commits.

## 7. Visual data

Design tokens, component inventory, and screenshots/mockups accumulate in `docs/VISUALS.md`. Every visual
change must be recorded there with a date.

## 8. Rule log (append-only; newest at bottom)

- 2026-10-08 (v0.4.0 agents+map): provider chain is the law for agent data — Google Places
  (GOOGLE_PLACES_API_KEY) primary, sample seed fallback; `source` on every agent, "Live data"/
  "Sample data" badges non-negotiable. Never invent real businesses or real phone numbers;
  sample entries keep 555-01xx phones, approximate coords, obviously-sample street numbers.
  ZIP centroids are demo-grade approximations (documented in data/geocode/zip_centroids.json);
  production uses a real geocoder. In-memory Places cache: 24 h TTL, keyed by rounded lat/lng.
  Maps: Leaflet + OSM tiles (no key); every pin has an accessible list equivalent — the map is
  never the only path to the data.

- 2026-10-08 (github push): GitHub App cannot create repos (403) and cannot git-push (no token);
  bulk push goes through the `push_files` MCP tool, one approval per call. Keep each call's JSON args
  under ~120KB (shell single-arg limit) — split into batches. Skip `package-lock.json` (oversized);
  `npm install` regenerates. Local git history and GitHub history are intentionally divergent; all
  GitHub-side changes go through `push_files`, never `git push`.

- 2026-10-08 (kickoff): Rules 1–13 ratified. Adapter interface is the law; simulation pricing must anchor to
  real researched quotes. Sample data stays masked forever.
- 2026-10-08 (dashboard+docs track): analytics dashboard polls GET /api/analytics/summary every 30s
  (+ manual refresh); "Send test event" fires cta_clicked/page=dashboard/element=send-test-event.
  Visual change log in docs/VISUALS.md is append-only — the web track appends there; never rewrite it.
- 2026-10-08 (v0.2.0 integration): parallel tracks build contract-first against a coordinator-issued
  API contract; the coordinator runs the integration smoke (install → build → dev.sh → end-to-end
  quote job with the sample profile) and merges. Changelog carries ONE entry per release —
  tracks contribute sections to it, never parallel entries.
- 2026-10-08 (v0.2.0 integration): every quote surface in the UI must carry the
  "Simulated — demo pricing" label — non-negotiable, verified in the built bundle.
  Simulation pricing stays anchored to researched anchors (Allstate ≈ $1,347/6mo for the sample
  profile shape; all carriers within the 1100–1900 band) and deterministic (identical input →
  identical output via hash of identity-free profile fields).
- 2026-10-08 (v0.2.0 integration): analytics stores session IDs as truncated SHA-256 hashes only;
  event metadata matching email-like patterns is dropped on write. No PII in logs, analytics,
  or the public job view — verified by scan and tests.
- 2026-10-08 (v0.3.0 form overhaul): no hardcoded content lists in the UI — carrier names,
  marquee, and the states/carriers FAQ all render from GET /api/carriers. The wizard collects
  industry-standard fields (DOB date picker, marital status, street address) but the API
  contract is unchanged: age is derived client-side from DOB, marital status and street
  address stay form-local until real adapters consume them. localStorage schema bumps get a
  new key version (v1 → v2), never a silent migration. Web gender enum must match the API
  zod enum exactly (`prefer_not_to_say`); web/API enum drift is a 400-class bug.
