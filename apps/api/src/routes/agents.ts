/**
 * GET /api/agents?state=MA&zip=02139
 * → { state, zip, agents: [{ name, city, phone, carriers[], languages[], sample:true }] }
 *
 * Seeds live in data/agents/<STATE>.json. Unknown states → 200 with an empty
 * list (graceful degradation). All seeded entries are clearly fake
 * ("Sample Agent — …", 555-01xx numbers) — never real people's data.
 */
import { Router } from "express";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Agent } from "../../../../packages/shared/dist/types.js";
import { validate } from "../middleware/validate.js";
import { agentsQuerySchema } from "../lib/schemas.js";
import { logger } from "../lib/logger.js";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..", "..", "..");
const OVERRIDE = process.env.QUOTEPILOT_DATA_DIR;

export const agentsRouter = Router();

function loadAgents(state: string): Agent[] {
  const base = OVERRIDE ? resolve(OVERRIDE) : REPO_ROOT;
  const path = join(base, "data", "agents", `${state.toUpperCase()}.json`);
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is Agent => typeof a === "object" && a !== null && typeof (a as { name?: unknown }).name === "string",
    );
  } catch (err) {
    logger.warn({ msg: "agents_fallback_empty", state: state.toUpperCase(), reason: (err as Error).message });
    return [];
  }
}

agentsRouter.get("/agents", validate(agentsQuerySchema, "query"), (req, res) => {
  const { state, zip } = req.query as { state: string; zip?: string };
  const agents = loadAgents(state);
  res.json({ state: state.toUpperCase(), zip: zip ?? null, agents });
});
