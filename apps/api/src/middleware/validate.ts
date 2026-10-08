/**
 * Zod validation middleware for body / query / params.
 * On failure: 400 { error: { code: "VALIDATION_ERROR", message, requestId } }.
 */
import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

type Target = "body" | "query" | "params";

export function validate<T>(schema: ZodSchema<T>, target: Target = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join(".") || target}: ${i.message}`)
        .join("; ");
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message, requestId: req.requestId },
      });
      return;
    }
    // Parsed (stripped) data replaces the raw input — unknown keys never propagate.
    (req as unknown as Record<Target, unknown>)[target] = result.data;
    next();
  };
}
