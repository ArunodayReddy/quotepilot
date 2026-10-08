# QuotePilot — Changelog

All notable changes to this project are documented here. Newest at the top.
Format: `## [version] — date` with Added / Changed / Fixed / Security sections.

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
