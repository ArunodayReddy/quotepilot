/**
 * Adapter factory. Every carrier adapter is a personality definition +
 * this shared runner, so the QuoteAdapter interface never needs to change
 * when real carrier APIs land — only the internals of quote() do.
 */
import type { QuoteAdapter, QuoteRequest, QuoteContext, QuoteResult } from "../../../../packages/shared/dist/types.js";
import { coverageMatchPct, pricePremium6Mo, simulatedLatencyMs, sleep, type CarrierPersonality } from "../lib/pricing.js";

export function makeAdapter(personality: CarrierPersonality): QuoteAdapter {
  return {
    carrierId: personality.carrierId,
    carrierName: personality.carrierName,
    async quote(request: QuoteRequest, ctx: QuoteContext): Promise<QuoteResult> {
      const started = Date.now();
      // Honor the caller's timeout ceiling even in simulation.
      const waitMs = Math.min(simulatedLatencyMs(request, personality), Math.max(0, ctx.timeoutMs));
      await sleep(waitMs);
      const premium6Mo = pricePremium6Mo(request, personality);
      return {
        carrierId: personality.carrierId,
        carrierName: personality.carrierName,
        success: true,
        premium6Mo,
        monthlyEquivalent: Math.round((premium6Mo / 6) * 100) / 100,
        currency: "USD",
        simulated: true,
        latencyMs: Date.now() - started,
        coverageMatchPct: coverageMatchPct(request, personality),
        caveats: [...personality.caveats],
        quotedAt: new Date().toISOString(),
      };
    },
  };
}
