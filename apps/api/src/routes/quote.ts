/**
 * POST /api/quote  → 202 { jobId, status:"queued", carrierCount, estimatedSeconds, cached:false }
 *                  → 200 { jobId, status:"complete", results, cached:true } on cache hit
 * GET  /api/quotes/:jobId → job status + progress + results (+ cached flag)
 *
 * The request body is zod-validated and stripped before it reaches the queue;
 * the raw payload (PII) is never logged. Identical rating factors hit the
 * quote-result cache (keyed by SHA-256 of rating factors only — never PII).
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
  async (req, res, next) => {
    try {
      const input = req.body as QuoteRequestInput;
      const job = await createQuoteJob(input as QuoteRequest);
      if (job.cached) {
        // Terminal response: results are inline, no polling needed.
        res.status(200).json(job);
        return;
      }
      res.status(202).json({
        jobId: job.jobId,
        status: job.status,
        carrierCount: job.carrierCount,
        estimatedSeconds: job.estimatedSeconds,
        cached: false,
      });
    } catch (err) {
      next(err);
    }
  },
);

quoteRouter.get("/quotes/:jobId", validate(jobIdParamSchema, "params"), async (req, res, next) => {
  try {
    const { jobId } = req.params as { jobId: string };
    const job = await getQuoteJob(jobId);
    if (!job) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: `Unknown job ${jobId}`, requestId: req.requestId },
      });
      return;
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
});
