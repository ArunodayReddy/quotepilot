/**
 * POST /api/email/notify → 202 { ok:true }   body: { jobId, email }
 *
 * If the job already completed, the "quotes are ready" email is sent right
 * away; otherwise the address is parked and the email goes out when the job
 * completes. Dev mode (no SMTP_HOST) logs recipient domain + jobId only.
 */
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { emailNotifySchema } from "../lib/schemas.js";
import { getQuoteJob, requestNotifyOnComplete } from "../services/jobQueue.js";
import { sendQuotesReady } from "../services/emailService.js";
import { logger } from "../lib/logger.js";

export const emailRouter = Router();

emailRouter.post("/email/notify", validate(emailNotifySchema, "body"), async (req, res, next) => {
  try {
    const { jobId, email } = req.body as { jobId: string; email: string };
    const verdict = await requestNotifyOnComplete(jobId, email);

    if (verdict === "not-found") {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: `Unknown job ${jobId}`, requestId: req.requestId },
      });
      return;
    }

    if (verdict === "send-now") {
      const job = await getQuoteJob(jobId);
      const ranked = (job?.results ?? [])
        .filter((r) => r.success && r.premium6Mo !== undefined)
        .sort((a, b) => (a.premium6Mo as number) - (b.premium6Mo as number));
      await sendQuotesReady(email, {
        jobId,
        carrierCount: job?.carrierCount ?? 0,
        cheapestCarrierName: ranked[0]?.carrierName,
        cheapestPremium6Mo: ranked[0]?.premium6Mo,
      });
      logger.info({ msg: "email_notify_sent_on_request", jobId });
    } else {
      logger.info({ msg: "email_notify_parked", jobId });
    }

    res.status(202).json({ ok: true });
  } catch (err) {
    next(err);
  }
});
