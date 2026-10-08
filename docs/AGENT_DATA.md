# QuotePilot — Agent Data

How the local-agent directory gets its listings, why Google Places won, and how to go live.

> Last updated: 2026-10-08 (v0.4.0)

## The provider chain

`GET /api/agents?state=MA&zip=02139` resolves agents through a chain
(`apps/api/src/services/agentProvider.ts`):

1. **PlacesAgentProvider** (primary) — Google Places API, only when
   `GOOGLE_PLACES_API_KEY` is set.
2. **SampleAgentProvider** (fallback) — `data/agents/<STATE>.json` seeds.
   Used when no key is configured OR when any Places call fails. The fallback
   reason is logged (never PII) and surfaced in the API `note` field.

Every agent in the response carries `source: "google_places" | "sample"`.
The UI badges them **"Live data"** (green) vs **"Sample data"** (amber) —
sample listings are never presented as real businesses.

## Why Google Places

Evaluated 2026-10-08 for free, key-less sources:

- **Overpass API** — unreachable from this network (HTTP 406 on all attempts).
- **Nominatim category search** — effectively no insurance-office coverage
  (one real hit in testing: an Allstate agent in Belmont MA). OSM data is too
  thin for a directory product.
- **Google Places** — `type=insurance_agency` Nearby Search + Place Details
  is the only evaluated source with real, dense coverage. Requires an API key.

## How the Places provider works

1. **Nearby Search**: `type=insurance_agency`, `location={lat},{lng}`,
   `radius` = search radius in meters (25 mi default, capped at 50 km —
   the Places maximum).
2. **Place Details** for the top ~10 candidates, requesting only
   `name, formatted_address, formatted_phone_number, geometry, opening_hours, business_status`.
   Skips `business_status` of `CLOSED_PERMANENTLY` / `CLOSED_TEMPORARILY`.
   One failing Details call never sinks the whole search.
3. **Mapping**:
   - `formatted_address` ("123 Main St, Cambridge, MA 02139, USA") is parsed
     heuristically into street / city / ZIP.
   - `opening_hours.weekday_text` (7 "Monday: 9:00 AM – 5:00 PM" strings) is
     collapsed into `{ weekdays, saturday, sunday }` — identical Mon–Fri
     ranges merge into one string.
   - `formatted_phone_number` may be absent → "Phone not listed".
   - `carriers` / `languages` are unknown from Places → `[]` (UI hides them).
4. **Cache**: in-memory, keyed by rounded lat/lng + radius, 24 h TTL —
   repeated ZIP searches don't re-spend quota.

## Quota & pricing notes (check current Google pricing)

- Nearby Search and Place Details are both billed per request (Details with
  the field mask above falls in the cheaper "Essentials" tier historically).
- Google Cloud offers a recurring monthly free credit that comfortably covers
  demo/hackathon traffic; set budget alerts in the Console.
- The 24 h result cache + 10-details cap keep per-search cost to ~11 requests.

## Going live (checklist for Arun)

1. Google Cloud Console → new project (or existing) → **APIs & Services →
   Library** → enable **Places API**.
2. **Credentials → Create credentials → API key**. Copy it.
3. (Recommended) **Restrict the key**: Application restrictions → HTTP
   referrers → your domain(s); API restrictions → Places API only.
4. Set `GOOGLE_PLACES_API_KEY=<key>` in the API environment (`.env`
   locally — never commit it).
5. Restart the API and search agents by ZIP — cards should flip from
   "Sample data" to "Live data".

## Demo geocoding

ZIP → coordinates comes from `data/geocode/zip_centroids.json`
(~26 MA ZIPs, approximate city-center centroids). Unknown ZIPs return
`geocoded: false` with the unsorted sample list. Production should replace
this with a real geocoder (US Census Geocoder is free, no key).
