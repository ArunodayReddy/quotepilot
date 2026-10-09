/**
 * Agent provider chain — real local insurance agents, nearest-first.
 *
 * Chain: PlacesAgentProvider (Google Places API, needs GOOGLE_PLACES_API_KEY)
 *     → SampleAgentProvider (seeded data/agents/<STATE>.json, always available)
 *
 * Free key-less sources were evaluated and rejected (2026-10-08): Overpass API
 * is unreachable from this network (HTTP 406) and Nominatim category search
 * returns almost nothing for insurance offices. Google Places is the primary;
 * the sample provider is the honest fallback (every entry badged "Sample data").
 *
 * API hosts used: maps.googleapis.com (Nearby Search + Place Details).
 */
import type { Agent, AgentHours, AgentSource, AgentWithDistance } from "../../../../packages/shared/dist/types.js";
import { logger } from "../lib/logger.js";
import { getAgentCache, _resetAgentCacheInstance } from "./agentCache.js";

export interface AgentProvider {
  readonly source: AgentSource;
  searchAgents(lat: number, lng: number, radiusMi: number): Promise<AgentWithDistance[]>;
}

/** Great-circle distance in miles between two lat/lng points. */
export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Sample provider — seeded demo data, always available, always honest.
// ---------------------------------------------------------------------------

export class SampleAgentProvider implements AgentProvider {
  readonly source: AgentSource = "sample";
  constructor(private readonly agents: Agent[]) {}

  async searchAgents(lat: number, lng: number, _radiusMi: number): Promise<AgentWithDistance[]> {
    return this.agents.map((a) => ({
      ...a,
      distance_mi:
        typeof a.lat === "number" && typeof a.lng === "number"
          ? round1(haversineMiles(lat, lng, a.lat, a.lng))
          : null,
      source: this.source,
    }));
  }
}

// ---------------------------------------------------------------------------
// Google Places provider — Nearby Search (type=insurance_agency) + Details.
// ---------------------------------------------------------------------------

const PLACES_HOST = "https://maps.googleapis.com";
const MAX_DETAILS = 10;
const FETCH_TIMEOUT_MS = 8000;

interface PlacesNearbyResult {
  place_id: string;
  name: string;
  geometry?: { location?: { lat: number; lng: number } };
  business_status?: string;
}

interface PlacesDetails {
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  geometry?: { location?: { lat: number; lng: number } };
  opening_hours?: { weekday_text?: string[] };
  business_status?: string;
}

/**
 * Map Google's opening_hours.weekday_text (["Monday: 9:00 AM – 5:00 PM", …])
 * into the QuotePilot hours schema. Pure function — unit-tested.
 */
export function mapOpeningHours(weekdayText: string[] | undefined): AgentHours {
  const closed: AgentHours = { weekdays: "Hours not listed", saturday: "Hours not listed", sunday: "Hours not listed" };
  if (!Array.isArray(weekdayText) || weekdayText.length === 0) return closed;

  const stripDay = (s: string): string => {
    const idx = s.indexOf(":");
    return idx >= 0 ? s.slice(idx + 1).trim() : s.trim();
  };
  const byDay: Record<string, string> = {};
  for (const entry of weekdayText) {
    const m = /^([A-Za-z]+)\s*:/.exec(entry);
    if (m) byDay[m[1].toLowerCase()] = stripDay(entry);
  }
  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"]
    .map((d) => byDay[d])
    .filter(Boolean) as string[];
  const uniqWeekdays = [...new Set(weekdays)];
  return {
    weekdays: uniqWeekdays.length === 1 ? uniqWeekdays[0] : uniqWeekdays.join("; ") || "Hours not listed",
    saturday: byDay["saturday"] ?? "Hours not listed",
    sunday: byDay["sunday"] ?? "Hours not listed",
  };
}

/** Heuristic parse of "123 Main St, Cambridge, MA 02139, USA" → parts. */
export function parseFormattedAddress(formatted: string | undefined): {
  address: string;
  city: string;
  zip: string;
} {
  const fallback = { address: formatted ?? "", city: "", zip: "" };
  if (!formatted) return fallback;
  const parts = formatted.split(",").map((p) => p.trim());
  if (parts.length < 2) return fallback;
  const address = parts[0];
  const stateZip = parts[parts.length - 2] ?? "";
  const zipMatch = /(\d{5})(?:-\d{4})?/.exec(stateZip);
  // City is the part before "ST ZIP"; country ("USA") is last and dropped.
  const city = parts.length >= 3 ? parts[parts.length - 3] : "";
  return { address, city, zip: zipMatch ? zipMatch[1] : "" };
}

