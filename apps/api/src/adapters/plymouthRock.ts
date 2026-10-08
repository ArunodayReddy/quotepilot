/** Plymouth Rock — competitive mid-range, MA-focused carrier. */
import { makeAdapter } from "./_base.js";

export const plymouthRockAdapter = makeAdapter({
  carrierId: "plymouthRock",
  carrierName: "Plymouth Rock",
  priceFactor: 0.97,
  latencyMinMs: 700,
  latencyMaxMs: 1800,
  caveats: [
    "Illustrative estimate — final rate subject to underwriting review.",
    "MA-focused carrier; local claims service reflected in service ratings, not price.",
    "Pay-in-full and paperless discounts verified at binding.",
  ],
});
