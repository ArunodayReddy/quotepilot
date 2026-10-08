/** Amica — premium pricing, top-tier service reputation. */
import { makeAdapter } from "./_base.js";

export const amicaAdapter = makeAdapter({
  carrierId: "amica",
  carrierName: "Amica",
  priceFactor: 1.18,
  latencyMinMs: 1200,
  latencyMaxMs: 2500,
  caveats: [
    "Illustrative estimate — final rate subject to underwriting review.",
    "Premium reflects Amica's consistently top-ranked claims satisfaction, not a coverage gap.",
    "Dividend policies may return a portion of premium at year end.",
  ],
});
