/**
 * Carrier registry: loads data/carriers/<STATE>.json, degrades gracefully.
 * Unknown states (or a missing/ corrupt file) return an empty list — never throw.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CarrierRegistryEntry } from "../../../../packages/shared/dist/types.js";
import { logger } from "../lib/logger.js";

const here = dirname(fileURLToPath(import.meta.url));
// src/services → <repo>/quote-pilot ; data/ lives at <repo>/quote-pilot/data
const REPO_ROOT = resolve(here, "..", "..", "..", "..");
const OVERRIDE = process.env.QUOTEPILOT_DATA_DIR;

function dataDir(): string {
  return OVERRIDE ? resolve(OVERRIDE) : REPO_ROOT;
}

export function getCarriersForState(state: string): CarrierRegistryEntry[] {
  const code = state.toUpperCase();
  const path = join(dataDir(), "data", "carriers", `${code}.json`);
  try {
    const raw = readFileSync(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is CarrierRegistryEntry =>
        typeof e === "object" && e !== null && typeof (e as { id?: unknown }).id === "string",
    );
  } catch (err) {
    // Missing file / bad JSON → graceful degradation, never a 500.
    logger.warn({ msg: "carrier_registry_fallback", state: code, reason: (err as Error).message });
    return [];
  }
}

/** Registry entries keyed by carrier id, for the agent directory + web display. */
export function getCarrierEntry(state: string, carrierId: string): CarrierRegistryEntry | undefined {
  return getCarriersForState(state).find((e) => e.id === carrierId);
}
