/**
 * GET /api/disclosures/:state → 200 with the state's consumer-education notes,
 * or 404 { ok:false } when the state has no disclosure file. The web client
 * degrades gracefully (no panel) on 404.
 *
 * Files live in data/disclosures/<STATE>.json (see docs/COMPLIANCE.md §2).
 */
import { Router } from "express";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../middleware/validate.js";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..", "..", "..");

function dataDir(): string {
  const override = process.env.QUOTEPILOT_DATA_DIR;
  return override ? resolve(override) : REPO_ROOT;
}

const stateParamSchema = z.object({ state: z.string().regex(/^[A-Za-z]{2}$/) });

export const disclosuresRouter = Router();

disclosuresRouter.get("/disclosures/:state", validate(stateParamSchema, "params"), (req, res) => {
  const code = (req.params as { state: string }).state.toUpperCase();
  try {
    const raw = readFileSync(join(dataDir(), "data", "disclosures", `${code}.json`), "utf8");
    res.json(JSON.parse(raw));
  } catch {
    res.status(404).json({ ok: false, error: "no disclosures for state" });
  }
});
