/**
 * Lazy shared Redis client (v0.9.0 scaling).
 *
 * getRedisClient() returns null when REDIS_URL is unset (laptop dev) or when
 * the connection probe fails — every consumer treats null as "use the
 * in-memory fallback". The client is created once per process; ioredis
 * connects lazily on first command.
 *
 * Never throws: a down Redis must degrade the deployment, never crash it.
 */
import type { Redis } from "ioredis";
import { config } from "./config.js";
import { logger } from "./logger.js";

let client: Redis | null = null;
let probe: Promise<Redis | null> | null = null;

async function connect(): Promise<Redis | null> {
  if (!config.redisUrl) return null;
  try {
    const { Redis: RedisCtor } = await import("ioredis");
    const c: Redis = new RedisCtor(config.redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      // Fail fast in dev/demo: don't hang the boot sequence on a dead Redis.
      connectTimeout: 3000,
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 1000)),
    });
    c.on("error", (err: Error) => {
      logger.warn({ msg: "redis_error", reason: err.message });
    });
    await c.ping();
    logger.info({ msg: "redis_connected" });
    return c;
  } catch (err) {
    logger.warn({
      msg: "redis_unavailable_falling_back_to_memory",
      reason: (err as Error).message,
    });
    return null;
  }
}

/** Shared client, or null when Redis is not configured/reachable. */
export function getRedisClient(): Promise<Redis | null> {
  if (client) return Promise.resolve(client);
  if (!probe) {
    probe = connect().then((c) => {
      client = c;
      return c;
    });
  }
  return probe;
}

/** Test hook: drop the cached client so tests can re-probe. */
export function _resetRedisClient(): void {
  if (client) {
    void client.quit().catch(() => undefined);
    client = null;
  }
  probe = null;
}
