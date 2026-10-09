/**
 * Agent directory lookup — the server-side source of truth for "which agents
 * exist for this state/ZIP".
 *
 * Extracted (v0.11.0) from routes/agents.ts so the quote-request flow can
 * validate agentIds against exactly the same directory the UI renders:
 * sample seeds in data/agents/<STATE>.json, enriched by the provider chain
 * (Google Places → sample fallback) when the ZIP geocodes.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Agent, AgentWithDistance } from "../../../../packages/shared/dist/types.js";
import { logger } from "../lib/logger.js";
import { searchAgentsWithFallback } from "./agentProvider.js";

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

/** Raw seed agents for a state (no distance enrichment). */
export function loadAgents(state: string): Agent[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(dataPath("agents", `${state.toUpperCase()}.json`), "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAgent);
  } catch (err) {
    logger.warn({ msg: "agents_fallback_empty", state: state.toUpperCase(), reason: (err as Error).message });
    return [];
  }
}

export interface ZipCentroid {
  lat: number;
  lng: number;
  city: string;
}

let centroidCache: Record<string, ZipCentroid> | null = null;

/** ZIP → approximate centroid (demo-grade, documented in data/geocode/). */
export function loadCentroids(): Record<string, ZipCentroid> {
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

export interface AgentDirectoryResult {
  agents: AgentWithDistance[];
  /** Which provider served the results ("google_places" = live, "sample" = fallback). */
  source: "google_places" | "sample";
  /** Non-null when the live directory was unavailable and sample data was used. */
  fallbackReason: string | null;
}

/**
 * The agents a user could have seen for this state/ZIP — same provider chain
 * as GET /api/agents. Used to validate agentIds on quote-request submission.
 */
export async function lookupAgents(state: string, zip: string): Promise<AgentDirectoryResult> {
  const normalizedState = state.toUpperCase();
  const sampleAgents = loadAgents(normalizedState);
  const centroid = loadCentroids()[zip];
  if (!centroid) {
    return {
      agents: sampleAgents.map((a) => ({ ...a, distance_mi: null, source: "sample" as const })),
      source: "sample" as const,
      fallbackReason: "zip_not_geocoded",
    };
  }
  const { agents, source, fallbackReason } = await searchAgentsWithFallback(
    centroid.lat,
    centroid.lng,
    SEARCH_RADIUS_MI,
    sampleAgents,
    process.env.GOOGLE_PLACES_API_KEY,
  );
  const sorted = agents.sort(
    (a, b) => (a.distance_mi ?? Number.POSITIVE_INFINITY) - (b.distance_mi ?? Number.POSITIVE_INFINITY),
  );
  return { agents: sorted, source, fallbackReason };
}
