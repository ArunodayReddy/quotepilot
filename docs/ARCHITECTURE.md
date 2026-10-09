# QuotePilot — Architecture

> Living doc. Update when the system shape changes. Last updated: 2026-10-08 (v0.10.1).

## 1. System diagram (ASCII)

```
┌──────────────────────────────────────────────────────────────────────┐
│  USER'S BROWSER                                                      │
│                                                                      │
│  ┌────────────────────────────┐      ┌────────────────────────────┐  │
│  │ apps/web  (Next.js 14.2   │      │ analytics/dashboard (Vite) │  │
│  │ App Router, React 18)     │      │ port 5174                  │  │
│  │ port 5173                  │      │                            │  │
│  │                            │      │ Clicks by element (SVG)    │  │
│  │ app/ routes:               │      │ Wizard funnel              │  │
│  │  / → SSR SEO shell         │      │ Carrier perf table         │  │
│  │  /quote → Wizard (client)  │      │ Daily sessions             │  │
│  │  /quotes/[jobId] (client)  │      │ polls /api/analytics/      │  │
│  │  /agents (client, Leaflet) │      │ summary every 30s          │  │
│  │  /about /terms /privacy /  │      │                            │  │
│  │  disclosures (server HTML) │      │                            │  │
│  │                            │      │                            │  │
│  │ src/views/ = client views; │      │                            │  │
│  │ src/app/ = route shells +  │      │                            │  │
│  │ generateMetadata per page  │      │                            │  │
│  │ Fires POST /api/analytics/ │      │                            │  │
│  │ event on every interaction │      │                            │  │
│  │ (consent-gated)            │      │                            │  │
│  └──────────────┬─────────────┘      └──────────────┬─────────────┘  │
│                 │ /api rewrite       │ direct GET     │
└─────────────────┼──────────────────────────────────┼──────────────┘
                  │                                  │
┌─────────────────▼──────────────────────────────────▼──────────────┐
│  apps/api  (Node + Express + TypeScript) · port 3001                │
│                                                                    │
│  routes/        /api/quote · /api/quotes/:jobId · /api/agents ·     │
│                 /api/analytics · /api/email · /api/health           │
│  middleware/    validate (zod) · rateLimit · errorHandler · cors   │
│  services/      jobQueue · emailService · analyticsService ·        │
│                 carrierRegistry                                    │
│  adapters/      one file per carrier → implements QuoteAdapter      │
│                (geico.ts, progressive.ts, allstate.ts, …)           │
│  lib/           logger (structured JSON) · config · schemas         │
│                                                                    │
│  ┌──────────────┐   ┌────────────────────┐   ┌──────────────────┐   │
│  │ Analytics      │   │ Job queue          │   │ Quote cache      │   │
│  │ sink: SQLite   │   │ abstraction:       │   │ SHA-256 rating-  │   │
│  │ default,       │   │ MemoryQueue /      │   │ factors key;     │   │
│  │ Postgres when  │   │ BullMQ+Redis when  │   │ Redis or LRU     │   │
│  │ DATABASE_URL   │   │ REDIS_URL set      │   │ (TTL 3600s)      │   │
│  │ (fail-open)    │   │ (worker in-proc.)  │   │                  │   │
│  └──────────────┘   └────────────────────┘   └──────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ SMTP (prod) / logged (dev) — email delivery                 │   │
│  │ GET /api/health reports live backends                       │   │
│  │ (queue / analytics / cache / rateLimitStore)                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  packages/shared — QuoteAdapter interface + shared types +         │
│                    state/carrier data helpers                      │
│  data/carriers/<STATE>.json — carrier registry (id, channel, …)    │
│  data/agents/<STATE>.json   — local-agent directory seed           │
│  data/sample/               — masked demo profile (NEVER real PII) │
└────────────────────────────────────────────────────────────────────┘
```

## 2. Data flow: one quote request, end to end

