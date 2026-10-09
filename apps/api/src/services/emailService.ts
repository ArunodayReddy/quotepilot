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

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  /** Extra PII-free fields merged into the structured log line. */
  logContext?: Record<string, unknown>;
}

/**
 * Shared send core: SMTP when configured, dev-log otherwise.
 * Logs carry the recipient DOMAIN only — never the full address or body.
 * A send failure never throws: it logs and reports { sent: false }.
 */
export async function sendMail(input: SendMailInput): Promise<{ sent: boolean; mode: "smtp" | "dev" }> {
  const t = getTransporter();
  if (!t) {
    logger.info({ msg: "email_would_be_sent", recipientDomain: domainOf(input.to), ...input.logContext });
    return { sent: false, mode: "dev" };
  }
  try {
    await t.sendMail({ from: config.smtp.from, to: input.to, subject: input.subject, text: input.text });
    logger.info({ msg: "email_sent", recipientDomain: domainOf(input.to), ...input.logContext });
    return { sent: true, mode: "smtp" };
  } catch (err) {
    logger.error({ msg: "email_send_failed", reason: (err as Error).message, ...input.logContext });
    return { sent: false, mode: "smtp" };
  }
}

export async function sendQuotesReady(
  email: string,
  summary: QuotesReadySummary,
): Promise<{ sent: boolean; mode: "smtp" | "dev" }> {
  const resultsUrl = `${config.appBaseUrl}/quotes/${summary.jobId}`;
  const subject = "Your QuotePilot quotes are ready";
  // CAN-SPAM posture: accurate headers (from config), non-deceptive subject,
  // postal address + opt-out in every send. Quote emails are user-requested,
  // but the checklist is enforced anyway (see docs/COMPLIANCE.md §4).
  const postal = config.senderPostalAddress || "[configure SENDER_POSTAL_ADDRESS]";
  const footer =
    `\n\n— QuotePilot\n` +
    `${postal}\n` +
    `This email was requested by you. Reply STOP to stop these emails.`;
  const text =
    `Your ${summary.carrierCount} car-insurance quotes are ready.\n` +
    (summary.cheapestPremium6Mo !== undefined
      ? `Lowest 6-month premium: $${summary.cheapestPremium6Mo} (${summary.cheapestCarrierName}).\n`
      : "") +
    `Compare them here: ${resultsUrl}` +
    footer;

  // A send failure must never break the quote job — sendMail logs and reports.
  return sendMail({
    to: email,
    subject,
    text,
    logContext: { kind: "quotes_ready", jobId: summary.jobId, carrierCount: summary.carrierCount },
  });
}
