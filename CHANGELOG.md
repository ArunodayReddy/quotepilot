# QuotePilot — Changelog

All notable changes to this project are documented here. Newest at the top.
Format: `## [version] — date` with Added / Changed / Fixed / Security sections.

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
  presence, consent defaults, footer links, claims-audit sweep). Suite 123/123 green.

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
