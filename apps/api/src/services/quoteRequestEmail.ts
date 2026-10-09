/**
 * Agent-mediated quote requests (v0.11.0 "Real quotes").
 *
 * While carrier APIs don't exist, the real working model is agent-mediated:
 * the user submits once and licensed local agents reply with REAL quotes.
 * These functions send the professional request to an agent and the receipt
 * to the user. Same two modes as sendQuotesReady: SMTP when configured,
 * dev-log otherwise (recipient domain only in logs — never PII).
 */
import type {
  QuoteRequest,
  QuoteRequestContact,
  QuoteRequestDelivery,
} from "../../../../packages/shared/dist/types.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { sendMail } from "./emailService.js";

/** Coarsen exact ages into bands — agents price on bands, and exact DOBs
 *  never need to leave our system in a lead email. */
function ageBand(age: number): string {
  if (age < 25) return "under 25";
  if (age < 30) return "25–29";
  if (age < 40) return "30–39";
  if (age < 50) return "40–49";
  if (age < 60) return "50–59";
  return "60+";
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Structured profile summary for the agent email. Built server-side from
 *  the stored quote job — the client is never trusted to describe the profile. */
export function buildAgentRequestBody(
  refCode: string,
  request: QuoteRequest,
  contact: QuoteRequestContact,
): { subject: string; text: string } {
  const driverLines = request.drivers.map((d, i) => {
    const incidents = [
      d.accidentsLast5Years > 0 ? `${d.accidentsLast5Years} accident(s)/5y` : null,
      d.violationsLast3Years > 0 ? `${d.violationsLast3Years} violation(s)/3y` : null,
    ].filter(Boolean);
    return (
      `  ${i + 1}. Age band ${ageBand(d.age)}, licensed ${d.yearsLicensed}y` +
      (incidents.length ? `, ${incidents.join(", ")}` : ", clean record")
    );
  });
  const vehicleLines = request.vehicles.map(
    (v, i) =>
      `  ${i + 1}. ${v.year} ${v.make} ${v.model} — ${v.ownership}, ${v.usage}, ${v.annualMileage.toLocaleString()} mi/yr`,
  );
  const c = request.coverage;
  const subject =
    `New quote request ${refCode} — ${request.drivers.length} driver(s), ` +
    `${request.vehicles.length} vehicle(s), ${request.contact.zip}`;
  const text =
    `Hello,\n\n` +
    `A shopper on QuotePilot asked your agency for a real auto-insurance quote.\n` +
    `Please reply directly to them — your reply goes to the shopper, not to us.\n\n` +
    `REFERENCE: ${refCode}\n\n` +
    `SHOPPER\n` +
    `  Name:  ${contact.name}\n` +
    `  Email: ${contact.email}\n` +
    `  Phone: ${contact.phone}\n` +
    `  ZIP:   ${request.contact.zip} (${request.contact.state})\n\n` +
    `DRIVERS (${request.drivers.length})\n${driverLines.join("\n")}\n\n` +
    `VEHICLES (${request.vehicles.length})\n${vehicleLines.join("\n")}\n\n` +
    `REQUESTED COVERAGE\n` +
    `  Bodily injury: ${fmtMoney(c.bodilyInjuryPerPerson)}/${fmtMoney(c.bodilyInjuryPerAccident)}\n` +
    `  Property damage: ${fmtMoney(c.propertyDamage)}\n` +
    `  Uninsured motorist: ${fmtMoney(c.uninsuredMotoristPerPerson)}/${fmtMoney(c.uninsuredMotoristPerAccident)}\n` +
    `  Medical payments: ${fmtMoney(c.medicalPayments)}\n` +
    `  Deductibles: ${fmtMoney(c.collisionDeductible)} collision / ${fmtMoney(c.comprehensiveDeductible)} comprehensive\n` +
    (c.rentalReimbursement ? `  + Rental reimbursement\n` : ``) +
    (c.roadsideAssistance ? `  + Roadside assistance\n` : ``) +
    `\nThe shopper consented to be contacted by your agency about this request.\n` +
    `QuotePilot is a comparison service, not an insurer or licensed producer.\n\n` +
    `— QuotePilot lead delivery\n` +
    `${config.senderPostalAddress || "[configure SENDER_POSTAL_ADDRESS]"}`;
  return { subject, text };
}

/**
 * Email one agent their quote request. Returns the delivery outcome.
 * Agent emails are rare in practice (Places/sample data has no agent emails) —
 * the caller falls back to a handoff card when no verified email exists.
 */
export async function sendAgentQuoteRequest(
  agentEmail: string,
  agentName: string,
  refCode: string,
  request: QuoteRequest,
  contact: QuoteRequestContact,
): Promise<{ sent: boolean; mode: "smtp" | "dev" }> {
  const { subject, text } = buildAgentRequestBody(refCode, request, contact);
  return sendMail({
    to: agentEmail,
    subject,
    text,
    logContext: { kind: "agent_quote_request", refCode, agentName },
  });
}

/** Confirmation receipt to the shopper. Honest copy: the AGENTS quote, not us. */
export async function sendQuoteRequestReceipt(
  contact: QuoteRequestContact,
  refCode: string,
  deliveries: QuoteRequestDelivery[],
): Promise<{ sent: boolean; mode: "smtp" | "dev" }> {
  const emailed = deliveries.filter((d) => d.method === "emailed");
  const handoff = deliveries.filter((d) => d.method === "handoff");
  const lines = [
    `Hi ${contact.name.split(" ")[0] || "there"},`,
    ``,
    `Your request is on its way. Reference code: ${refCode} — mention it if an agency calls you.`,
    ``,
  ];
  for (const d of emailed) {
    lines.push(`✓ Request emailed to ${d.agentName} — they'll reply with a real quote.`);
  }
  for (const d of handoff) {
    const card = d.handoffCard;
    lines.push(
      `→ ${d.agentName}: we don't have a verified email for this agency yet, so call them ` +
        `at ${card?.phone ?? "their listed number"} and mention ref ${refCode}.`,
    );
  }
  lines.push(
    ``,
    `Agencies typically respond within one business day. These will be real quotes from licensed agents — not estimates.`,
    ``,
    `— QuotePilot`,
    `${config.senderPostalAddress || "[configure SENDER_POSTAL_ADDRESS]"}`,
    `This email was requested by you. Reply STOP to stop these emails.`,
  );
  return sendMail({
    to: contact.email,
    subject: `Your quote request ${refCode} is on its way`,
    text: lines.join("\n"),
    logContext: { kind: "quote_request_receipt", refCode },
  });
}
