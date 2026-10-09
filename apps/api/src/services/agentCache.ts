/**
 * Shared cache for Google Places agent results (v0.9.0 scaling).
 *
 * Previously a module-level Map (per-instance, lost on restart). Now Redis
 * when REDIS_URL is set — shared across a fleet — otherwise the same
 * in-memory Map as before (per-instance staleness is tolerable: 24h TTL on
 * slowly-changing business listings).
 */
import type { AgentWithDistance } from "../../../../packages/shared/dist/types.js";
import { logger } from "../lib/logger.js";
import { config } from "../lib/config.js";
import { getRedisClient } from "../lib/redis.js";

export interface AgentCache {
  get(key: string): Promise<AgentWithDistance[] | undefined>;
  set(key: string, agents: AgentWithDistance[], ttlMs: number): Promise<void>;
  clear(): Promise<void>;
}

class MemoryAgentCache implements AgentCache {
  private readonly entries = new Map<string, { at: number; ttlMs: number; agents: AgentWithDistance[] }>();

  async get(key: string): Promise<AgentWithDistance[] | undefined> {
    const e = this.entries.get(key);
    if (!e) return undefined;
    if (Date.now() - e.at > e.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return e.agents;
  }

  async set(key: string, agents: AgentWithDistance[], ttlMs: number): Promise<void> {
    this.entries.set(key, { at: Date.now(), ttlMs, agents });
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }
}

class RedisAgentCache implements AgentCache {
  async get(key: string): Promise<AgentWithDistance[] | undefined> {
    const client = await getRedisClient();
    if (!client) return undefined;
    try {
      const raw = await client.get(key);
      return raw ? (JSON.parse(raw) as AgentWithDistance[]) : undefined;
    } catch (err) {
      logger.warn({ msg: "agent_cache_get_failed", reason: (err as Error).message });
      return undefined;
    }
  }

  async set(key: string, agents: AgentWithDistance[], ttlMs: number): Promise<void> {
    const client = await getRedisClient();
    if (!client) return;
    try {
      await client.set(key, JSON.stringify(agents), "PX", Math.max(1, Math.floor(ttlMs)));
    } catch (err) {
      logger.warn({ msg: "agent_cache_set_failed", reason: (err as Error).message });
    }
  }

  async clear(): Promise<void> {
    const client = await getRedisClient();
    if (!client) return;
    const stream = client.scanStream({ match: "qp:agents:*", count: 100 });
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

let active: AgentCache | null = null;

export function getAgentCache(): AgentCache {
  if (active) return active;
  active = config.redisUrl ? new RedisAgentCache() : new MemoryAgentCache();
  return active;
}

/** Test hook. */
export function _resetAgentCacheInstance(): void {
  active = null;
}
