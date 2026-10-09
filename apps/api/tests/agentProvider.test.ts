/**
 * Provider-chain tests: hours mapper, address parser, provider selection,
 * and the Places → sample fallback. Live Places calls are never tested
 * (no key in CI) — fetch is fully mocked here.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  _resetAgentCache,
  createProvider,
  haversineMiles,
  mapOpeningHours,
  parseFormattedAddress,
  PlacesAgentProvider,
  SampleAgentProvider,
  searchAgentsWithFallback,
} from "../src/services/agentProvider.js";
import type { Agent } from "../../../packages/shared/dist/types.js";

const sampleAgents: Agent[] = [
  {
    id: "s1",
    name: "Sample Agent — Cambridge",
    address: "123 Massachusetts Ave",
    city: "Cambridge",
    zip: "02139",
    phone: "555-010-0102",
    lat: 42.3647,
    lng: -71.1042,
    hours: { weekdays: "9:00 AM – 6:00 PM", saturday: "10:00 AM – 2:00 PM", sunday: "Closed" },
    carriers: [],
    languages: [],
    sample: true,
  },
];

afterEach(async () => {
  vi.unstubAllGlobals();
  await _resetAgentCache();
});

describe("mapOpeningHours", () => {
  it("collapses identical Mon–Fri ranges", () => {
    const hours = mapOpeningHours([
      "Monday: 9:00 AM – 5:00 PM",
      "Tuesday: 9:00 AM – 5:00 PM",
      "Wednesday: 9:00 AM – 5:00 PM",
      "Thursday: 9:00 AM – 5:00 PM",
      "Friday: 9:00 AM – 5:00 PM",
      "Saturday: Closed",
      "Sunday: Closed",
    ]);
    expect(hours.weekdays).toBe("9:00 AM – 5:00 PM");
    expect(hours.saturday).toBe("Closed");
    expect(hours.sunday).toBe("Closed");
  });

  it("joins differing weekday ranges", () => {
    const hours = mapOpeningHours([
      "Monday: 9:00 AM – 5:00 PM",
      "Tuesday: 10:00 AM – 6:00 PM",
      "Wednesday: 9:00 AM – 5:00 PM",
      "Thursday: 9:00 AM – 5:00 PM",
      "Friday: 9:00 AM – 5:00 PM",
      "Saturday: 10:00 AM – 2:00 PM",
      "Sunday: Closed",
    ]);
    expect(hours.weekdays).toContain("9:00 AM – 5:00 PM");
    expect(hours.weekdays).toContain("10:00 AM – 6:00 PM");
    expect(hours.saturday).toBe("10:00 AM – 2:00 PM");
  });

  it("handles missing input gracefully", () => {
    const hours = mapOpeningHours(undefined);
    expect(hours.weekdays).toBe("Hours not listed");
    expect(hours.saturday).toBe("Hours not listed");
    expect(hours.sunday).toBe("Hours not listed");
  });
});

describe("parseFormattedAddress", () => {
  it("splits a US formatted address", () => {
    const p = parseFormattedAddress("123 Main St, Cambridge, MA 02139, USA");
    expect(p.address).toBe("123 Main St");
    expect(p.city).toBe("Cambridge");
    expect(p.zip).toBe("02139");
  });

  it("handles missing input", () => {
    const p = parseFormattedAddress(undefined);
    expect(p.address).toBe("");
    expect(p.zip).toBe("");
  });
});

describe("haversineMiles", () => {
  it("is ~0 for identical points and sane for Boston→Cambridge", () => {
    expect(haversineMiles(42.36, -71.1, 42.36, -71.1)).toBeCloseTo(0, 6);
    const d = haversineMiles(42.3588, -71.0603, 42.3647, -71.1042);
    expect(d).toBeGreaterThan(1);
    expect(d).toBeLessThan(5);
  });
});

describe("createProvider", () => {
  it("selects Places when a key is set, sample otherwise", () => {
    expect(createProvider("KEY123", sampleAgents)).toBeInstanceOf(PlacesAgentProvider);
    expect(createProvider(undefined, sampleAgents)).toBeInstanceOf(SampleAgentProvider);
    expect(createProvider("   ", sampleAgents)).toBeInstanceOf(SampleAgentProvider);
  });
});

describe("searchAgentsWithFallback", () => {
  it("uses the sample provider when no key is configured", async () => {
    const { agents, source, fallbackReason } = await searchAgentsWithFallback(
      42.3647, -71.1042, 25, sampleAgents, undefined,
    );
    expect(source).toBe("sample");
    expect(fallbackReason).toBe("no_places_key");
    expect(agents).toHaveLength(1);
    expect(agents[0].distance_mi).toBe(0);
  });

  it("falls back to sample when Places fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { agents, source, fallbackReason } = await searchAgentsWithFallback(
      42.3647, -71.1042, 25, sampleAgents, "KEY123",
    );
    expect(source).toBe("sample");
    expect(fallbackReason).toMatch(/network down/);
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe("Sample Agent — Cambridge");
  });

  it("maps Places Nearby Search + Details into agents", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("nearbysearch")) {
        return {
          ok: true,
          json: async () => ({
            status: "OK",
            results: [
              {
                place_id: "abc123",
                name: "Real Insurance Agency",
                business_status: "OPERATIONAL",
                geometry: { location: { lat: 42.37, lng: -71.11 } },
              },
              {
                place_id: "dead999",
                name: "Closed Agency",
                business_status: "CLOSED_PERMANENTLY",
                geometry: { location: { lat: 42.38, lng: -71.12 } },
              },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          status: "OK",
          result: {
            name: "Real Insurance Agency",
            formatted_address: "999 Real St, Cambridge, MA 02139, USA",
            formatted_phone_number: "(617) 555-0199",
            business_status: "OPERATIONAL",
            geometry: { location: { lat: 42.37, lng: -71.11 } },
            opening_hours: {
              weekday_text: [
                "Monday: 9:00 AM – 5:00 PM",
                "Tuesday: 9:00 AM – 5:00 PM",
                "Wednesday: 9:00 AM – 5:00 PM",
                "Thursday: 9:00 AM – 5:00 PM",
                "Friday: 9:00 AM – 5:00 PM",
                "Saturday: Closed",
                "Sunday: Closed",
              ],
            },
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { agents, source, fallbackReason } = await searchAgentsWithFallback(
      42.3647, -71.1042, 25, sampleAgents, "KEY123",
    );
    expect(source).toBe("google_places");
    expect(fallbackReason).toBeNull();
    expect(agents).toHaveLength(1); // closed agency skipped
    const a = agents[0];
    expect(a.id).toBe("places-abc123");
    expect(a.name).toBe("Real Insurance Agency");
    expect(a.address).toBe("999 Real St");
    expect(a.city).toBe("Cambridge");
    expect(a.zip).toBe("02139");
    expect(a.phone).toBe("(617) 555-0199");
    expect(a.hours.weekdays).toBe("9:00 AM – 5:00 PM");
    expect(a.sample).toBe(false);
    expect(a.distance_mi).toBeGreaterThan(0);
  });

  it("caches Places results for identical searches", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: "ZERO_RESULTS", results: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await searchAgentsWithFallback(42.3647, -71.1042, 25, sampleAgents, "KEY123");
    await searchAgentsWithFallback(42.3647, -71.1042, 25, sampleAgents, "KEY123");
    expect(fetchMock).toHaveBeenCalledTimes(1); // second call served from cache
  });
});
