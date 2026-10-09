/* Typed API client for the QuotePilot backend (proxied via vite "/api"). */
import type {
  AgentsResponse,
  ApiErrorBody,
  CarriersResponse,
  QuoteJob,
  QuoteJobCreated,
  QuoteRequest,
  StateDisclosures,
} from "./types";

export class ApiError extends Error {
  code: string;
  requestId: string | null;
  status: number;

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    super(body?.error.message ?? fallback);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error.code ?? "UNKNOWN";
    this.requestId = body?.error.requestId ?? null;
  }
}

/**
 * API base URL. In dev this is empty so requests hit the "/api" rewrite
 * (proxied to the local Express API by next.config.js).
 * In production set NEXT_PUBLIC_API_URL to the deployed API origin, e.g.
 * https://quotepilot-api.onrender.com — requests then go direct (CORS).
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    throw new ApiError(res.status, body as ApiErrorBody | null, `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  health(): Promise<{ status: string; version: string }> {
    return request("/api/health");
  },
  createQuoteJob(payload: QuoteRequest): Promise<QuoteJobCreated> {
    return request("/api/quote", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getQuoteJob(jobId: string): Promise<QuoteJob> {
    return request(`/api/quotes/${encodeURIComponent(jobId)}`);
  },
  getAgents(state: string, zip?: string): Promise<AgentsResponse> {
    const params = new URLSearchParams({ state });
    if (zip) params.set("zip", zip);
    return request(`/api/agents?${params.toString()}`);
  },
  getCarriers(state: string): Promise<CarriersResponse> {
    const params = new URLSearchParams({ state });
    return request(`/api/carriers?${params.toString()}`);
  },
  notifyEmail(jobId: string, email: string): Promise<{ ok: boolean }> {
    return request("/api/email/notify", {
      method: "POST",
      body: JSON.stringify({ jobId, email }),
    });
  },
  getDisclosures(state: string): Promise<StateDisclosures> {
    return request(`/api/disclosures/${encodeURIComponent(state.toUpperCase())}`);
  },
};
