/** Progressive — mid-range with a telematics caveat (Snapshot). */
import { makeAdapter } from "./_base.js";

export const progressiveAdapter = makeAdapter({
  carrierId: "progressive",
  carrierName: "Progressive",
  priceFactor: 1.02,
  latencyMinMs: 500,
  latencyMaxMs: 1200,
  caveats: [
    "Illustrative estimate — final rate subject to underwriting review.",
    "Snapshot telematics enrollment can lower this rate after a monitoring period; quoted rate shown pre-Snapshot.",
    "Rate reflects standard multi-car household assumptions.",
  ],
});
