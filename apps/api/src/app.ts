/**
 * Express app factory. Exported separately from index.ts so tests can mount
 * the full middleware + route stack without binding a port.
 *
 * Stack order: security headers → CORS → request id → request logging →
 * global rate limit → JSON parsing → routes → 404 → error handler.
 */
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./lib/config.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { quoteRouter } from "./routes/quote.js";
import { agentsRouter } from "./routes/agents.js";
import { carriersRouter } from "./routes/carriers.js";
import { analyticsRouter } from "./routes/analytics.js";
import { emailRouter } from "./routes/email.js";
import { disclosuresRouter } from "./routes/disclosures.js";

export function createApp(): express.Express {
  const app = express();

  // Behind Render/Railway proxies the client IP arrives via X-Forwarded-For.
  // Trust one proxy hop so express-rate-limit sees real client IPs.
  app.set("trust proxy", 1);

  // Helmet with a strict CSP (API serves JSON only — no inline resources needed).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // JSON API; COEP would only break clients
    }),
  );

  // CORS: local dev origins only. No credentials needed (no cookies).
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || (config.corsOrigins as readonly string[]).includes(origin)) cb(null, true);
        else cb(new Error("CORS origin not allowed"));
      },
    }),
  );

  app.use(requestId);
  app.use(requestLogger);
  app.use(globalLimiter);
  app.use(express.json({ limit: "64kb" })); // tight body cap for a form API

  app.use("/api", healthRouter);
  app.use("/api", quoteRouter);
  app.use("/api", agentsRouter);
  app.use("/api", carriersRouter);
  app.use("/api", analyticsRouter);
  app.use("/api", emailRouter);
  app.use("/api", disclosuresRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
