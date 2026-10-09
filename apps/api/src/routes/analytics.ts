/**
 * POST /api/analytics/event → 201 { ok:true }
 * GET  /api/analytics/summary → aggregated clicks / funnel / carriers / daily sessions
 *
 * PII policy: the raw sessionId is never stored — only a truncated SHA-256
 * hash. Metadata containing email-like patterns is dropped on write.
 */
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { analyticsEventLimiter } from "../middleware/rateLimit.js";
import { analyticsEventSchema } from "../lib/schemas.js";
import { summary, track } from "../services/analyticsService.js";

export const analyticsRouter = Router();

analyticsRouter.post(
  "/analytics/event",
  analyticsEventLimiter,
  validate(analyticsEventSchema, "body"),
  (req, res) => {
    const body = req.body as {
      event: string;
      page: string;
      element?: string;
      sessionId: string;
      metadata?: Record<string, unknown>;
    };
    track({
      event: body.event,
      page: body.page,
      element: body.element,
      sessionId: body.sessionId,
      metadata: body.metadata,
    });
    res.status(201).json({ ok: true });
  },
);

analyticsRouter.get("/analytics/summary", async (_req, res) => {
  res.json(await summary());
});
