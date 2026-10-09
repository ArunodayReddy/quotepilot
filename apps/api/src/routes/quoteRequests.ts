/**
 * POST /api/quote-requests → 201 { refCode, deliveries, message }
 *
 * Agent-mediated "real quotes": the user picks up to 3 licensed agents from
 * the directory and, with explicit TCPA consent, QuotePilot forwards a
 * professional quote request. Agents reply with REAL quotes — this is
 * lead-gen infrastructure, not simulation.
 *
 * Validation: zod body schema (consent must be literally true) → job must
 * exist and be complete → agentIds must be in the directory for the job's
 * state/ZIP. Strictly rate-limited (5/hour/IP): this endpoint can trigger
 * outbound email.
 */
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { quoteRequestLimiter } from "../middleware/rateLimit.js";
import { quoteRequestSubmissionSchema, type QuoteRequestSubmissionInput } from "../lib/schemas.js";
import { SubmitError, submitQuoteRequest } from "../services/quoteRequests.js";
import type { CreateQuoteRequestResponse } from "../../../../packages/shared/dist/types.js";

export const quoteRequestsRouter = Router();

quoteRequestsRouter.post(
  "/quote-requests",
  quoteRequestLimiter,
  validate(quoteRequestSubmissionSchema, "body"),
  async (req, res, next) => {
    try {
      const input = req.body as QuoteRequestSubmissionInput;
      const result: CreateQuoteRequestResponse = await submitQuoteRequest(input);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof SubmitError) {
        res.status(err.status).json({
          error: { code: err.code, message: err.message, requestId: req.requestId },
        });
        return;
      }
      next(err);
    }
  },
);
