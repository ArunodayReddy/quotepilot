/** Allstate — the anchor carrier: ≈$1,347/6mo for the sample MA profile. */
import { makeAdapter } from "./_base.js";

export const allstateAdapter = makeAdapter({
  carrierId: "allstate",
  carrierName: "Allstate",
  priceFactor: 1.0,
  latencyMinMs: 400,
  latencyMaxMs: 900,
  caveats: [
    "Illustrative estimate — final rate subject to underwriting review.",
    "Anchored to an actual October 2026 Allstate MA quote for this coverage profile.",
    "Drivewise telematics and bundling discounts may reduce the final premium.",
  ],
});
