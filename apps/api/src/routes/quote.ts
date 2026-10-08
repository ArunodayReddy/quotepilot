/**
 * POST /api/quote  → 202 { jobId, status:"queued", carrierCount, estimatedSeconds }
 * GET  /api/quotes/:jobId → job status + progress + results
 *
 * The request body is zod-validated and stripped before it reaches the queue;
 * the raw payload (PII) is never logged.
 */
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { quoteLimiter } from "../middleware/rateLimit.js";
import { jobIdParamSchema, quoteRequestSchema, type QuoteRequestInput } from "../lib/schemas.js";
import { createQuoteJob, getQuoteJob } from "../services/jobQueue.js";
import type { QuoteRequest } from "../../../../packages/shared/dist/types.js";

export const quoteRouter = Router();

// Stricter rate limit: each request fans out to every carrier.
quoteRouter.post(
  "/quote",
  quoteLimiter,
  validate(quoteRequestSchema, "body"),
  (req, res) => {
    const input = req.body as QuoteRequestInput;
    const job = createQuoteJob(input as QuoteRequest);
    res.status(202).json({
      jobId: job.jobId,
      status: job.status,
      carrierCount: job.carrierCount,
      estimatedSeconds: job.estimatedSeconds,
    });
  },
);

quoteRouter.get("/quotes/:jobId", validate(jobIdParamSchema, "params"), (req, res) => {
  const { jobId } = req.params as { jobId: string };
  const job = getQuoteJob(jobId);
  if (!job) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: `Unknown job ${jobId}`, requestId: req.requestId },
    });
    return;
  }
  res.json(job);
});
