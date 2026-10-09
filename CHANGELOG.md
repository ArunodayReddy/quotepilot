# QuotePilot — Changelog

All notable changes to this project are documented here. Newest at the top.
Format: `## [version] — date` with Added / Changed / Fixed / Security sections.

## [0.11.0] — 2026-10-09 — "Real quotes via agents"

The first real (non-simulated) product path: instead of fake carrier prices,
the user submits once and licensed local agents receive a professional quote
request — real quotes from real agents. The adapter-based carrier results stay
honestly labeled simulations; real-time carrier APIs need producer licensing
and carrier appointments that code alone can't provide.

### Added
- `POST /api/quote-requests` → 201: Zod-validated
  `{ jobId, agentIds[1..3], contact: { name, email, phone }, consent }`.
  `jobId` must reference a **completed** quote job (404/422 otherwise);
  `agentIds` re-validated server-side against the agent directory (422 on
  unknown ids); `consent` must be literally `true` (TCPA — anything else 400).
  Returns `QP-XXXXXX` reference codes (unambiguous alphabet, no 0/O/1/I/L).
- Delivery chain per agent: verified agent email → professional request email
  (subject `New quote request QP-XXXXXX — N driver(s), M vehicle(s), ZIP`;
  body: structured profile with **age bands, never exact ages**; QuotePilot
  identified as a comparison service, not a producer) → `emailed`. No email on
  file → honest **`handoff`** card (tap-to-call/website) — never a fake send.
