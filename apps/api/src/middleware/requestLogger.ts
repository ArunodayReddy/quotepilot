/**
 * Structured request logging: every request emits one JSON line with
 * requestId, method, path, status, durationMs. NEVER log bodies, query
 * values, or headers here — they may carry PII.
 */
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();
  res.on("finish", () => {
    logger.info({
      msg: "request",
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - started,
    });
  });
  next();
}
