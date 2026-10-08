# QuotePilot — Logging

> Every feature ships with logging (CONTEXT rule 5). Structured JSON, always.
> Last updated: 2026-10-08 (v0.2.0 build).

## 1. Structured JSON log format

One JSON object per line (JSONL) to stdout; the platform (or `scripts/dev.sh` log files)
collects it. Every log line carries the same core fields:

```json
{
  "timestamp": "2026-10-08T17:31:00.123Z",
  "level": "info",
  "requestId": "req_9f2c4a1b7e",
  "method": "POST",
  "path": "/api/quote",
  "status": 200,
  "durationMs": 42,
  "event": "quote.job.created",
  "outcome": "success",
  "jobId": "job_k3m9x2pq7r",
  "carriers": 12
}
```

### Field reference

| Field       | Required | Description                                                                 |
| ----------- | -------- | --------------------------------------------------------------------------- |
| `timestamp` | yes      | ISO-8601 UTC.                                                               |
| `level`     | yes      | `debug` · `info` · `warn` · `error` (see §3).                                |
| `requestId` | yes      | `req_` + 10 random hex chars; generated per inbound request, propagated to every log line and adapter call for that request. |
| `method`    | yes*     | HTTP method (*for HTTP-triggered lines; background jobs use `jobId` instead). |
| `path`      | yes*     | Route path, no query string (*same condition as above).                     |
| `status`    | yes*     | HTTP status returned.                                                       |
| `durationMs`| yes      | Wall-clock ms for the operation.                                            |
| `event`     | yes      | Dotted event name (see §4) — the "what happened".                          |
| `outcome`   | yes      | `success` · `failure` · `partial` (partial = some carriers failed, job OK).  |
| extras      | no       | `jobId`, `carrierId`, `element`, `sessionHash` (hashed!), `errorCode`, counts, latencies. |

`logger` (`apps/api/src/lib/logger.ts`) enforces this shape: it accepts
`(level, event, fields)` and fills `timestamp`/`requestId` from async context.
Anything that can't be serialized as JSON is rejected at log time, not at 2 AM.

## 2. What is NEVER logged

This is a hard rule, enforced by code review **and** by the logger's denylist
(keys matching these patterns are redacted to `"[REDACTED]"`):

- **PII**: names, emails, phone numbers, street addresses, dates of birth, VINs,
  policy numbers, driver's license numbers, exact vehicle identifiers.
- **Secrets**: SMTP passwords, API keys, tokens, salts, session IDs (raw —
  only `sessionHash` is logged), private keys.
- **Raw payloads**: never log `req.body` whole. If debugging a validation failure,
  log `{ fieldsPresent: [...keys], failedField: 'zip' }` — key names only, never values.
- **Full analytics metadata**: metadata values are validated and length-capped
  before persistence; free-text values are never logged.

Breach of this section = P0 bug, fixed before any feature work.

## 3. Log levels

| Level   | When to use                                                              | Example event                              |
| ------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| `debug` | Developer diagnostics, off in prod by default                            | `adapter.simulate.priced`                  |
| `info`  | Normal business operations                                               | `quote.job.created`, `email.sent`          |
| `warn`  | Degraded but handled: carrier timeout, rate-limit hit, retry scheduled    | `quote.carrier.timeout`, `rate_limit.hit`  |
| `error` | Operation failed for the user; needs attention                           | `quote.job.failed`, `email.delivery_failed`|

`NODE_ENV=production` sets the floor to `info`. `warn`/`error` lines should always
include enough context (`jobId`, `carrierId`, `errorCode`) to act without a second query.

## 4. Event taxonomy

### 4a. Server-side events (`event` field in API logs)

| Event                      | Emitted when                                              | Key extra fields                    |
| -------------------------- | --------------------------------------------------------- | ----------------------------------- |
| `quote.job.created`        | `POST /api/quote` validated, job enqueued                 | `jobId`, `carriers` (count)         |
| `quote.job.completed`      | all adapters settled                                      | `jobId`, `durationMs`, `quotes` (count) |
| `quote.job.failed`         | job record couldn't be created or all carriers failed     | `jobId`, `errorCode`                |
| `quote.carrier.completed`  | one adapter returned a quote                              | `jobId`, `carrierId`, `latencyMs`   |
| `quote.carrier.timeout`    | adapter exceeded per-carrier timeout                      | `jobId`, `carrierId`, `timeoutMs`   |
| `quote.carrier.failed`     | adapter threw / returned failure                          | `jobId`, `carrierId`, `errorCode`   |
| `email.requested`          | user opted into "email me when ready"                     | `jobId`                             |
| `email.sent`               | completed-quotes email accepted by SMTP / logged in dev   | `jobId`, `durationMs`               |
| `email.delivery_failed`    | SMTP rejected or timed out (after retries)                | `jobId`, `errorCode`                |
| `analytics.event.stored`   | `debug` only — analytics event persisted                  | `event` (client event name)         |
| `rate_limit.hit`           | request rejected with 429                                 | `path`, `ipHash`                    |
| `validation.failed`        | zod rejected a request body                               | `path`, `failedField` (name only)   |

### 4b. Client analytics events (`POST /api/analytics/event` → SQLite → dashboard)

The web app fires these on every interaction (CONTEXT rule 6). `sessionId` is
client-generated; the server stores only its hash.

| Client `event`          | `page`            | `element` (when set)              | Meaning                                              |
| ----------------------- | ----------------- | --------------------------------- | ---------------------------------------------------- |
| `page_view`             | any               | —                                 | page/route rendered                                  |
| `wizard_step_completed` | `wizard`          | `step-1` … `step-5`               | user finished a wizard step (metadata: `step`)       |
| `cta_clicked`           | `home`            | `get-quotes-cta`                  | hero "Get my quotes" clicked                         |
| `cta_clicked`           | `wizard`          | `wizard-continue` / `wizard-back` | wizard navigation                                    |
| `cta_clicked`           | `dashboard`       | `send-test-event`                 | dashboard test-event button                          |
| `quote_job_created`     | `wizard`          | —                                 | `POST /api/quote` accepted (metadata: `jobId`, `carriers`) |
| `quotes_viewed`         | `quotes`          | —                                 | results page rendered with ≥1 quote                  |
| `carrier_card_expanded` | `quotes`          | `<carrierId>-card`                | user expanded a carrier's detail card                |
| `compare_opened`        | `quotes`/`compare`| `compare-cta`                     | side-by-side compare opened (metadata: `carrierIds`) |
| `email_optin`           | `quotes`          | `email-me-cta`                    | "email me when ready" submitted                      |
| `agent_phone_clicked`   | `agents`          | `<agentId>-phone`                 | tap-to-call on an agent listing                      |

Unknown `event` values are rejected (400); unknown `metadata` keys are dropped.

## 5. Retention & access

- Dev: logs to `/tmp/quotepilot-*.log` (see `scripts/dev.sh`), rotated manually.
- Prod: JSONL → centralized log store, 30-day retention for `info`, 90-day for `warn`/`error`.
- Analytics DB (`analytics.db`): raw events 90 days, then rolled into the summary
  aggregates only. No backups leave the host unencrypted.
