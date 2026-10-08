/**
 * Email service — "your quotes are ready" delivery.
 *
 * Two modes:
 *  - SMTP configured (SMTP_HOST set): sends via nodemailer for real.
 *  - Dev mode: logs "email would be sent" with the recipient DOMAIN and jobId
 *    only. Never logs the full recipient address or quote content.
 */
import nodemailer from "nodemailer";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

export interface QuotesReadySummary {
  jobId: string;
  carrierCount: number;
  cheapestCarrierName?: string;
  cheapestPremium6Mo?: number;
}

function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : "unknown";
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!config.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export async function sendQuotesReady(
  email: string,
  summary: QuotesReadySummary,
): Promise<{ sent: boolean; mode: "smtp" | "dev" }> {
  const resultsUrl = `${config.appBaseUrl}/quotes/${summary.jobId}`;
  const subject = "Your QuotePilot quotes are ready";
  const text =
    `Your ${summary.carrierCount} car-insurance quotes are ready.\n` +
    (summary.cheapestPremium6Mo !== undefined
      ? `Lowest 6-month premium: $${summary.cheapestPremium6Mo} (${summary.cheapestCarrierName}).\n`
      : "") +
    `Compare them here: ${resultsUrl}\n\n— QuotePilot`;

  const t = getTransporter();
  if (!t) {
    // Dev mode: structured log with domain + jobId only. No address, no quotes.
    logger.info({
      msg: "email_would_be_sent",
      jobId: summary.jobId,
      recipientDomain: domainOf(email),
      carrierCount: summary.carrierCount,
    });
    return { sent: false, mode: "dev" };
  }

  try {
    await t.sendMail({ from: config.smtp.from, to: email, subject, text });
    logger.info({ msg: "email_sent", jobId: summary.jobId, recipientDomain: domainOf(email) });
    return { sent: true, mode: "smtp" };
  } catch (err) {
    // Email failure must never break the quote job — log and move on.
    logger.error({ msg: "email_send_failed", jobId: summary.jobId, err: (err as Error).message });
    return { sent: false, mode: "smtp" };
  }
}
