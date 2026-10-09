import { Router } from "express";
import { config } from "../lib/config.js";
import { jobQueueKind } from "../services/queue.js";
import { analyticsSinkKind } from "../services/analyticsSink.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res, next) => {
  try {
    // Backend selection is observable so deploy dashboards and the
    // scaling runbook can verify which infrastructure is actually live.
    const [queue, analytics] = await Promise.all([jobQueueKind(), analyticsSinkKind()]);
    res.json({
      status: "ok",
      version: config.version,
      queue,
      analytics,
      cache: config.redisUrl ? "redis" : "memory",
      rateLimitStore: config.redisUrl ? "redis" : "memory",
    });
  } catch (err) {
    next(err);
  }
});
