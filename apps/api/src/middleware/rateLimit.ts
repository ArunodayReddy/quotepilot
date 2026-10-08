/**
 * Rate limiting tiers (per IP):
 *  - global:            300 req/min
 *  - POST /api/quote:    10 req/min (expensive: fans out to every carrier)
 *  - POST /api/analytics/event: 120 req/min
 * Breaches return 429 in the shared { error: { code, message, requestId } } shape.
 */
import { rateLimit } from "express-rate-limit";
import type { Request, Response } from "express";

function limiter(max: number, message: string) {
  return rateLimit({
    windowMs: 60_000,
    max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: { code: "RATE_LIMITED", message, requestId: (req as Request & { requestId?: string }).requestId },
      });
    },
  });
}

export const globalLimiter = limiter(300, "Too many requests — slow down.");
export const quoteLimiter = limiter(10, "Too many quote requests — try again in a minute.");
export const analyticsEventLimiter = limiter(120, "Too many analytics events — slow down.");
