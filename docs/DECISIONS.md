# QuotePilot — Decision Log

> Append-only. Every significant product or architecture decision: the context,
> the options, what was chosen, and what it costs. Newest at the bottom.
> Format: `## N. Title` — Date · Release · Status.

---

## 1. Quote engine = adapter pattern, not direct integrations

- **Date:** 2026-10-08 · **Release:** v0.1.0 (ratified) → v0.2.0 (built) · **Status:** Accepted
- **Context:** The product needs quotes from N carriers, but real carrier APIs require partnerships, credentials, and per-carrier quirks we don't have on day one.
- **Options:** (a) Hardcode pricing logic per carrier inline; (b) one adapter per carrier behind a frozen `QuoteAdapter` interface (`packages/shared/src/types.ts`).
- **Decision:** (b). The interface docstring forbids adding required members — real APIs slot in later with zero UI or queue changes.
- **Consequences:** Simulation adapters today are honest placeholders; the day a carrier API is available, only one file's internals change. Cost: slightly more scaffolding up front.

## 2. Simulation-first pricing, anchored to real research

- **Date:** 2026-10-08 · **Release:** v0.2.0 · **Status:** Accepted
- **Context:** No carrier credentials exist, but the demo needs believable numbers.
- **Options:** (a) Random/plausible numbers; (b) deterministic simulation calibrated to a real researched quote.
- **Decision:** (b). `BASE_ANCHOR = 1236` calibrates the sample profile so Allstate lands ≈$1,347/6mo — the owner's real October 2026 MA quote. ±3% jitter derives from SHA-256 of identity-free fields: identical inputs → identical quotes.
- **Consequences:** Numbers are defensible in a demo ("within 2% of our researched quote"); outside MA they're flagged approximate. Every surface carries "Simulated — demo pricing" (verified in the built bundle).

## 3. Sample-data honesty as a hard rule

- **Date:** 2026-10-08 · **Release:** v0.2.0 → v0.4.0 · **Status:** Accepted
- **Context:** Demo needs agent listings and a test profile, but fabricating real businesses' phone numbers is misinformation.
- **Options:** (a) Realistic-looking invented data; (b) obviously-sample data, always badged.
- **Decision:** (b). 555-01xx phones, obviously-sample street numbers, approximate coords, `sample:true`, amber "Sample data" badges; masked PII in fixtures (VIN truncated, policy redacted).
- **Consequences:** The demo never misleads; the day real data arrives (Places key), badges flip to green "Live data" with no code change.

## 4. Contract-first parallel builds

- **Date:** 2026-10-08 · **Release:** v0.2.0 · **Status:** Accepted
- **Context:** Three tracks (web, API, analytics/docs) built in parallel risk integration hell.
- **Options:** (a) Sequential builds; (b) parallel against a coordinator-issued API contract, coordinator runs the integration smoke.
- **Decision:** (b). Routes, shapes, and status codes were fixed before code; the coordinator verified install → build → dev.sh → end-to-end quote job before merging.
- **Consequences:** v0.2.0 integrated cleanly on the first pass. Cost: the contract must be genuinely complete up front.

## 5. No hardcoded content — feed-driven UI

- **Date:** 2026-10-08 · **Release:** v0.3.0 · **Status:** Accepted
- **Context:** The v0.2.0 home page hardcoded `const CARRIERS = [...]`.
- **Options:** (a) Leave it; (b) serve content from `GET /api/carriers` and render everything from the feed.
- **Decision:** (b). Marquee, FAQ, and JSON-LD all render from the live registry with skeleton/error states.
- **Consequences:** New states and carriers ship as data, never frontend deploys. Content bugs become data fixes.

## 6. DOB collected, age derived — API contract unchanged

