# QuotePilot — Security

> "Unhackable" mindset: assume every input is hostile, every secret wants to leak,
> every dependency is guilty until audited. Last updated: 2026-10-08 (v0.2.0 build).

## 1. Threat model (STRIDE-lite)

| Threat                        | Example against QuotePilot                          | Mitigation (implemented)                                                                 |
| ----------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Spoofing**                  | Fake quote-job status polling; impersonating email sender | Job IDs are unguessable (crypto-random); emails sent only from verified `EMAIL_FROM`; no auth cookies to steal (no login in v0.2.0) |
| **Tampering**                 | Injecting a carrier price via forged API response; editing wizard payload to get absurd quotes | zod validation on every boundary; adapters server-side only (never trust client math); parameterized queries (no string SQL) |
| **Repudiation**               | "I never submitted that quote request"              | Structured request logs with requestId + outcome for every mutation; analytics event trail |
| **Information disclosure**    | PII in logs; error stack traces to users; `.env` in a client bundle | Never log PII/secrets/raw payloads; generic 500s; `VITE_`-prefix audit so no secret ships client-side; `.env` gitignored |
| **Denial of service**         | Quote-fan-out abuse (one user spawning 1000 jobs); adapter hammering | Rate limiting per IP + per endpoint; bounded job-queue concurrency; per-carrier timeouts; Cloudflare-style edge limits in prod |
| **Elevation of privilege**    | Accessing another user's quotes via jobId guessing; hitting admin/debug endpoints | Job IDs unguessable + not enumerated; no debug endpoints in prod builds; dashboard is read-only aggregates (no per-user data) |

Out of scope for v0.2.0 (documented, not ignored): real carrier API credential storage
(use a secrets manager, never env files on disk), user accounts/auth (no login yet),
payment handling (none — QuotePilot never touches money).

## 2. "Unhackable" checklist — what is enforced in code

### Input validation (zod) — every boundary, no exceptions

- `POST /api/quote` — full `QuoteRequestSchema`: state ∈ known list, ZIP matches
  `/^\d{5}(-\d{4})?$/`, ages 16–100, coverage enums from a closed set, email format.
- `GET /api/quotes/:jobId` — `jobId` must match `/^[A-Za-z0-9_-]{16,64}$`.
- `POST /api/analytics/event` — `event` must be in the known taxonomy
  (see docs/LOGGING.md); unknown `metadata` keys are dropped, values length-capped.
- `POST /api/email` — email format, template id from a closed set, no raw HTML input.
- Client mirrors the same schemas for UX — server re-validates everything.

### Rate limiting

- `express-rate-limit`: global 120 req/min per IP; stricter on expensive endpoints:
  `POST /api/quote` → 10/min per IP (each fans out to N carriers),
  `POST /api/analytics/event` → 60/min per IP (it's a firehose by design, but bounded).
- `429` responses include `Retry-After`; limits logged as `rate_limit.hit`.

### Helmet + CSP

- `helmet()` on the API: `X-Content-Type-Options: nosniff`, `frame-ancestors: 'none'`,
  `referrer-policy: no-referrer`, HSTS in prod.
- Web app `Content-Security-Policy` (meta + header):
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
   img-src 'self' data:; connect-src 'self' http://localhost:3001; frame-ancestors 'none'`.
  No inline event handlers; no `eval`.

### No secrets client-side

- Only `VITE_`-prefixed vars ship to the browser; CI fails the build if any
  `VITE_` value matches secret patterns (`*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASS`).
- SMTP credentials live server-side only, loaded from env, never logged.

### No PII in logs or analytics

- Analytics stores `session_hash = SHA-256(sessionId + server salt)` — the raw
  sessionId is never persisted or logged.
- Form payloads are never logged whole; log `fields_present: [...]` (key names only)
  if needed for debugging, never values.
- Forbidden in logs: names, emails, phones, addresses, VINs, policy numbers, DOBs,
  exact vehicle identifiers, secrets, tokens, raw request bodies.
- The dashboard displays aggregates only — there is no per-user drill-down by design.

### Dependency audit

- `npm audit` runs in CI on every push; `high`/`critical` findings block merge.
- Lockfiles committed (`package-lock.json`); no unpinned `*` ranges in production deps.
- Quarterly `npm outdated` review; major upgrades tested in a branch first.

### Error hygiene

- Client-facing errors: `{ error: { code: 'validation_failed', message: '…' } }` —
  generic, no stack traces, no SQL, no file paths.
- Server logs the full context (structured, requestId-correlated) — users see the code.
- 404/405 handlers return JSON, not the default Express HTML error page.

### CORS policy

- API CORS allowlist: `http://localhost:5173`, `http://localhost:5174` in dev;
  exact production origins from env in prod. Never `*`.
- `credentials: false` (no cookies in v0.2.0); preflight cached via `maxAge`.

### Session-id hashing

- `sessionId` is generated client-side (`crypto.randomUUID()`), sent with analytics events.
- Server hashes with SHA-256 + a per-deployment salt (`ANALYTICS_SALT`, required in prod)
  before storing. Salt rotation = new hashes; old rows remain valid aggregates.

## 3. Operational security

- `.env` is gitignored and never committed; `.env.example` documents shape with empty values.
- `*.db` files are gitignored; analytics data never leaves the host except in encrypted backups.
- `scripts/dev.sh` binds dev servers to `localhost` only — never `0.0.0.0` on a laptop.
- Secrets rotation: SMTP creds rotated on any suspected exposure; salt rotation planned
  annually or on incident.
- Incident response (demo-scale): revoke creds → rotate salt → redeploy → review logs for
  the exposure window. Full postmortem in `CHANGELOG.md`.

## 4. What "unhackable" does NOT mean

No system is unhackable; the mindset means: every feature ships with the checklist above
verified, every new endpoint gets a threat-model row before code, and security regressions
fail the build. See `docs/LOGGING.md` for what we record (and deliberately don't) when
something tries.
