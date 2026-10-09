/**
 * Rate limiting tiers (per IP per minute) — env-configurable, production-safe
 * defaults:
 *  - global:            300 (RATE_LIMIT_GLOBAL_PER_MIN)
 *  - POST /api/quote:    10 (RATE_LIMIT_QUOTE_PER_MIN; fans out to every carrier)
 *  - POST /api/analytics/event: 120 (RATE_LIMIT_ANALYTICS_EVENT_PER_MIN)
 * Breaches return 429 in the shared { error: { code, message, requestId } } shape.
 *
 * v0.9.0 scaling: the store is a factory. Redis (rate-limit-redis) when
 * REDIS_URL is set — required for correct limiting across a fleet — otherwise
 * express-rate-limit's in-memory default. The Redis probe is lazy and
 * fail-open: a down Redis degrades to the memory store with a warning, never
 * a crash. Top-level await is used so the limiter instances stay synchronous
 * for the rest of the app.
 */
import { rateLimit } from "express-rate-limit";
import type { Request, Response } from "express";
import type { Store } from "express-rate-limit";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

/** Factory: Redis store when a redisUrl is provided, else undefined (memory default).
 *  Exported for tests. Never throws — a down Redis degrades with a warning. */
export async function createRateLimitStore(redisUrl?: string): Promise<Store | undefined> {
  if (!redisUrl) return undefined; // in-memory default
  try {
    const [{ Redis: RedisCtor }, { RedisStore }] = await Promise.all([
      import("ioredis"),
      import("rate-limit-redis"),
    ]);
    const client = new RedisCtor(redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
      retryStrategy: (times: number) => (times > 2 ? null : Math.min(times * 200, 1000)),
    });
    client.on("error", (err: Error) => logger.warn({ msg: "rate_limit_redis_error", reason: err.message }));
    await client.ping();
    logger.info({ msg: "rate_limit_store", kind: "redis" });
    type RedisReply = string | number | boolean | Array<string | number | boolean>;
    const sendCommand = (...args: string[]): Promise<RedisReply> => {
      const [command, ...rest] = args;
      return client.call(command as string, ...rest) as Promise<RedisReply>;
    };
    return new RedisStore({ sendCommand });
  } catch (err) {
    logger.warn({
      msg: "rate_limit_redis_unavailable_falling_back_to_memory",
      reason: (err as Error).message,
    });
    return undefined;
  }
}

async function createStore(): Promise<Store | undefined> {
  return createRateLimitStore(config.redisUrl || undefined);
}

export const rateLimitStoreKind: Promise<"redis" | "memory"> = createStore().then((s) =>
  s ? "redis" : "memory",
);

const store = await createStore();

function limiter(max: number, message: string) {
  return rateLimit({
    windowMs: 60_000,
    max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    ...(store ? { store } : {}),
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: { code: "RATE_LIMITED", message, requestId: (req as Request & { requestId?: string }).requestId },
      });
    },
  });
}

export const globalLimiter = limiter(config.rateLimits.globalPerMin, "Too many requests — slow down.");
export const quoteLimiter = limiter(config.rateLimits.quotePerMin, "Too many quote requests — try again in a minute.");
export const analyticsEventLimiter = limiter(
  config.rateLimits.analyticsEventPerMin,
  "Too many analytics events — slow down.",
);

/** Test seam: which store backend was selected. */
export async function rateLimitStoreBackend(): Promise<"redis" | "memory"> {
  return rateLimitStoreKind;
}
