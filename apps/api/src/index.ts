/**
 * API bootstrap: wire the app and listen. `npm run dev` / `npm start`.
 *
 * v0.9.0: graceful shutdown — SIGTERM/SIGINT close the HTTP server, then the
 * job queue (BullMQ worker + Redis connections) and the analytics sink, so
 * in-flight quote jobs finish their current carrier before the process exits.
 */
import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { _resetJobQueue } from "./services/queue.js";
import { _resetAnalyticsSink } from "./services/analyticsSink.js";

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info({
    msg: "api_listening",
    port: config.port,
    version: config.version,
    env: config.nodeEnv,
    redis: config.redisUrl ? "configured" : "not-configured",
    database: config.databaseUrl ? "postgres" : "sqlite",
  });
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ msg: "shutdown_start", signal });

  // Stop accepting new connections; wait up to 15s for in-flight requests.
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    setTimeout(resolve, 15000).unref();
  });

  // Release queue + analytics resources (Redis connections, workers, pools).
  await _resetJobQueue();
  await _resetAnalyticsSink();

  logger.info({ msg: "shutdown_complete" });
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
