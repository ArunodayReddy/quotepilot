import { Router } from "express";
import { config } from "../lib/config.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", version: config.version });
});