```
Wizard form (validated client-side, zod mirrors server schemas)
        │  POST /api/quote { state, drivers[], vehicle, coverages, contact }
        │  validate middleware rejects malformed input (400, no stack traces)
        ▼
Route creates JOB { id, state, status: queued, createdAt }
  → persisted job record (SQLite job table)
  → jobQueue.enqueue(job) → returns jobId immediately (never blocks UI)
        │
        ▼  (background, per-carrier timeouts, e.g. 8s each)
jobQueue fans out to ALL carriers serving the state:
  carrierRegistry resolves data/carriers/<STATE>.json
        │
        ▼  each adapter, isolated try/catch
QuoteAdapter.getQuote(profile) → QuoteResult { carrierId, premium6mo, … }
  adapters NEVER throw across the boundary — failures → { status: 'failed', reason }
        │
        ▼  results accumulate on the job
GET /api/quotes/:jobId → { status, progress: 7/12, quotes: [...] }   (poll 2s)
        │  job.status → complete when all adapters settled
        ▼
emailService sends completed-quotes email (SMTP prod / logged dev)
        │
        ▼  every hop emits analytics events (see docs/LOGGING.md)
POST /api/analytics/event { event, page, element?, sessionId, metadata? }
```

**Key invariants**

- The UI never waits on a carrier. Adapters run in background; the page polls job progress.
- A dead/slow carrier degrades one card, never the page (per-carrier timeout + isolation).
- The `QuoteAdapter` interface does not change when simulation adapters are replaced with
  real carrier APIs — only the adapter file contents change (CONTEXT rule 7).

## 3. Adapter pattern

All carriers implement the shared interface from `packages/shared`:

```ts
interface QuoteProfile {  // sanitized: no raw form payload, no PII beyond ZIP + vehicle class
  state: string
  zip: string
  drivers: DriverSummary[]   // age band, years licensed, violations band — never names/DOB
  vehicle: VehicleSummary     // year, make-class, model-class, garaging ZIP
  coverages: CoverageSelection
}

interface QuoteResult {
  carrierId: string
  channel: 'direct' | 'agent'
  premium6moCents: number
  deductibleCompCents: number
  deductibleCollCents: number
  latencyMs: number
  status: 'ok' | 'failed'
  failureReason?: string
}

interface QuoteAdapter {
  readonly carrierId: string
  readonly channel: 'direct' | 'agent'
  getQuote(profile: QuoteProfile): Promise<QuoteResult>
}
```

- One file per carrier: `apps/api/src/adapters/<carrierId>.ts` (e.g. `allstate.ts`, `geico.ts`).
- **Simulation adapters today** price within realistic bands anchored to real quote research
  (CONTEXT §5: Allstate MA anchor $1,347/6mo for 50/100/50 + UM 50/100 + $500 comp/collision).
- **Real integrations tomorrow**: swap the simulation body for the carrier's API client.
  The interface, the job queue, and the UI stay untouched.
- Agent-only carriers (Commerce/MAPFRE, Safety, Arbella, Hanover, Norfolk & Dedham) implement
  the same interface; their cards render "via local agent" and link to the agent directory.

## 4. Job queue design

### v0.9.0: queue abstraction (built)

`services/queue.ts` defines the `JobQueue` interface (`enqueue`, `getJob`,
`onComplete`, `requestNotifyOnComplete`, `close`); `jobExecutor.ts` holds the
shared execution core so every backend runs byte-identical fan-out, ranking,
analytics, and email logic.

- **`MemoryQueue`** (default, zero config): the original v0.2.0 bounded-concurrency
  promise pool — 8 concurrent adapter calls per job, 8s per-carrier timeout via
  racing, timeouts log `quote.carrier.timeout` and fail the carrier (not the job).
  Lifecycle `queued → running → complete | failed(partial)`; single process, jobs
  lost on restart.
- **`BullMQQueue`** (selected when `REDIS_URL` is set): job state in Redis hashes
  (24h TTL), worker concurrency 10, attempts 2 with exponential backoff; jobs
  survive restarts; any fleet instance can serve `GET /api/quotes/:jobId`.
