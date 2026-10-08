# Job queue upgrade path: in-memory → BullMQ + Redis

The v0.2.0 demo runs an in-memory job queue (`src/services/jobQueue.ts`).
That is correct for a hackathon demo and a single process, and wrong the
moment QuotePilot needs a second API replica, a deploy without losing
in-flight jobs, or retries. This note is the checklist for that upgrade.
(The docs track will fold it into `docs/ARCHITECTURE.md`.)

## Why in-memory is fine today

- One process, one demo, short-lived jobs (~3s).
- No infra to provision; `npm run dev` works from a clean checkout in seconds.
- The route contract (`POST /api/quote` → 202, `GET /api/quotes/:jobId`)
  does not leak the queue implementation, so the web track is unaffected.

## When to upgrade

Any one of: horizontal scaling, deploys that must not drop jobs, carrier
fan-out beyond ~20 adapters, or a need for retries/backoff on flaky carrier
APIs.

## Checklist

1. **Add deps**: `bullmq`, `ioredis`. Provision Redis (managed: Upstash /
   Railway / ElastiCache; self-hosted: single container).
2. **Queue seam** — `src/services/jobQueue.ts` is the only module that
   changes:
   - `createQuoteJob()` → `quoteQueue.add("quote-job", { request, jobId })`
     with `jobId` as the BullMQ job id (idempotent: same jobId = no dupes).
   - `getQuoteJob()` → read job state from Redis (`job.getState()`,
     `job.returnvalue`) instead of the `Map`.
   - Worker (`src/workers/quoteWorker.ts`, new file) consumes jobs and runs
     the existing `processJob` logic.
3. **Per-carrier fan-out**: move each adapter call into a BullMQ child job
   (flow producer) or keep `Promise.all` inside the worker — keep the 8s
   per-carrier timeout as the child job `timeout` option either way.
4. **Retries**: real carrier APIs are flaky — add `attempts: 3` with
   exponential `backoff` on adapter child jobs; keep timeouts non-retryable
   (a timeout that retries 3× costs 24s of latency budget).
5. **Dead letters**: failed jobs land in a DLQ for inspection; alert on
   DLQ depth. Never silently drop a paid user's quote job.
6. **Progress**: BullMQ `job.updateProgress()` replaces the in-memory
   `progress.completed` counter; the status endpoint already polls, so no
   contract change.
7. **Email**: move `sendQuotesReady` into its own `emailQueue` so a slow SMTP
   server can't hold a quote worker slot. Keep the dev-log mode.
8. **Analytics**: `track()` calls stay synchronous-local (SQLite) or move to
   a fire-and-forget queue — never let analytics backpressure block quotes.
9. **Rate limits**: `express-rate-limit` is per-process; switch to a Redis
   store (`rate-limit-redis`) so 10/min/IP on `/api/quote` holds across
   replicas.
10. **Graceful shutdown**: on SIGTERM, `worker.close()` + `queue.close()`
    so in-flight jobs finish instead of dying mid-quote.

## What does NOT change

- `QuoteAdapter` interface (`packages/shared`) — the whole point of the
  adapter pattern.
- The HTTP contract — web track builds against it untouched.
- Analytics schema and the PII rules (session hashing, metadata scrubbing).
