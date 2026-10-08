# QuotePilot — Architecture

> Living doc. Update when the system shape changes. Last updated: 2026-10-08 (v0.2.0 build).

## 1. System diagram (ASCII)

```
┌──────────────────────────────────────────────────────────────────────┐
│  USER'S BROWSER                                                      │
│                                                                      │
│  ┌────────────────────────────┐      ┌────────────────────────────┐  │
│  │ apps/web  (React + Vite)   │      │ analytics/dashboard (Vite) │  │
│  │ port 5173                  │      │ port 5174                  │  │
│  │                            │      │                            │  │
│  │ Home → Wizard (5 steps) →  │      │ Clicks by element (SVG)    │  │
│  │ Quotes → Compare → Agents  │      │ Wizard funnel              │  │
│  │                            │      │ Carrier perf table         │  │
│  │ Fires POST /api/analytics/ │      │ Daily sessions             │  │
│  │ event on every interaction │      │ polls /api/analytics/      │  │
│  │                            │      │ summary every 30s          │  │
│  └──────────────┬─────────────┘      └──────────────┬─────────────┘  │
│                 │ /api proxy                        │ direct GET     │
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
│  │ SQLite       │   │ in-process job     │   │ SMTP (prod) /    │   │
│  │ analytics.db │   │ queue (today) →    │   │ logged (dev)     │   │
│  │ (better-     │   │ BullMQ + Redis     │   │ email delivery   │   │
│  │  sqlite3)    │   │ (upgrade path)     │   │                  │   │
│  └──────────────┘   └────────────────────┘   └──────────────────┘   │
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

### Today: in-process async queue (v0.2.0)

- `services/jobQueue.ts` — a bounded-concurrency promise pool inside the API process.
- Concurrency: N carriers × M jobs, capped (default: 8 concurrent adapter calls per job).
- Per-carrier timeout (default 8s) via `AbortController`-style racing; timeouts log
  `quote.carrier.timeout` and mark the carrier failed, not the job.
- Job lifecycle: `queued → running → complete | failed(partial)`; persisted in SQLite
  so a restart doesn't lose the record (re-runnable from the last checkpoint).
- Good enough for demo scale (tens of concurrent users, one API instance).

### Upgrade path: BullMQ + Redis (when any of these become true)

- Multiple API instances behind a load balancer.
- Quote jobs must survive API restarts/deploys.
- We need retries with backoff, delayed jobs (e.g. re-quote reminders), or a dead-letter queue.

**Migration plan (interface-preserving):**

1. Add `redis` (BullMQ dependency) + `ioredis`; run Redis (port 6379, see ports table).
2. `services/jobQueue.ts` gains a `JobQueue` interface it already effectively has:
   `enqueue(job)`, `getJob(id)`, `onProgress(cb)`. Implement `BullMQJobQueue` behind the
   same interface — routes and the web app don't change.
3. One queue per concern: `quotes` (adapter fan-out), `emails` (delivery), `analytics`
   (event persistence batching).
4. Adapter fan-out becomes child jobs: parent `quote-job` spawns one child per carrier;
   progress = completed children / total children; a failed child degrades its card only.
5. Email delivery moves to the `emails` queue with exponential-backoff retries (3 attempts)
   and a dead-letter queue for permanent SMTP failures.
6. Add a `QueueEvents` listener feeding the existing structured logger — same log fields,
   new `event` values (`job.enqueued`, `job.child.completed`, `job.completed`).

No schema or API contract changes are required for the upgrade; only the queue
implementation and one new infra dependency (Redis).

## 5. SQLite analytics schema

Analytics live in a dedicated SQLite database (`analytics.db`, via `better-sqlite3`),
kept separate from job records so analytics writes never block quote jobs.

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

Growth path: when daily events exceed ~1M, move `events` to Postgres/ClickHouse and keep
the summary endpoint contract identical — the dashboard doesn't care about the store.

## 6. Ports table

| Port | Service                 | URL                        | Notes                              |
| ---- | ----------------------- | -------------------------- | ---------------------------------- |
| 3001 | API (Express)           | http://localhost:3001      | `/api/*`, health at `/api/health`  |
| 5173 | Web app (Vite + React)  | http://localhost:5173      | proxies `/api` → 3001              |
| 5174 | Analytics dashboard     | http://localhost:5174      | reads `/api/analytics/summary`     |
| 6379 | Redis (future)          | —                          | BullMQ upgrade path only; not required for v0.2.0 |

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
