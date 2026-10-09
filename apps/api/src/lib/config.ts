/**
 * Runtime configuration. All secrets come from env; nothing sensitive is
 * defaulted here and nothing here is ever logged verbatim.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

export const config = {
  port: num("PORT", 3001),
  version: "0.2.0",
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: (process.env.NODE_ENV ?? "development") === "production",
  // CORS allow-list. Production: set CORS_ORIGIN to a comma-separated list of
  // allowed origins (e.g. your Vercel URL). Dev defaults to the local Vite ports.
  corsOrigins: [
    ...((process.env.CORS_ORIGIN ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)),
    ...((process.env.NODE_ENV ?? "development") === "production"
      ? []
      : ["http://localhost:5173", "http://localhost:5174"]),
  ],
  // Repo-root-relative data directory; resolves from the api package dir.
  dataDir: process.env.QUOTEPILOT_DATA_DIR ?? "",
  analyticsDbPath:
    process.env.ANALYTICS_DB ?? "data/analytics.db", // relative to api root; gitignored
  // Job engine
  perCarrierTimeoutMs: num("CARRIER_TIMEOUT_MS", 8000),
  // --- Scaling (v0.9.0): ALL optional. Leave unset for laptop dev — every
  // piece of infrastructure below degrades to a graceful in-memory fallback.
  // REDIS_URL: enables BullMQ quote queue, Redis rate-limit store, Redis
  //   quote-result cache, and the shared Places-agent cache. Unset → memory.
  redisUrl: process.env.REDIS_URL ?? "",
  // DATABASE_URL: Postgres analytics sink (e.g. postgres://user:pass@host/db).
  //   Unset → the local better-sqlite3 store. On connection failure we warn
  //   loudly and fall back to SQLite — analytics must never break quoting.
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Quote-result cache TTL in seconds (default 1 hour). Applies to both the
  // Redis and the in-memory LRU implementations.
  cacheTtlSeconds: num("CACHE_TTL_SECONDS", 3600),
  // Rate-limit tiers (per IP per minute). Defaults are the production-safe
  // values; raise them for load testing (see docs/SCALING.md).
  rateLimits: {
    globalPerMin: num("RATE_LIMIT_GLOBAL_PER_MIN", 300),
    quotePerMin: num("RATE_LIMIT_QUOTE_PER_MIN", 10),
    analyticsEventPerMin: num("RATE_LIMIT_ANALYTICS_EVENT_PER_MIN", 120),
  },
  // Email: when SMTP_HOST is set we send for real; otherwise dev-log mode.
  smtp: {
    host: process.env.SMTP_HOST,
    port: num("SMTP_PORT", 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? "quotes@quotepilot.local",
  },
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:5173",
  // CAN-SPAM physical postal address for email footers. REQUIRED in production
  // before any real send; never invent business data — leave unset in dev.
  senderPostalAddress: process.env.SENDER_POSTAL_ADDRESS ?? "",
} as const;

export type AppConfig = typeof config;
