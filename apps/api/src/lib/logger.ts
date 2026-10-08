/**
 * Structured JSON logger (pino-style, hand-rolled to keep the dep tree lean).
 *
 * SECURITY: this logger NEVER redacts automatically — callers are responsible
 * for never passing PII, raw request payloads, emails, or secrets into it.
 * Every request log line carries requestId, method, path, status, durationMs.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 50 };
const MIN_LEVEL = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel;

function emit(level: LogLevel, fields: Record<string, unknown>): void {
  if ((LEVELS[level] ?? 20) < (LEVELS[MIN_LEVEL] ?? 20)) return;
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    service: "quotepilot-api",
    ...fields,
  });
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  debug: (fields: Record<string, unknown>) => emit("debug", fields),
  info: (fields: Record<string, unknown>) => emit("info", fields),
  warn: (fields: Record<string, unknown>) => emit("warn", fields),
  error: (fields: Record<string, unknown>) => emit("error", fields),
};