async function placesFetch(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Places HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

export class PlacesAgentProvider implements AgentProvider {
  readonly source: AgentSource = "google_places";
  constructor(private readonly apiKey: string) {}

  async searchAgents(lat: number, lng: number, radiusMi: number): Promise<AgentWithDistance[]> {
    const radiusM = Math.min(Math.round(radiusMi * 1609.34), 50000);
    const nearbyUrl =
      `${PLACES_HOST}/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}&radius=${radiusM}&type=insurance_agency&key=${this.apiKey}`;
    const nearby = (await placesFetch(nearbyUrl)) as { status?: string; results?: PlacesNearbyResult[] };
    if (nearby.status !== "OK" && nearby.status !== "ZERO_RESULTS") {
      throw new Error(`Places Nearby Search status: ${nearby.status ?? "unknown"}`);
    }
    const candidates = (nearby.results ?? [])
      .filter((r) => r.business_status !== "CLOSED_PERMANENTLY" && r.business_status !== "CLOSED_TEMPORARILY")
      .slice(0, MAX_DETAILS);

    const agents: AgentWithDistance[] = [];
    for (const c of candidates) {
      try {
        const detailsUrl =
          `${PLACES_HOST}/maps/api/place/details/json` +
          `?place_id=${encodeURIComponent(c.place_id)}` +
          `&fields=name,formatted_address,formatted_phone_number,geometry,opening_hours,business_status` +
          `&key=${this.apiKey}`;
        const details = (await placesFetch(detailsUrl)) as { status?: string; result?: PlacesDetails };
        const d = details.result;
        if (!d || d.business_status === "CLOSED_PERMANENTLY" || d.business_status === "CLOSED_TEMPORARILY") continue;
        const loc = d.geometry?.location ?? c.geometry?.location;
        if (!d.name || !loc) continue;
        const parsed = parseFormattedAddress(d.formatted_address);
        agents.push({
          id: `places-${c.place_id}`,
          name: d.name,
          address: parsed.address || d.formatted_address || "",
          city: parsed.city,
          zip: parsed.zip,
          phone: d.formatted_phone_number ?? "Phone not listed",
          lat: loc.lat,
          lng: loc.lng,
          hours: mapOpeningHours(d.opening_hours?.weekday_text),
          carriers: [],
          languages: [],
          sample: false,
          distance_mi: round1(haversineMiles(lat, lng, loc.lat, loc.lng)),
          source: this.source,
        });
      } catch (err) {
        // One bad Details call must not sink the whole search.
        logger.warn({ msg: "places_details_failed", placeId: c.place_id, reason: (err as Error).message });
      }
    }
    return agents;
  }
}

// ---------------------------------------------------------------------------
// Chain resolution + cache
// ---------------------------------------------------------------------------

// v0.9.0: the Places cache moved to services/agentCache.ts — Redis when
// REDIS_URL is set, otherwise the same per-instance in-memory Map as before.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(lat: number, lng: number, radiusMi: number): string {
  return `qp:agents:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusMi}`;
}

/** Test seam: reset the Places cache (both backends). */
export async function _resetAgentCache(): Promise<void> {
  _resetAgentCacheInstance();
  await getAgentCache().clear();
}

/** Pick the provider for this request. Exported for tests. */
export function createProvider(apiKey: string | undefined, sampleAgents: Agent[]): AgentProvider {
  if (apiKey && apiKey.trim().length > 0) return new PlacesAgentProvider(apiKey.trim());
  return new SampleAgentProvider(sampleAgents);
}

/**
 * Run the chain: Places when a key is configured, sample fallback on any
 * Places failure. Never throws for provider reasons — worst case is the
 * sample list (possibly empty for unknown states).
 */
export async function searchAgentsWithFallback(
  lat: number,
  lng: number,
  radiusMi: number,
  sampleAgents: Agent[],
  apiKey: string | undefined,
): Promise<{ agents: AgentWithDistance[]; source: AgentSource; fallbackReason: string | null }> {
  const primary = createProvider(apiKey, sampleAgents);
  if (primary.source === "sample") {
    return { agents: await primary.searchAgents(lat, lng, radiusMi), source: "sample", fallbackReason: "no_places_key" };
  }
  const key = cacheKey(lat, lng, radiusMi);
  const cache = getAgentCache();
  const cached = await cache.get(key);
  if (cached) {
    return { agents: cached, source: "google_places", fallbackReason: null };
  }
  try {
    const agents = await primary.searchAgents(lat, lng, radiusMi);
    await cache.set(key, agents, CACHE_TTL_MS);
    return { agents, source: "google_places", fallbackReason: null };
  } catch (err) {
    const reason = (err as Error).message;
    logger.warn({ msg: "places_fallback_to_sample", reason });
    const fallback = new SampleAgentProvider(sampleAgents);
    return { agents: await fallback.searchAgents(lat, lng, radiusMi), source: "sample", fallbackReason: reason };
  }
}
