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
  // Email: when SMTP_HOST is set we send for real; otherwise dev-log mode.
  smtp: {
    host: process.env.SMTP_HOST,
    port: num("SMTP_PORT", 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? "quotes@quotepilot.local",
  },
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:5173",
} as const;

export type AppConfig = typeof config;
