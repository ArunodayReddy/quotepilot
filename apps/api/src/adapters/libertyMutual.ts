/** Liberty Mutual — higher base rates with a bundling note. */
import { makeAdapter } from "./_base.js";

export const libertyMutualAdapter = makeAdapter({
  carrierId: "libertyMutual",
  carrierName: "Liberty Mutual",
  priceFactor: 1.12,
  latencyMinMs: 600,
  latencyMaxMs: 1400,
  caveats: [
    "Illustrative estimate — final rate subject to underwriting review.",
    "Bundling home + auto can reduce this premium by up to ~12%; shown unbundled.",
    "RightTrack telematics program available for additional savings.",
  ],
});
