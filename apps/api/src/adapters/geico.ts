/** GEICO — lowest-ish, aggressive pricing personality for clean records. */
import { makeAdapter } from "./_base.js";

export const geicoAdapter = makeAdapter({
  carrierId: "geico",
  carrierName: "GEICO",
  priceFactor: 0.93,
  latencyMinMs: 300,
  latencyMaxMs: 900,
  caveats: [
    "Illustrative estimate — final rate subject to underwriting review.",
    "Additional savings may apply through the DriveEasy telematics program.",
    "Multi-policy and good-driver discounts verified at binding.",
  ],
});
