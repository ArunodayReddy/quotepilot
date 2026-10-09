import type { Metadata } from "next";
import { siteMetadata } from "../../lib/metadata";
import { Disclosures } from "../../views/Disclosures";

export const metadata: Metadata = siteMetadata({
  title: "Important Disclosures — QuotePilot",
  description:
    "The fine print, made readable: who QuotePilot is, what simulated pricing means, consent choices, and state-specific insurance notes.",
  path: "/disclosures",
});

/** Fully static content — server-rendered. */
export default function DisclosuresPage() {
  return <Disclosures />;
}
