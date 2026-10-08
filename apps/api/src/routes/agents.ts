/**
 * GET /api/agents?state=MA&zip=02139
 * → { state, zip, geocoded, note, agents: [{ id, name, address, city, zip,
 *     phone, lat, lng, hours, carriers[], languages[], sample, distance_mi,
 *     source }] }
 *
 * Provider chain (see services/agentProvider.ts): Google Places
 * (GOOGLE_PLACES_API_KEY) → sample seed fallback. When `zip` matches a
 * centroid in data/geocode/zip_centroids.json, agents are sorted by haversine
 * distance and `geocoded` is true. Unknown ZIP → 200 with `geocoded:false`,
 * unsorted sample list, and an explanatory note. Unknown states → 200 with an
 * empty list (graceful degradation).
 *
 * Seeds live in data/agents/<STATE>.json. Sample entries are clearly fake
 * ("Sample Agent — …", 555-01xx numbers, approximate coordinates) — never
 * real people's data.
 */
import { Router } from "express";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Agent, AgentWithDistance } from "../../../../packages/shared/dist/types.js";
import { validate } from "../middleware/validate.js";
import { agentsQuerySchema } from "../lib/schemas.js";
import { logger } from "../lib/logger.js";
import { searchAgentsWithFallback } from "../services/agentProvider.js";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..", "..", "..");
const OVERRIDE = process.env.QUOTEPILOT_DATA_DIR;
const SEARCH_RADIUS_MI = 25;

function dataPath(...parts: string[]): string {
  const base = OVERRIDE ? resolve(OVERRIDE) : REPO_ROOT;
  return join(base, "data", ...parts);
}

function isAgent(a: unknown): a is Agent {
  return (
    typeof a === "object" &&
    a !== null &&
    typeof (a as { name?: unknown }).name === "string" &&
    typeof (a as { city?: unknown }).city === "string"
  );
}

function loadAgents(state: string): Agent[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(dataPath("agents", `${state.toUpperCase()}.json`), "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAgent);
  } catch (err) {
    logger.warn({ msg: "agents_fallback_empty", state: state.toUpperCase(), reason: (err as Error).message });
    return [];
  }
}

interface ZipCentroid {
  lat: number;
  lng: number;
  city: string;
}

let centroidCache: Record<string, ZipCentroid> | null = null;

function loadCentroids(): Record<string, ZipCentroid> {
  if (centroidCache) return centroidCache;
  try {
    const parsed: unknown = JSON.parse(readFileSync(dataPath("geocode", "zip_centroids.json"), "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed as Record<string, unknown>).filter(
        ([k, v]) =>
          k !== "_note" &&
          typeof v === "object" &&
          v !== null &&
          typeof (v as ZipCentroid).lat === "number" &&
          typeof (v as ZipCentroid).lng === "number",
      );
      centroidCache = Object.fromEntries(entries) as Record<string, ZipCentroid>;
    } else {
      centroidCache = {};
    }
  } catch (err) {
    logger.warn({ msg: "geocode_fallback_empty", reason: (err as Error).message });
    centroidCache = {};
  }
  return centroidCache;
}

export const agentsRouter = Router();

agentsRouter.get("/agents", validate(agentsQuerySchema, "query"), async (req, res, next) => {
  try {
    const { state, zip } = req.query as { state: string; zip?: string };
    const normalizedState = state.toUpperCase();
    const sampleAgents = loadAgents(normalizedState);

    let geocoded = false;
    let note: string | null = null;
    let results: AgentWithDistance[];

    if (zip) {
      const centroid = loadCentroids()[zip];
      if (centroid) {
        geocoded = true;
        const { agents, source, fallbackReason } = await searchAgentsWithFallback(
          centroid.lat,
          centroid.lng,
          SEARCH_RADIUS_MI,
          sampleAgents,
          process.env.GOOGLE_PLACES_API_KEY,
        );
        results = agents.sort(
          (a, b) => (a.distance_mi ?? Number.POSITIVE_INFINITY) - (b.distance_mi ?? Number.POSITIVE_INFINITY),
        );
        if (fallbackReason) {
          note = `Live directory unavailable — showing sample listings. (${fallbackReason})`;
        }
        logger.info({
          msg: "agents_search",
          state: normalizedState,
          zip,
          geocoded: true,
          source,
          resultCount: results.length,
        });
      } else {
        note = `ZIP ${zip} isn't in our demo geocoder — showing all ${normalizedState} agents unsorted.`;
        results = sampleAgents.map((a) => ({ ...a, distance_mi: null, source: "sample" as const }));
        logger.info({ msg: "agents_search", state: normalizedState, zip, geocoded: false, resultCount: results.length });
      }
    } else {
      results = sampleAgents.map((a) => ({ ...a, distance_mi: null, source: "sample" as const }));
    }

    res.json({ state: normalizedState, zip: zip ?? null, geocoded, note, agents: results });
  } catch (err) {
    next(err);
  }
});
