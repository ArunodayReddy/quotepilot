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
import type { AgentWithDistance } from "../../../../packages/shared/dist/types.js";
import { validate } from "../middleware/validate.js";
import { agentsQuerySchema } from "../lib/schemas.js";
import { logger } from "../lib/logger.js";
import { loadAgents, loadCentroids, lookupAgents } from "../services/agentDirectory.js";

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
        const { agents, source, fallbackReason } = await lookupAgents(normalizedState, zip);
        results = agents;
        if (fallbackReason && fallbackReason !== "zip_not_geocoded") {
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