- **Date:** 2026-10-08 · **Release:** v0.3.0 · **Status:** Accepted
- **Context:** Industry-standard forms ask date of birth, but the API prices on age bands.
- **Options:** (a) Change the API to accept DOB; (b) collect DOB in the UI, derive age client-side, keep sending `age`.
- **Decision:** (b). Marital status and street address are likewise collected form-local until real adapters consume them.
- **Consequences:** Better UX with zero contract churn. The fields are ready the day a real adapter wants them.

## 7. localStorage schema versioning

- **Date:** 2026-10-08 · **Release:** v0.3.0 (v1→v2), v0.7.0 (v2→v3) · **Status:** Accepted
- **Context:** Wizard resume persists form state in localStorage; schema changes would corrupt old saves.
- **Options:** (a) Silent migrations; (b) versioned keys (`quotepilot.wizard.v1/v2/v3`), old keys ignored.
- **Decision:** (b).
- **Consequences:** No migration code, no corrupt resumes — at the cost of users re-entering data after a schema bump (acceptable for a demo).

## 8. Agent data: provider chain (Places → sample)

- **Date:** 2026-10-08 · **Release:** v0.4.0 · **Status:** Accepted
- **Context:** The directory needs real local agents; free key-less sources were evaluated live.
- **Options:** (a) Overpass API; (b) Nominatim; (c) Google Places with sample fallback.
- **Decision:** (c). Overpass was unreachable from this network (HTTP 406); Nominatim returned effectively nothing for insurance offices (one real hit in testing). Places Nearby Search (`type=insurance_agency`) + Details is the only evaluated source with dense real coverage; 24h cache + 10-details cap keeps quota sane.
- **Consequences:** Real data the moment `GOOGLE_PLACES_API_KEY` is set; honest labeled fallback until then. Vendor dependency accepted — the `AgentProvider` interface keeps it swappable.

## 9. Leaflet over Google Maps

- **Date:** 2026-10-08 · **Release:** v0.4.0 · **Status:** Accepted
- **Context:** The agent finder needs an interactive map.
- **Options:** (a) Google Maps JS API; (b) Leaflet + OSM tiles.
- **Decision:** (b). No key, no cost, no quota — and custom divIcon pins dodge the bundler-broken default marker PNGs.
- **Consequences:** Map works everywhere on day one; if Places later supplies richer data, the map layer doesn't care.

## 10. ZIP-first homepage entry

- **Date:** 2026-10-08 · **Release:** v0.5.0 · **Status:** Accepted
- **Context:** A 5-step form is a commitment; drop-off happens before step 1.
- **Options:** (a) Keep "Get my quotes" CTA into the full wizard; (b) hero ZIP field → wizard with location prefilled.
- **Decision:** (b). Typing a ZIP is five seconds; the wizard earns the rest. Analytics carries only the 3-digit prefix — full ZIP never leaves the quote request.
- **Consequences:** Lowest-friction entry in the product; the wizard's location step becomes confirmation, not work.

## 11. Unified results page

- **Date:** 2026-10-08 · **Release:** v0.5.0 · **Status:** Accepted
- **Context:** Agent-only carriers (a third of the MA market) can't be quoted online; a separate Agents page leaks undecided users.
- **Options:** (a) Keep Agents as its own page; (b) "Online quotes — instant" above "Local agents near {ZIP}" on one results page.
- **Decision:** (b), with location from wizard localStorage (never guessed) and graceful degradation to a directory link without it.
- **Consequences:** One page answers both "what's cheapest online" and "who can help me in person."

## 12. Honest degradation — no fake prices, ever

- **Date:** 2026-10-08 · **Release:** v0.5.0 · **Status:** Accepted, test-enforced
- **Context:** 50 states × carriers with no pricing adapter tempts invented numbers.
- **Options:** (a) Extrapolate prices; (b) degrade to honest website/agent links, exclude unavailable carriers.
- **Decision:** (b). `registry.test.ts` enforces `quotable ⟹ wired adapter` across all 50 states.
- **Consequences:** Some carriers show links instead of prices — but the product never lies about money.

