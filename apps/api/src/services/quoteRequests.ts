/**
 * Agent-mediated quote requests (v0.11.0 "Real quotes") — orchestration.
 *
 * The real working model while carrier APIs don't exist: the user submits
 * once; licensed local agents receive a professional quote request and reply
 * with REAL quotes. This is lead-gen infrastructure, not simulation.
 *
 * Delivery provider chain per agent (honest about what's real):
 *   1. Agent record carries a verified email → professional request email via
 *      the email service (SMTP when configured, dev-log otherwise).
 *   2. Otherwise (the common case — Places and sample data carry no agent
 *      emails) → "handoff": no fake email is sent; the response carries a
 *      tap-to-call card so the user reaches the agency themselves.
 *
 * The profile summary in the agent email is built SERVER-SIDE from the stored
 * quote job — the client is never trusted to describe the profile.
 */
import type {
  AgentWithDistance,
  CreateQuoteRequestInput,
  CreateQuoteRequestResponse,
  QuoteRequestDelivery,
} from "../../../../packages/shared/dist/types.js";
import { logger } from "../lib/logger.js";
import { sha256Hex } from "../lib/hash.js";
import { getJobQueue } from "./queue.js";
import { lookupAgents } from "./agentDirectory.js";
import { saveQuoteRequest } from "./quoteRequestStore.js";
import { sendAgentQuoteRequest, sendQuoteRequestReceipt } from "./quoteRequestEmail.js";
import { track } from "./analyticsService.js";

export type SubmitErrorCode = "JOB_NOT_FOUND" | "JOB_NOT_COMPLETE" | "UNKNOWN_AGENTS";

export class SubmitError extends Error {
  constructor(
    readonly code: SubmitErrorCode,
    readonly status: number,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

/** An agent email counts as "verified" when it looks like a real address.
 *  Places and sample data never carry one today — so the handoff path is the
 *  live path until an agent-portal/claim flow captures real agency emails. */
function verifiedAgentEmail(agent: AgentWithDistance): string | null {
  const raw = (agent as unknown as { email?: unknown }).email;
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

export async function submitQuoteRequest(
  input: CreateQuoteRequestInput,
): Promise<CreateQuoteRequestResponse> {
  const queue = await getJobQueue();

  const job = await queue.getJob(input.jobId);
  if (!job) {
    throw new SubmitError("JOB_NOT_FOUND", 404, `Unknown job ${input.jobId}`);
  }
  if (job.status !== "complete") {
    throw new SubmitError(
      "JOB_NOT_COMPLETE",
      422,
      "Quote requests can only be sent once the quote job has completed.",
    );
  }
  const request = await queue.getJobRequest(input.jobId);
  if (!request) {
    throw new SubmitError("JOB_NOT_FOUND", 404, `Unknown job ${input.jobId}`);
  }

  // Validate agentIds against the same directory the UI rendered.
  const directory = await lookupAgents(request.contact.state, request.contact.zip);
  const byId = new Map(directory.agents.map((a) => [a.id, a]));
  const unknown = input.agentIds.filter((id) => !byId.has(id));
  if (unknown.length > 0) {
    throw new SubmitError("UNKNOWN_AGENTS", 422, "One or more selected agents are not in the directory.", {
      unknown,
    });
  }

  // Delivery chain per agent.
  const deliveries: QuoteRequestDelivery[] = [];
  for (const agentId of input.agentIds) {
    const agent = byId.get(agentId) as AgentWithDistance;
    const email = verifiedAgentEmail(agent);
    if (email) {
      deliveries.push({ agentId, agentName: agent.name, method: "emailed" });
    } else {
      deliveries.push({
        agentId,
        agentName: agent.name,
        method: "handoff",
        handoffCard: { phone: agent.phone, address: agent.address, city: agent.city, zip: agent.zip },
      });
    }
  }

  // Persist first (ref code is the user's handle for follow-ups), then send.
  const record = saveQuoteRequest(input, deliveries);

  // Email the agents that have a verified address. A send failure must not
  // fail the whole request — the record is already saved and the user gets
  // their receipt either way.
  for (const d of deliveries) {
    if (d.method !== "emailed") continue;
    const agent = byId.get(d.agentId) as AgentWithDistance;
    const email = verifiedAgentEmail(agent);
    if (!email) continue;
    try {
      await sendAgentQuoteRequest(email, agent.name, record.refCode, request, input.contact);
    } catch (err) {
      logger.error({
        msg: "agent_quote_request_failed",
        refCode: record.refCode,
        agentId: d.agentId,
        reason: (err as Error).message,
      });
    }
  }

  // Receipt to the shopper (dev-log mode until SMTP is configured).
  try {
    await sendQuoteRequestReceipt(input.contact, record.refCode, deliveries);
  } catch (err) {
    logger.error({ msg: "quote_request_receipt_failed", refCode: record.refCode, reason: (err as Error).message });
  }

  // Analytics: delivery mix only — no PII, no contact fields.
  track({
    event: "quote_request_submitted",
    page: "/quotes",
    sessionId: record.refCode,
    metadata: {
      agentCount: deliveries.length,
      emailedCount: deliveries.filter((d) => d.method === "emailed").length,
      handoffCount: deliveries.filter((d) => d.method === "handoff").length,
      state: request.contact.state,
    },
  });

  logger.info({
    msg: "quote_request_submitted",
    refCode: record.refCode,
    jobId: input.jobId,
    agentCount: deliveries.length,
    deliveryMix: deliveries.map((d) => d.method).join(","),
    agentSource: directory.source,
    phoneHash: sha256Hex(input.contact.phone).slice(0, 12),
  });

  const emailedCount = deliveries.filter((d) => d.method === "emailed").length;
  return {
    refCode: record.refCode,
    deliveries,
    message:
      emailedCount > 0
        ? `Request sent to ${emailedCount} ${emailedCount === 1 ? "agency" : "agencies"}. Mention ref ${record.refCode} if they call.`
        : `Your reference is ${record.refCode}. Call the ${deliveries.length === 1 ? "agency" : "agencies"} below and mention it — they'll quote you for real.`,
  };
}
