/**
 * Quote-result cache (v0.9.0 scaling).
 *
 * Completed quote results are cached keyed by a SHA-256 of the RATING FACTORS
 * only — state, ZIP, driver risk fields, vehicle fields, coverage. The key
 * derivation NEVER touches email, phone, first/last name, or street address,
 * so a cache key cannot be reversed into PII. Responses served from cache
 * carry `cached: true`.
 *
 * Redis when REDIS_URL is set, otherwise a small in-memory LRU (500 entries).
 * TTL from CACHE_TTL_SECONDS (default 3600).
 */
import type { QuoteRequest, QuoteResult } from "../../../../packages/shared/dist/types.js";
import { sha256Hex } from "../lib/hash.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { getRedisClient } from "../lib/redis.js";

export interface QuoteCache {
  get(key: string): Promise<QuoteResult[] | undefined>;
  set(key: string, results: QuoteResult[], ttlSeconds: number): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Derive the cache key from rating factors only. Drivers/vehicles are sorted
 * so field order doesn't fragment the cache. Contact identity fields
 * (email, phone, firstName, lastName) are deliberately excluded.
 */
export function quoteCacheKey(request: QuoteRequest): string {
  const drivers = request.drivers
    .map((d) =>
      [d.age, d.gender, d.yearsLicensed, d.accidentsLast5Years, d.violationsLast3Years].join(","),
    )
    .sort()
    .join("|");
  const vehicles = request.vehicles
    .map((v) =>
      [
        v.year,
        v.make.toLowerCase(),
        v.model.toLowerCase(),
        v.ownership,
        v.usage,
        v.annualMileage,
        v.garagedZip,
      ].join(","),
    )
    .sort()
    .join("|");
  const coverage = Object.entries(request.coverage as unknown as Record<string, number | boolean>)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  const raw = ["v1", request.contact.state, request.contact.zip, drivers, vehicles, coverage].join("~");
  return `qp:quotecache:${sha256Hex(raw)}`;
}

class MemoryQuoteCache implements QuoteCache {
  private readonly entries = new Map<string, { at: number; ttlMs: number; results: QuoteResult[] }>();
  constructor(private readonly maxEntries = 500) {}

  async get(key: string): Promise<QuoteResult[] | undefined> {
    const e = this.entries.get(key);
    if (!e) return undefined;
    if (Date.now() - e.at > e.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    // LRU touch: re-insert to mark as most-recently-used.
    this.entries.delete(key);
    this.entries.set(key, e);
    return e.results.map((r) => ({ ...r }));
  }

  async set(key: string, results: QuoteResult[], ttlSeconds: number): Promise<void> {
    if (this.entries.has(key)) this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
    this.entries.set(key, { at: Date.now(), ttlMs: ttlSeconds * 1000, results: results.map((r) => ({ ...r })) });
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  /** Test seam. */
  _size(): number {
    return this.entries.size;
  }
}

class RedisQuoteCache implements QuoteCache {
  async get(key: string): Promise<QuoteResult[] | undefined> {
    const client = await getRedisClient();
    if (!client) return undefined;
    try {
      const raw = await client.get(key);
      if (!raw) return undefined;
      return JSON.parse(raw) as QuoteResult[];
    } catch (err) {
      logger.warn({ msg: "quote_cache_get_failed", reason: (err as Error).message });
      return undefined;
    }
  }

  async set(key: string, results: QuoteResult[], ttlSeconds: number): Promise<void> {
    const client = await getRedisClient();
    if (!client) return;
    try {
      await client.set(key, JSON.stringify(results), "EX", Math.max(1, Math.floor(ttlSeconds)));
    } catch (err) {
      logger.warn({ msg: "quote_cache_set_failed", reason: (err as Error).message });
    }
  }

  async clear(): Promise<void> {
    const client = await getRedisClient();
    if (!client) return;
    // Only our own keys — never FLUSHDB on a shared Redis.
    const stream = client.scanStream({ match: "qp:quotecache:*", count: 100 });
    const pipeline = client.pipeline();
    let n = 0;
    stream.on("data", (keys: string[]) => {
      for (const k of keys) {
        pipeline.del(k);
        n += 1;
      }
    });
    await new Promise<void>((resolve, reject) => {
      stream.on("end", () => resolve());
      stream.on("error", (e: Error) => reject(e));
    });
    if (n > 0) await pipeline.exec();
  }
}

let active: QuoteCache | null = null;

export function getQuoteCache(): QuoteCache {
  if (active) return active;
  active = config.redisUrl ? new RedisQuoteCache() : new MemoryQuoteCache();
  return active;
}

/** TTL in seconds for completed-result cache entries. */
export function quoteCacheTtlSeconds(): number {
  return config.cacheTtlSeconds;
}

/** Test hook: drop the cached instance. */
export function _resetQuoteCache(): void {
  active = null;
}