## 13. Engagement without dark patterns

- **Date:** 2026-10-08 · **Release:** v0.5.0 · **Status:** Accepted
- **Context:** Waiting for quotes is the bounce moment; most products manufacture urgency to keep users.
- **Options:** (a) Countdown timers, fake scarcity; (b) truthful mechanics only.
- **Decision:** (b). Live per-carrier progress, savings headline computed from real results, inline email capture — every line describes what's actually happening.
- **Consequences:** Slightly less "hooky" than dark patterns; infinitely more defensible in a portfolio review or a DOI inquiry.

## 14. Client/server validation parity as law

- **Date:** 2026-10-08 · **Release:** v0.5.1 · **Status:** Accepted
- **Context:** v0.3.0 found a gender-enum drift that 400'd sample submits; v0.5.1 found four more (ZIP+4, year min, license cap, phone rules).
- **Options:** (a) Fix bugs as found; (b) single source of truth + parity as a standing law.
- **Decision:** (b). `apps/web/src/lib/validation.ts` mirrors `apps/api/src/lib/schemas.ts` regex-for-regex; drift is classified as a 400-class bug.
- **Consequences:** The form can never promise what the server rejects. Plus human error messages, blur validation, and live counters as the UX layer.

## 15. Honest loading states

- **Date:** 2026-10-08 · **Release:** v0.5.1 · **Status:** Accepted
- **Context:** Background APIs take seconds; spinners feel like stalling.
- **Options:** (a) Generic spinner; (b) brand loader + rotating witty lines describing the real operation.
- **Decision:** (b) — "Knocking on GEICO's door…", never "Almost done!" when it isn't. Reduced-motion gets a static line.
- **Consequences:** Waiting feels like progress; the copy can't overpromise because it's tied to actual states.

## 16. SQLite over Postgres for analytics

- **Date:** 2026-10-08 · **Release:** v0.2.0 · **Status:** Accepted
- **Context:** Click analytics needs a store; demo scale is tiny.
- **Options:** (a) Postgres from day one; (b) SQLite via better-sqlite3, upgrade path documented.
- **Decision:** (b). Zero infrastructure; the summary-endpoint contract is store-agnostic, so Postgres/ClickHouse slots in past ~1M events/day with no dashboard changes.
- **Consequences:** `npm install` is the whole ops story. Sessions hashed (truncated SHA-256), email-like metadata dropped — privacy designed in, not bolted on.

## 17. In-process job queue with a BullMQ upgrade path

- **Date:** 2026-10-08 · **Release:** v0.2.0 · **Status:** Accepted
- **Context:** Quote fan-out needs concurrency, timeouts, and (eventually) durability.
- **Options:** (a) BullMQ + Redis now; (b) in-process bounded pool now, narrow seam for later.
- **Decision:** (b). 8s per-carrier timeouts, fail-closed cards, documented migration in `UPGRADE_PATH.md` preserving the route contract.
- **Consequences:** One-process demo stays simple; scaling is a known, written-down operation.

## 18. 50-state data grades, not 50-state research

- **Date:** 2026-10-08 · **Release:** v0.6.0 · **Status:** Accepted
- **Context:** Owner asked for all 50 states in one release; deep research per state was infeasible.
- **Options:** (a) Ship 50 files with best-effort data; (b) national core everywhere (high confidence) + regionals only where confident, every file graded.
- **Decision:** (b). MA/TX full, CA/NH good, 46 starter; `confidence: "medium"` tags; `data/carriers/README.md` is the honesty ledger.
- **Consequences:** Every state works on day one; nobody mistakes starter data for research. The grades are the upgrade backlog.

## 19. Deploy on free tiers: Vercel + Render