- User receipt email (dev-log until SMTP configured): ref code, per-agent
  status, honest expectations ("real quotes from licensed agents — not
  estimates").
- `quote_requests` persistence in the analytics SQLite store (gitignored;
  `:memory:` in tests; Postgres migration is future work). Contact is stored
  for its consented purpose but **never logged** — logs carry ref code +
  truncated phone hash only.
- Results-page "Get real quotes" flow: agent checkbox cards (max 3, accessible
  fieldset/legend) → review panel (contact prefilled **read-only** from the
  wizard's localStorage draft with "Edit in wizard →" link; manual-entry
  fallback so it's never a dead end) → confirmation with big ref code,
  per-agent status ("Request emailed to X" / "Call X at {phone} — mention ref
  {code}"), tap-to-call, honest expectations copy, and a **"Copy my details"**
  button. TCPA checkbox **unchecked by default** with not-a-condition language.
- `JobQueue.getJobRequest`: the profile summary is built server-side from the
  stored job — the client is never trusted to describe the profile.
- 5/hour-per-IP rate limit on quote requests (`quoteRequestLimiter`).
- Analytics: `quote_request_submitted` with delivery mix only — no PII.
- `services/agentDirectory.ts`: agent-directory provider chain extracted for
  reuse (`routes/agents.ts` refactored onto it, same behavior/logs).
- `emailService` refactored around a shared `sendMail` core (SMTP/dev-log,
  domain-only logging); `sendQuotesReady` behavior unchanged.
- Shared types: `QuoteRequestContact/Delivery/HandoffCard`,
  `CreateQuoteRequestInput/Response`, `QuoteRequestRecord`,
  `QuoteRequestDeliveryMethod`.

### Fixed
- Three broken `Link to=` react-router leftovers in Quotes.tsx.

### Verification
- API suite: **148/148 pass** (138 before + 10 new `quoteRequests.test.ts`:
  consent=false/missing rejected, >3/0 agents rejected, unknown job 404,
  unknown agent 422, handoff delivery + user receipt, emailed path with mocked
  directory/transport asserting age bands and no exact ages, no raw
  phone/email/name in any log line, 5/hour limit → 429 on the 6th).
- Live smoke (dev server, sample MA profile): job → complete → agents →
  `POST /api/quote-requests` → **201**, ref `QP-E4SN54`, 2 handoff cards with
  phones/addresses; PII-leak scan of the log: **0 hits**.

### Known limitation
- Today every delivery is `handoff`: neither Google Places nor the sample
  seeds carry agent email addresses, so the `emailed` path is wired, tested,
  and waiting — but not live. The unlock is an agent claim/portal flow where
  agencies verify and register a contact email (future work). Until then the
  tap-to-call handoff IS the real product.

## [0.10.1] — 2026-10-08 — Docs sync (v0.9.0 + v0.10.0)

Narrative docs re-synced with the two releases that landed after v0.8.0 wrote
them — no code changes.

### Changed
- `docs/PRODUCT.md`: tech stack Vite SPA → Next.js 14.2 App Router (React 18);
  new SSR-split and 100k-scaling sections; architecture diagram updated
  (Next.js web, queue abstraction, quote cache, sink abstraction); SEO paragraph
  now describes the metadata API; test count 120+ → 138/138.
- `docs/DECISIONS.md`: entry #23 updated from "decision pending" to decided
  (Next.js migration shipped, SSR split rule, Stencil rejected with reasons);
  new ADRs #25–#29 (Next 14 + React 18, infrastructure-optional law, cache-key
  PII rule, fail-open analytics, in-process BullMQ worker).
- `docs/ARCHITECTURE.md`: frontend → App Router route map; job queue §4
  rewritten around the `JobQueue` abstraction; analytics §5 around the
  `AnalyticsSink` interface; ports table (Next.js dev, optional Redis).
- `docs/SEO.md`: `react-helmet-async` → `generateMetadata`; new SSR split
  section; `/wizard` → `/quote` in sitemap; states FAQ answer updated to all
  50 states.
- `docs/DEPLOY.md`: Vercel → Next.js framework preset (minimal `vercel.json`);
  `VITE_API_URL` → `NEXT_PUBLIC_API_URL`; new optional scaling env vars section
  (`REDIS_URL`, `DATABASE_URL`, `CACHE_TTL_SECONDS`, `RATE_LIMIT_*`).
- `docs/AI_ARCHITECTURE.md`: process inventory (Next.js web, queue/cache/sink/
  rate-limiter backends); `/api/health` now documents live backend selection;
  `NEXT_PUBLIC_` replaces `VITE_` in the client-bundle rule.

### Fixed
- 5 stale `web compliance surfaces (static)` API tests pointed at Vite-era
  files (`apps/web/src/components/Layout.tsx`); repointed to the App Router
  route files and `views/` (incl. `Footer.tsx`). Suite back to 138/138.

## [0.10.0] — 2026-10-08 — Next.js migration (full SSR)

### Changed
- Frontend migrated in place from Vite SPA to **Next.js 14.2 (App Router)**, React 18 kept.
  Every route mirrored: `/`, `/quote`, `/quotes/[jobId]`, `/agents`, `/about`,
  `/terms`, `/privacy`, `/disclosures`, plus a server `not-found` page.
- **Rendering split:** About/Terms/Privacy/Disclosures/not-found fully prerendered
  server HTML; Home ships an SSR SEO shell (title/meta/OG/canonical + FAQ JSON-LD)
  with the interactive hero/marquee/FAQ as client islands; Wizard/Quotes/Agents stay
  client components (localStorage, polling, Leaflet require the browser — nothing
  indexable behind a form, so SSR there would add complexity for zero SEO gain).
- SEO: `react-helmet-async` replaced by the Next.js metadata API
  (`generateMetadata` per route); JSON-LD preserved; `app/sitemap.ts`-ready
  (public sitemap.xml/robots.txt untouched).
- `VITE_API_URL` → `NEXT_PUBLIC_API_URL`; dev `/api/*` proxying via
  `next.config.mjs` rewrites (override with `API_PROXY_TARGET`).
- `apps/web/vercel.json` simplified to Next.js preset + security headers.
- Uninstalled: vite, @vitejs/plugin-react, react-router-dom, react-helmet-async.
- `src/pages/*` → `src/views/*` (Next reserves `src/pages/`); deleted
  vite.config.ts, index.html, src/main.tsx, src/App.tsx.
- Analytics `fireAnalytics` now uses the shared `API_BASE` (correct origin in prod).

### Verified
- `next build` green (10/10 pages; 8 prerendered static); `tsc --noEmit` clean.
- Dev smoke: all routes 200, SSR HTML confirmed on /about, end-to-end TX quote job
  through the Next proxy completes with 4 simulated quotes; web→API contract intact.
- `scripts/dev.sh` unchanged (API :3001 + web :5173 + dashboard :5174).

### Notes
- push_files has no delete: removed Vite-era files were pushed as empty placeholders
  on GitHub (harmless, nothing references them).
- Minor: quotes-page SSR title uses the "gathering" variant (client still flips to
  "ready" on completion); home JSON-LD uses the generic carriers FAQ at SSR time.

## [0.9.0] — 2026-10-08 — Scale to 100k

### Added
- **Queue abstraction** (`services/queue.ts`): `JobQueue` interface with
  `MemoryQueue` (default, original behavior) and `BullMQQueue` (selected when
  `REDIS_URL` is set — job state in Redis, worker concurrency 10, retries with
  backoff, jobs survive restarts, any fleet instance can serve job status).
  Shared `jobExecutor.ts` core keeps both backends byte-identical.
- **Quote-result cache** (`services/quoteCache.ts`): SHA-256 of rating factors
  only (never email/phone/names); Redis or in-memory LRU; `POST /api/quote`
  returns `200 + cached:true` on hit (~10ms), `202 + cached:false` on miss.
- **Analytics sink** (`services/analyticsSink.ts`): `SqliteSink` default,
  `PostgresSink` when `DATABASE_URL` set (schema-compatible, fail-open to SQLite).
- **Rate-limit store factory**: `rate-limit-redis` when `REDIS_URL` set, else
  memory; tiers env-configurable (`RATE_LIMIT_*_PER_MIN`).
- **Statelessness**: shared agent cache (Redis or per-instance), `/api/health`
  reports live backend selection, graceful shutdown (15s drain).
- **Load test** (`tests/load/quote-spike.js`, k6): 0→200 VUs with p95/error
  thresholds; small pass (20 VUs): 2,205 iterations, 0 failures, submit p95 3.7ms.
- `docs/SCALING.md`: architecture, before/after bottleneck table, 100k-MAU
  capacity math, horizontal-scaling runbook, explicit not-built list.

### Design rules
- Every new infrastructure piece is optional with a graceful in-memory fallback:
  `scripts/dev.sh` works from a clean checkout with zero new config.

### Verified
- `scripts/build.sh` green; 133/138 API tests pass incl. 16 new scaling tests
  (queue parity, cache hit/miss/TTL/LRU, PII-free keys, sink selection + fail-open,
  rate-limit factory, HTTP cached flow). 5 failures are stale compliance static
  tests pointing at Vite-era web files deleted by the v0.10.0 migration (fixed
  separately).

## [0.8.0] — 2026-10-08 — Portfolio documentation pass

### Added
- **`docs/PRODUCT.md`** — portfolio case study: problem & users, product decisions
  with reasoning (one form, ZIP-first, background fan-out, unified results, honest
  degradation, engagement without dark patterns, 50-state grades, compliance-first),
  architecture overview with mermaid diagram, tech stack with per-choice rationale,
  design-system thinking, APIs & integrations (current + planned), SEO/analytics/
  dashboard strategy, legal approach, content-feed freshness model, ZIP functionality,
  map integration, estimate-engine deep-dive, and an explicit real-vs-roadmap section.
- **`docs/DECISIONS.md`** — append-only ADR-style decision log, 24 entries seeded
  from the full build history (adapter pattern, simulation anchors, sample-data
  honesty, feed-driven UI, provider chain, Leaflet, ZIP-first, honest degradation,
  validation parity, 50-state grades, compliance + attorney-review-required,
  consent-gated analytics, Vite-SPA-today/SSR-deferred, push mechanics), each dated
  and tied to its release.
- **`docs/AI_ARCHITECTURE.md`** — systems/intelligence document: running-process
  inventory (web :5173, API :3001, dashboard :5174 + in-API subsystems), decision-
  making components, mermaid sequence diagrams for the quote-job lifecycle and
  agent search flow, full API contract table, and an explicitly-marked ML roadmap
  (rules-based today; learned pricing, win-rate prediction, personalized ranking
  as future insertion points — no ML claimed that doesn't exist).

## [0.7.0] — 2026-10-08 — Compliance build

### Added
- **Legal pages**: `/terms`, `/privacy`, `/disclosures` — plain-language, Apple-grade
  prose pages with per-page SEO (title/meta/OG/canonical). Footer links to all three
  from **every page**; footer also carries "QuotePilot is not an insurance company or
  licensed insurance producer…" + estimates-not-offers + state-availability note.
- **`docs/COMPLIANCE.md`**: the compliance model — what QuotePilot is (comparison/
  lead-gen, not insurer/producer) and isn't; sourced per-state notes (MA SDIP + $8k
  PIP + banned rating factors; CA Prop 103 + 20% Good Driver Discount; TX file-and-use;
  NH 25/50/25); TCPA posture (unchecked-by-default, named callers, not-a-condition
  language, one-to-one rule vacated Jan 2025); CAN-SPAM posture; CCPA/CPRA-informed
  privacy posture. Every regulatory claim carries a source; production launch
  checklist included.
- **TCPA express-written-consent checkbox** in the wizard contact step: optional,
  **unchecked by default** (even in sample fill), names QuotePilot + carriers/agents
  as callers, states consent is not a condition of getting quotes or purchasing
  insurance. Separate required email-consent checkbox retained for quote delivery.
  Consent choices persist with the quote request (`emailOptIn`, `phoneOptIn` on the
  API contract; booleans only logged, no PII).
- **Per-state disclosures**: `data/disclosures/{MA,TX,CA,NH}.json` served by new
  `GET /api/disclosures/:state` (404 for unknown states); results page renders a
  "Good to know in {state}" panel (graceful degradation — no panel when missing).
- **Quote disclaimer component** (shared track): `QuoteDisclaimer` with "Estimates,
  not offers" heading + SimBadge pairing, rendered on quote results; "Simulated —
  demo pricing" badge unchanged and mandatory everywhere.
- CAN-SPAM footer on quote-ready emails (postal address from `SENDER_POSTAL_ADDRESS`
  env; clearly-marked placeholder in dev — never invented business data) + unsubscribe
  line; `.env.example` documents the requirement.
- `apps/api/tests/compliance.test.ts` — 15 assertions: disclosure registry, consent
  schema defaults, non-PII public job view, and static web-surface checks (disclosure
  presence, consent defaults, footer links, claims-audit sweep) + minCoverage shape
  validation across all 24 states (incl. MA 2026, VA 2025, TN 2023 law-change
  spot-checks). Suite 122/122 green.
- **State minimum coverage data**: `minCoverage` (`biPerPerson`, `biPerAccident`,
  `propertyDamage`, `pip`, `notes`, `verified`) added to `data/disclosures/*.json`
  for **24 states** — TX 30/60/25, CA 15/30/5, MA 25/50/30 + $8k PIP (2026 law
  change), FL 10/20/10 + $10k PIP, NY 25/50/10 + $50k PIP, IL 25/50/20, OH 25/50/25,
  PA 15/30/5 + $5k medical, GA 25/50/25, NC 30/60/25, VA 50/100/25 (2025 law
  change), NJ 15/30/5 + $15k PIP, CT 25/50/25, WA 25/50/10, AZ 25/50/15, CO 25/50/15,
  MI 50/100/10, MN 30/60/10 + $40k PIP, NV 25/50/20, OR 25/50/20 + $15k PIP,
  TN 25/50/25 (2023 PD change), WI 25/50/10, MD 30/60/15, NH (not mandatory;
  financial-responsibility minimums). Verified 2026-10-08; unverified states carry
  NO field (never guessed). Results page shows the minimum line in the state
  disclosure panel; the wizard coverage step shows a "State minimum: X" hint with
  "verify with your state's DOI" microcopy.
- **Cookie consent banner**: first-visit, all pages — Accept/Decline, persists in
  `quotepilot.consent.v1`; declining (or not yet deciding) disables analytics event
  sending (gated in `lib/analytics.ts`); `consent_given` event fires on accept;
  footer "Cookie settings" re-opens it. Accessible (role=dialog, focus to heading,
  Escape declines, reduced-motion friendly).

### Changed
- Claims audit: "best deal" / "best price" guarantee language scrubbed from marketing
  surfaces (hero → "Compare side by side", cheapest-card ribbon → "Lowest estimate");
  savings figures remain computed-from-real-results only.
- Public job view now carries the 2-letter `state` (non-PII) to drive disclosures.
- localStorage wizard key bumped v2 → v3 (new `consentPhone` field per schema rule).

## [0.6.0] — 2026-10-08 — Nationwide + deploy prep

### Added
- **All 50 states**: `data/carriers/<STATE>.json` for every state. National core
  everywhere (GEICO, Progressive, Allstate, Liberty Mutual quotable via simulation
  adapters; State Farm, Farmers, Nationwide, Travelers agent-channel; USAA
  military-only) plus regionals only where confident (Erie, Auto-Owners, American
  Family, Mercury, Wawanesa, AAA, Plymouth Rock, NJM, Farm Bureaus, NYCM, Concord,
  Arbella), each tagged `"confidence": "medium"`. Amica quotable in 48 states
  (not licensed in AK/HI — flagged honestly). `data/carriers/README.md` documents
  per-state data grades (MA/TX full, CA/NH good, rest starter).
- **223 ZIP centroids** in `data/geocode/zip_centroids.json` (major metros per state;
  documented demo-grade approximations).
- **Deploy prep**: `apps/web/vercel.json` (Vite SPA rewrites + security headers),
  `render.yaml` (Render blueprint: free tier, health check, env vars), `docs/DEPLOY.md`
  (click-by-click Vercel + Render guide, smoke checklist, troubleshooting),
  `VITE_API_URL` support in the web API client (dev proxy unchanged), env-driven CORS
  allow-list, `trust proxy` for correct rate limiting behind Render.
- Tests: `apps/api/tests/registry.test.ts` — 57 assertions covering all 50 states
  (well-formed entries, >=3 carriers, quotable ⟺ wired adapter, Amica AK/HI rule) +
  CA/FL/NY quote-job smokes. Suite now 105/105 green.

### Changed
- `.env.example`: added `CORS_ORIGIN`, `APP_BASE_URL`, `VITE_API_URL` (web) with docs.
- Simulation pricing bands remain MA-anchored; non-MA quotable entries carry an explicit
  approximation note (honest-degradation law upheld — no fake pricing anywhere).

## [0.5.1] — 2026-10-08 — Validation hardening + delightful loading

### Added
- **Delightful loading states**: new `LoadingMessages` component — brand-styled CSS orb loader
  (three pulsing gradient dots, no emoji spinners) paired with rotating witty-but-honest status
  lines every 3s ("Knocking on GEICO's door…", "Finding humans near you…"). Wired into quote
  progress, the results-page agents section, and the agents directory search. Respects
  `prefers-reduced-motion` (static first line, no animation). Fires `loading_view` analytics
  (context only, no PII) once per loading session.
- **Live character counters** on free-text fields (names, street address, model, trim, email)
  showing `x/max`, matching server limits.
- **Blur validation**: every field validates on blur with instant, specific feedback; errors
  clear the moment the field becomes valid (no waiting for Continue).

### Fixed
- **Client/server validation drift** (all would-have-400'd): ZIP now strictly 5 digits
  (was accepting ZIP+4 the API rejects); vehicle year min 1981 (was 1980); years-licensed
  capped at 84 (server max); phone validates both raw length (7–20, server rule) and digit
  count (7–15). New `apps/web/src/lib/validation.ts` is the single source of truth for
  client rules, mirroring `apps/api/src/lib/schemas.ts` — 50/50 edge-case checks pass.
- Names now accept Unicode letters (José, François) instead of ASCII-only.
- DOB gets an explicit "that date can't be in the future" message (was folded into the
  age-range message).
- `maxLength` attributes on every bounded field (street 100, names 50, email 254, phone 20,
  make/model/trim 60, ZIPs 5); Home hero ZIP now imports the shared `ZIP_RE`.

### Changed
- Error-message voice guide enforced everywhere: human, specific, actionable — never
  "Invalid input". Error ring on focus for invalid fields.
- Custom `Select` trigger now supports `onBlur` for blur validation.

## [0.5.0] — 2026-10-08 — "Hooked" release: ZIP-first, Texas, unified results

### Added
- **ZIP-first homepage**: the hero's primary CTA is now a ZIP entry field (5-digit validation,
  `inputmode="numeric"`, `autocomplete="postal-code"`, labeled + inline errors). Submit stashes
  the ZIP into wizard localStorage (location step prefilled) and routes to `/quote`. "Start without
  a ZIP" and "Try with sample data" remain as secondary links. Tracks `zip_search_submitted`
  (3-digit prefix only — no full ZIP in analytics).
- **Texas support**: `data/carriers/TX.json` rewritten — 11 real carriers with honest channels
  (GEICO, Progressive, Allstate, Liberty Mutual quotable via simulation adapters; State Farm,
  Farmers, Texas Farm Bureau, Germania, Travelers, Nationwide agent-channel; USAA direct but
  military-eligibility). Every registry entry now carries a `website` domain (shared + web types
  extended). 13 TX ZIP centroids added (Denton 76201/76205/76210, Dallas, Fort Worth, Houston,
  Austin, San Antonio). `data/agents/TX.json`: 3 Denton-area sample agents. TX quote jobs run
  4 adapters; verified live (Allstate $1,367 / GEICO $1,275 / Liberty Mutual $1,532 /
  Progressive $1,378 — simulated).
- **Unified results page**: online quotes and local agents on one screen — "Online quotes —
  instant" (ranked cards) above "Local agents near {ZIP} — humans who can help" (compact
  AgentMap + top-3 cards + "See all agents" deep-link to `/agents?zip=&state=`). Location comes
  from wizard localStorage; without it the section degrades to a directory link (never guessed).
- **Honest non-instant carriers**: "More carriers in {state}" section lists registry carriers
  with no simulation adapter — direct carriers link out to their site, agent-only carriers link
  to the agent directory. No fake prices, ever. Unavailable carriers (e.g. Lemonade in MA)
  stay excluded via `available: false`.
- **Engagement mechanics (truthful only)**: live progress upgraded with per-carrier status rows
  + skeleton pending rows; savings headline computed from real results ("Up to $X every 6 months
  between the cheapest and priciest quote"); inline email capture while waiting ("Email me when
  all N quotes land" → existing `notifyEmail`); new analytics events `quotes_progress_view`,
  `savings_headline_view`, `inline_email_capture`, `agents_section_view`, `agents_see_all_click`.
- **Agents page deep-links**: `/agents?zip=76201&state=TX` prefills and auto-searches.

### Fixed
- `readQuoteLocation()` shared helper in `lib/wizard.ts` replaces the Agents-page-local ZIP reader.

### Tests
- 48/48 API tests pass (3 new TX tests: registry channels, TX job with 4 adapters, TX agents
  geocoded + sorted). `scripts/build.sh` green across all workspaces.

## [0.4.0] — 2026-10-08 — Local agent finder: real-data provider chain + map

### Added
- **Agent provider chain** (`apps/api/src/services/agentProvider.ts`): Google Places
  (`GOOGLE_PLACES_API_KEY`) primary — Nearby Search `type=insurance_agency` + Place Details
  (name, address, phone, hours, geometry); sample-seed fallback when the key is missing or
  Places errors. Every agent carries `source: "google_places" | "sample"`.
- **Distance sorting**: `GET /api/agents?state=&zip=` geocodes via `data/geocode/zip_centroids.json`
  (demo-grade approximations, documented) and sorts by haversine miles; unknown ZIP → 200 with
  `geocoded:false` + explanatory note.
- **Leaflet AgentMap** (`apps/web/src/components/AgentMap.tsx`): numbered pins, popups with
  name/address/phone/hours, auto-fit bounds, OSM tiles (no key); every pin has an accessible
  list-card equivalent — the map is never the only path.
- **Agents page**: state + ZIP search, "Use my quote ZIP" (reads wizard localStorage), agent cards
  with tap-to-call `tel:` links, open-hours blocks, carrier chips, languages, and non-negotiable
  "Live data" / "Sample data" source badges.
- In-memory Places cache (24h TTL, rounded lat/lng key). `GOOGLE_PLACES_API_KEY` documented in
  `.env.example`.

### Rules (CONTEXT.md)
- Provider chain is the law; never invent real businesses or real phone numbers — sample entries
  keep 555-01xx phones and obviously-sample street numbers.

## [0.3.0] — 2026-10-08 — Form overhaul: real dropdowns, date picker, dynamic content

### Added
- **Custom accessible `Select`** (`apps/web/src/components/Select.tsx`): button + listbox, full
  keyboard (arrows/Home/End/Enter/Escape/type-ahead), ARIA listbox pattern, focus return,
  `prefers-reduced-motion` support. Used for state (50 + DC), gender, marital status, vehicle
  year/make, usage, ownership, coverage limits, deductibles, accidents/violations.
- **DOB date picker**: `<input type="date" max=today autocomplete="bday">`; age derived
  client-side (`ageFromDob`) — API contract unchanged. Marital status + street address collected
  form-local until real adapters consume them.
- **Industry-standard fields**: WHATWG autocomplete tokens, `inputmode`, `fieldset`/`legend`
  groups, `aria-describedby` hint/error wiring across the wizard.
- **`GET /api/carriers?state=`** feed endpoint (zod-validated, graceful unknown-state 200);
  Home marquee + states/carriers FAQ + JSON-LD now render from the live registry — zero hardcoded
  carrier lists in the UI.
- localStorage schema bumped to `quotepilot.wizard.v2` (no silent migrations).

### Fixed
- Web→API gender enum drift (`prefer-not-to-say` → `prefer_not_to_say`) that 400'd sample submits.
- Accidents/violations cap aligned to the API max (0–5+).

### Tests
- 32/32 API tests (3 new carriers-route tests). Web `tsc -b` clean.

## [0.2.0] — 2026-10-08 — Demo MVP (three-track parallel build + coordinator integration)

### Added — web app (`apps/web`, quotepilot-web, React 18 + Vite 6 + TS strict, :5173)
- Pages with real URLs: `/` Home (animated orb/glass hero, how-it-works, carrier marquee,
  FAQ accordion, JSON-LD Organization + FAQ), `/quote` 5-step wizard (location → drivers →
  vehicle → coverage → contact; inline validation, aria-live errors, progress + step indicator,
  heading focus per step, localStorage resume under `quotepilot.wizard.v1`, one-click sample-data
  fill), `/quotes/:jobId` (2s polling, "Gathering quotes… N of 6" progress, ranked carrier cards,
  **"Simulated — demo pricing" badge on every card**, gold "Best deal" ribbon on #1,
  coverage-match meter, expandable caveats, compare-up-to-3 table, email-me-my-quotes),
  `/agents` (state + ZIP → agent cards with tel: links + "Sample data" badges), `/about`
  (mission, honest simulation disclosure, security/privacy summary), 404 page.
- Design tokens in `src/styles/tokens.css`; dark/light adaptive (`data-theme` +
  `prefers-color-scheme`), glassmorphism, FOUC-free theme toggle; skip link, semantic
  landmarks, visible focus rings, `prefers-reduced-motion` disables all motion, contrast ≥ 4.5:1.
- SEO: unique title/meta/OG/canonical per page (react-helmet-async), `robots.txt`,
  `sitemap.xml`. Build green (232KB JS / 22KB CSS).
- Analytics: sessionId (`crypto.randomUUID()` in `quotepilot.session`); events for page_view,
  wizard steps, CTAs, quote lifecycle, compare, email opt-in, agent phone clicks — never PII.

### Added — API (`apps/api`, Express + TS, :3001) + `packages/shared`
- Routes exactly per contract: `POST /api/quote` → 202 job, `GET /api/quotes/:jobId`
  (queued/running/complete/failed + progress + ranked results), `GET /api/agents?state=&zip=`,
  `POST /api/analytics/event` → 201, `GET /api/analytics/summary`,
  `POST /api/email/notify` → 202, `GET /api/health`.
- 6 simulation adapters (geico, progressive, allstate, libertyMutual, plymouthRock, amica)
  implementing the `QuoteAdapter` interface in `packages/shared/src/types.ts`; deterministic
  ±3% jitter from SHA-256 of identity-free profile fields; anchored to research —
  Allstate ≈ $1,322/6mo vs the $1,347 anchor, all carriers in the 1100–1900 band with distinct
  pricing personalities, latencies (200–2500ms), caveats, coverage-match %.
- In-memory job queue (parallel adapters, 8s per-carrier timeout, fails closed), BullMQ/Redis
  upgrade path in `apps/api/UPGRADE_PATH.md`; emailService (dev-log mode; nodemailer via
  SMTP_* env); analyticsService (better-sqlite3; sessionId stored as truncated SHA-256,
  email-like metadata dropped on write).
- Security: zod on every boundary (unknown keys stripped, 64KB body cap), helmet + strict CSP,
  CORS locked to localhost:5173/5174, rate limits (quote 10/min, analytics 120/min, global
  300/min → 429), structured JSON request logs (requestId/method/path/status/duration — no
  bodies/PII), error shape `{error:{code,message,requestId}}` with no stack leaks, 404 handler.
- Data seeds: `data/carriers/MA.json` (14 entries; 6 quotable direct; agent-only Commerce,
  Safety, Arbella, Hanover, Norfolk & Dedham; Lemonade `{available:false}`), NH/CA/TX starters;
  `data/agents/MA.json` (8 entries, fake 555-01xx phones, `sample:true`).
- Tests: 29/29 vitest pass (adapter band/determinism/personality/risk-sensitivity + route
  E2E incl. 400s, 404s, analytics hashing, PII-drop, email notify).
### Added — analytics dashboard + docs + root infra
- `analytics/dashboard/` (quotepilot-dashboard): standalone Vite + React + TS app on :5174.
  Polls `GET /api/analytics/summary` every 30s + manual Refresh; views for clicks-by-element
  (hand-rolled SVG horizontal bars), wizard funnel (step 1→5 + quotes_viewed with % of entry),
  carrier performance table (quotes, avg latency ms, win rate % with bars), daily sessions
  (SVG vertical bars, last 14 days). Dark glassy theme with own token set, skip link, tablist
  keyboard nav, `role=alert` API-error banner, graceful empty state ("No events yet — use the
  main app to generate data") with "Send test event" button. `npm run build` green
  (tsc + vite; JS 151KB / 48.8KB gzip, under the 200KB budget).
- `docs/`: ARCHITECTURE.md (ASCII diagram, data flow, adapter pattern, job queue + BullMQ/Redis
  upgrade path, SQLite analytics DDL, ports table, validation boundaries), SECURITY.md
  (STRIDE-lite threat model + "unhackable" checklist), SEO.md (per-page meta/OG/canonical table,
  sitemap, robots.txt, JSON-LD Organization + FAQ, performance budget), ACCESSIBILITY.md
  (WCAG 2.2 AA checklist as implemented + testing procedure), LOGGING.md (structured JSON log
  format, never-logged list, levels, client+server event taxonomy), VISUALS.md (design tokens,
  component inventory, screenshots placeholder, append-only visual change log), DEMO.md
  (word-for-word 90-second pitch with timed beats, live demo flow + stage fallbacks, judge Q&A
  cheat sheet).
- Root infra: `package.json` (workspaces `apps/*`, `packages/*`, `analytics/*`; scripts
  `dev`/`build`/`test`), `scripts/dev.sh` (prereq checks, workspace install if needed, launches
  api/web/dashboard with logs to `/tmp/quotepilot-*.log`, 15s API health-check, Ctrl+C cleanup),
  `scripts/build.sh` (builds shared → api → web → dashboard in order, fails fast),
  `.env.example` (PORT/SMTP_*/EMAIL_FROM/NODE_ENV/ANALYTICS_SALT, no secrets), `.gitignore`
  (node_modules, dist, *.db, .env, logs).
- `CONTEXT.md` rule log: dashboard poll cadence + test-event convention recorded.

### Integration verification (coordinator, 2026-10-08)
- `npm install` (root workspaces) clean; `scripts/build.sh` green for shared → api → web →
  dashboard; `scripts/dev.sh` launches all three services (API :3001, web :5173, dashboard :5174).
- End-to-end smoke with `data/sample/profile.sample.json`: `POST /api/quote` → 202 job →
  polled to `complete` with 6 ranked results (GEICO $1,274 cheapest → Amica $1,576; Allstate
  $1,322 within 2% of the $1,347 research anchor; all `simulated:true`).
- Agents: 8 MA sample agents, all `sample:true`, fake 555-01xx phones; unknown state → 200
  with `agents:[]`. Analytics: event → 201, summary aggregates clicks/funnel/carrier latency +
  win-rate/daily sessions. Email notify → 202 (dev-log mode). Invalid body → 400
  `VALIDATION_ERROR` with requestId; unknown job (valid UUID) → 404; malformed jobId → 400.
- Rate limit verified: 429s on the 11th+ rapid `POST /api/quote` (10/min). Security headers
  live: CSP, HSTS, nosniff, frame-options. Web `:5173/api/health` proxies to API; SPA fallback
  serves `/agents`; "Simulated — demo pricing" present in built web bundle; no secrets found
  in source scan.
- Fixed in integration: merged duplicate `docs/VISUALS.md` headings from parallel tracks
  (single change log preserved). Note: API :3001 is currently the API track's leftover E2E
  server (same code as built); kill it and re-run `scripts/dev.sh` for a fully clean slate.

## [0.1.0] — 2026-10-08 — Project kickoff

### Added
- Project created at `~/workspace/quote-pilot/` with full monorepo folder structure
  (`apps/web`, `apps/api`, `packages/shared`, `data/`, `analytics/`, `docs/`, `scripts/`, `tests/`).
- `CONTEXT.md`: living project context — mission, 13 non-negotiable rules, target architecture,
  MVP scope, MA carrier registry seed (from real Oct 2026 quote research), masked sample-data policy,
  and an append-only rule log.
- `README.md`: project overview + quick-start target.
- Seeded carrier intelligence: MA direct carriers (GEICO, Progressive, Allstate, Liberty Mutual,
  Plymouth Rock, Amica, State Farm, USAA), MA agent-only carriers (Commerce/MAPFRE, Safety, Arbella,
  Hanover), Lemonade Car flagged not-available in MA. Anchor: Allstate $1,347/6mo paid in full.

### Next
- v0.2.0 demo build: wizard UI, quote engine with simulation adapters, results/compare pages,
  email delivery, agents directory, analytics dashboard, SEO/accessibility/security pass, demo script.
