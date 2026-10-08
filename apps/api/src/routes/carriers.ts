/**
 * GET /api/carriers?state=MA
 * → { state, carriers: [{ id, name, channel, statesServed, logo, quotable, notes?, available? }] }
 * → unknown state: 200 { state, carriers: [], note }
 *
 * Reads data/carriers/<STATE>.json through the carrier registry service.
 * Unknown states degrade gracefully (200 + empty list + note), never a 500.
 * Bad state codes → 400 VALIDATION_ERROR via the zod query schema.
 */
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { carriersQuerySchema } from "../lib/schemas.js";
import { getCarriersForState } from "../services/carrierRegistry.js";

export const carriersRouter = Router();

carriersRouter.get("/carriers", validate(carriersQuerySchema, "query"), (req, res) => {
  const { state } = req.query as { state: string };
  const code = state.toUpperCase();
  const carriers = getCarriersForState(code);
  if (carriers.length === 0) {
    res.json({
      state: code,
      carriers: [],
      note: `No carrier data registered for "${code}" yet — check back soon.`,
    });
    return;
  }
  res.json({ state: code, carriers });
});
