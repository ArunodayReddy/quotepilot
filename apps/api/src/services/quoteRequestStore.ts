/**
 * Quote-request store — persisted lead records for the agent-mediated
 * "real quotes" flow (v0.11.0).
 *
 * Lives in the same SQLite store as analytics (apps/api/data/analytics.db,
 * gitignored; ":memory:" in tests) via analyticsService.getDb(). A Postgres
 * migration for this table is future work — noted in docs/releases/0.11.0.md.
 *
 * PII policy: the contact record IS stored (the business needs it to forward
 * the request to agents — that is the consented purpose). It is NEVER logged;
 * logs carry only the ref code and a truncated hash of the phone.
 */
import { randomUUID } from "node:crypto";
import { getDb } from "./analyticsService.js";
import { sha256Hex } from "../lib/hash.js";
import { logger } from "../lib/logger.js";
import type {
  CreateQuoteRequestInput,
  QuoteRequestDelivery,
  QuoteRequestRecord,
} from "../../../../packages/shared/dist/types.js";

/** Uppercase alphanumerics minus ambiguous chars (0/O, 1/I/L). */
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function ensureTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS quote_requests (
      id TEXT PRIMARY KEY,
      ref_code TEXT NOT NULL UNIQUE,
      job_id TEXT NOT NULL,
      agent_ids TEXT NOT NULL,
      contact_json TEXT NOT NULL,
      deliveries_json TEXT NOT NULL,
      consent_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_quote_requests_ref ON quote_requests(ref_code);
    CREATE INDEX IF NOT EXISTS idx_quote_requests_job ON quote_requests(job_id);
  `);
}

export function generateRefCode(random: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += REF_ALPHABET[random(REF_ALPHABET.length)];
  return `QP-${code}`;
}

function rowToRecord(row: {
  id: string;
  ref_code: string;
  job_id: string;
  agent_ids: string;
  contact_json: string;
  deliveries_json: string;
  consent_at: string;
  created_at: string;
}): QuoteRequestRecord {
  return {
    id: row.id,
    refCode: row.ref_code,
    jobId: row.job_id,
    agentIds: JSON.parse(row.agent_ids) as string[],
    contact: JSON.parse(row.contact_json) as QuoteRequestRecord["contact"],
    deliveries: JSON.parse(row.deliveries_json) as QuoteRequestDelivery[],
    consentAt: row.consent_at,
    createdAt: row.created_at,
  };
}

export function saveQuoteRequest(
  input: CreateQuoteRequestInput,
  deliveries: QuoteRequestDelivery[],
): QuoteRequestRecord {
  ensureTable();
  const now = new Date().toISOString();
  const record: QuoteRequestRecord = {
    id: randomUUID(),
    refCode: generateRefCode(),
    jobId: input.jobId,
    agentIds: input.agentIds,
    contact: input.contact,
    deliveries,
    consentAt: now,
    createdAt: now,
  };
  getDb()
    .prepare(
      `INSERT INTO quote_requests
         (id, ref_code, job_id, agent_ids, contact_json, deliveries_json, consent_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      record.id,
      record.refCode,
      record.jobId,
      JSON.stringify(record.agentIds),
      JSON.stringify(record.contact),
      JSON.stringify(record.deliveries),
      record.consentAt,
      record.createdAt,
    );
  // PII-safe log: ref code + phone hash only. Never raw email/phone/name.
  logger.info({
    msg: "quote_request_saved",
    refCode: record.refCode,
    jobId: record.jobId,
    agentCount: record.agentIds.length,
    deliveryMix: deliveries.map((d) => d.method).join(","),
    phoneHash: sha256Hex(record.contact.phone).slice(0, 12),
  });
  return record;
}

export function getQuoteRequestByRef(refCode: string): QuoteRequestRecord | undefined {
  ensureTable();
  const row = getDb().prepare("SELECT * FROM quote_requests WHERE ref_code = ?").get(refCode) as
    | Parameters<typeof rowToRecord>[0]
    | undefined;
  return row ? rowToRecord(row) : undefined;
}
