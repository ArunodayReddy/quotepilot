/**
 * Central error handling + 404. Every error response uses the contract shape
 * { error: { code, message, requestId } }. Stack traces never leave the
 * process in production — they go to the structured log instead.
 */
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}`, requestId: req.requestId },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId ?? "unknown";
  if (res.headersSent) return;

  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Malformed JSON body", requestId },
    });
    return;
  }

  const status = typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
    ? err.status
    : 500;
  const message = status === 500 ? "Internal server error" : "Request failed";

  logger.error({
    msg: "unhandled_error",
    requestId,
    method: req.method,
    path: req.path,
    status,
    // Stack stays in the log file; never in the response.
    stack: err instanceof Error ? err.stack : String(err),
  });

  res.status(status).json({ error: { code: "INTERNAL_ERROR", message, requestId } });
}