- The worker runs **in-process** for now (see DECISIONS.md #29) — no separate
  worker deploy until real carrier APIs make it worthwhile.
- Graceful shutdown: SIGTERM/SIGINT → stop accepting → 15s drain → close queue.

### When to split further

- Multiple API instances behind a load balancer → set `REDIS_URL`; already done.
- Quote jobs must survive deploys with retries/DLQ → per-carrier child jobs and a
  dead-letter queue (documented in `docs/SCALING.md`; justified when real,
  slow, flaky carrier APIs arrive — not for simulated adapters).
- Email delivery retries at scale → move to a dedicated `emails` queue with
  exponential backoff (same doc).

No schema or API contract changes are required for any of this; only the queue
implementation and infra env vars.

## 5. Analytics storage: sink abstraction (v0.9.0)

Analytics live behind an `AnalyticsSink` interface (`services/analyticsSink.ts`):

- **`SqliteSink`** (default): the original dedicated `analytics.db` via
  `better-sqlite3`, kept separate from job records so analytics writes never
  block quote jobs. Zero infra.
- **`PostgresSink`** (when `DATABASE_URL` is set): schema-compatible tables via
  `pg`. **Fail-open**: a Postgres outage warns loudly and falls back to SQLite —
  analytics never breaks quoting (DECISIONS.md #28).

Schema (both sinks):

```sql
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event        TEXT NOT NULL,          -- e.g. 'page_view', 'wizard_step_completed', 'cta_clicked'
  page         TEXT NOT NULL,          -- e.g. 'wizard', 'quotes', 'compare', 'agents'
  element      TEXT,                   -- e.g. 'get-quotes-cta', 'compare-opened'
  session_hash TEXT NOT NULL,          -- SHA-256(sessionId + salt); raw sessionId NEVER stored
  ts           INTEGER NOT NULL,       -- unix ms
  metadata     TEXT                    -- JSON, validated allow-list of keys — NO PII, NO raw payloads
);

CREATE INDEX IF NOT EXISTS idx_events_event_ts ON events (event, ts);
CREATE INDEX IF NOT EXISTS idx_events_session  ON events (session_hash, ts);
```

**`GET /api/analytics/summary` rollups** (computed on read; cached ~5s):

| Key               | Source query (conceptual)                                              |
| ----------------- | ---------------------------------------------------------------------- |
| `clicksByElement` | `SELECT element, page, COUNT(*) FROM events WHERE event='cta_clicked' GROUP BY element, page` |
| `funnel`          | `SELECT step, completed, COUNT(*) FROM events WHERE event IN ('wizard_step_completed','quotes_viewed') GROUP BY step` |
| `carriers`        | from job records: `quotes` count, `AVG(latencyMs)`, `winRate` = share of jobs where carrier had the cheapest quote |
| `dailySessions`   | `SELECT date(ts/1000,'unixepoch') d, COUNT(DISTINCT session_hash) FROM events GROUP BY d` |

Growth path: the sink interface means the dashboard never cares about the store.
`GET /api/health` reports which sink is live. Rate limiting is likewise
store-abstracted: `rate-limit-redis` when `REDIS_URL` is set, else the in-memory
default — correct per-IP limits across a fleet (tiers via `RATE_LIMIT_*_PER_MIN`).

## 6. Ports table

| Port | Service                 | URL                        | Notes                              |
| ---- | ----------------------- | -------------------------- | ---------------------------------- |
| 3001 | API (Express)           | http://localhost:3001      | `/api/*`; health at `/api/health` reports live backends |
| 5173 | Web app (Next.js 14.2)  | http://localhost:5173      | `next dev`; `/api` rewritten to 3001 (`API_PROXY_TARGET` override) |
| 5174 | Analytics dashboard     | http://localhost:5174      | reads `/api/analytics/summary`     |
| 6379 | Redis (optional)        | —                          | v0.9.0: queue + rate limits + cache when `REDIS_URL` set |

## 7. Validation boundaries (where input is checked)

1. **Client (apps/web)** — inline wizard validation + zod schemas mirroring the server.
   Friendly errors, never a substitute for server checks.
2. **API edge (middleware/validate)** — zod schemas on every route body/query/params.
   Reject fast with 400 + machine-readable error codes; never echo raw input back.
3. **Adapter boundary** — adapters receive the sanitized `QuoteProfile` only.
4. **Analytics boundary** — `POST /api/analytics/event` validates `event` against the
   known taxonomy (see docs/LOGGING.md) and strips unknown metadata keys.
5. **Email boundary** — templates escape all interpolated values; no raw HTML from users.

## 8. What deliberately lives where (and why)

| Concern              | Location                 | Rationale                                   |
| -------------------- | ------------------------ | ------------------------------------------- |
| Carrier pricing      | `apps/api/src/adapters/` | swappable without touching queue/UI         |
| Carrier list per state | `data/carriers/*.json` | state-aware, editable without code deploys  |
| Agent directory      | `data/agents/*.json`     | same — content, not code                    |
| Shared types         | `packages/shared`        | one source of truth for the adapter contract |
| Click analytics      | SQLite `analytics.db`    | zero-infra, survives demo; upgradeable      |
| Usage dashboard      | `analytics/dashboard`    | separate deployable, reads one endpoint     |