- **Date:** 2026-10-08 · **Release:** v0.6.0 · **Status:** Accepted
- **Context:** Hackathon needs a public URL; budget is $0.
- **Options:** (a) Single VPS; (b) Vercel (web) + Render (API) free tiers.
- **Decision:** (b). `vercel.json` + `render.yaml` + `docs/DEPLOY.md` click-by-click guide; env-driven CORS, `trust proxy` for correct rate limiting, `VITE_API_URL` for the web→API link.
- **Consequences:** ~10-minute deploy; cold starts and ephemeral SQLite accepted as documented demo trade-offs.

## 20. Compliance foundation now, counsel before launch

- **Date:** 2026-10-08 · **Release:** v0.7.0 · **Status:** Accepted
- **Context:** Insurance is heavily regulated; retrofitting compliance is expensive.
- **Options:** (a) Ship demo, worry later; (b) build disclosures, consent, and privacy posture now, with explicit attorney-review gate.
- **Decision:** (b). Terms/Privacy/Disclosures, TCPA-grade consent, cookie-gated analytics, sourced per-state notes — plus the **attorney-review-required law**: nothing here is legal advice, commercial operation is blocked until counsel reviews (`docs/COMPLIANCE.md` §7).
- **Consequences:** Structurally compliant demo; the pre-launch checklist (producer licensing, TCPA review, terms enforceability) is written, not wished.

## 21. Never guess minimums

- **Date:** 2026-10-08 · **Release:** v0.7.0 · **Status:** Accepted
- **Context:** State minimum-coverage data changes by legislation (MA 2026, VA 2025, TN 2023 were all corrected mid-build from stale guides).
- **Options:** (a) Publish all 50 from memory; (b) ship 24 verified states, no field for the rest.
- **Decision:** (b). Every hint carries "verify with your state's DOI" microcopy.
- **Consequences:** 26 states show no minimums rather than wrong ones — the only defensible choice for legal-adjacent data.

## 22. Consent-gated analytics

- **Date:** 2026-10-08 · **Release:** v0.7.0 · **Status:** Accepted
- **Context:** "Analytics on every interaction" (rule 6) collides with privacy law the moment real users arrive.
- **Options:** (a) Track first, banner later; (b) cookie banner gates all event sending.
- **Decision:** (b). `quotepilot.consent.v1`; decline/undecided → events dropped in `fireAnalytics`; "Cookie settings" re-opens the banner.
- **Consequences:** Rule 6 now reads "every interaction *with consent*" — the dashboard shows consented traffic only, which is the legally correct denominator.

## 23. Rendering: Vite SPA today, SSR deferred

- **Date:** 2026-10-08 · **Release:** v0.7.0 era (question raised by owner) · **Status:** Proposed — decision pending
- **Context:** Owner asked whether the project uses Next.js and whether SSR is possible.
- **Options:** (a) Migrate to Next.js for SSR; (b) stay Vite SPA; (c) prerender at build time.
- **Decision:** Deferred. The SPA was chosen at kickoff for speed and portability (one static host, no server); SEO is currently served via semantic HTML, meta/OG tags, sitemap, and JSON-LD — which covers crawler needs for a form-driven app whose quote pages are `noindex` by design. If organic search becomes a growth channel, (c) prerendering public routes or (a) a Next.js migration are the documented options.
- **Consequences:** No action now; the question and options are recorded so the trade-off is explicit.

## 24. GitHub push mechanics: divergent histories, small batches

- **Date:** 2026-10-08 · **Release:** v0.2.0 → v0.6.0 · **Status:** Accepted (process)
- **Context:** The GitHub App can't create repos (403) or git-push (no token); bulk push goes through the `push_files` API.
- **Options:** (a) Fight for git push; (b) accept divergent histories, push via API in small batches.
- **Decision:** (b). Local git and GitHub histories are intentionally divergent; batches stay ≤50KB JSON (larger hangs the API); `package-lock.json` skipped (`npm install` regenerates).
- **Consequences:** Reliable pushes at the cost of conventional git history on the remote. Documented so future sessions don't re-learn it.
