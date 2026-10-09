import type { Metadata } from "next";
import { siteMetadata } from "../../lib/metadata";
import { Terms } from "../../views/Terms";

export const metadata: Metadata = siteMetadata({
  title: "Terms of Service — QuotePilot",
  description:
    "QuotePilot's terms: what the demo does and doesn't do, estimates vs. real offers, and how to use the site fairly.",
  path: "/terms",
});

/** Fully static content — server-rendered. */
export default function TermsPage() {
  return <Terms />;
}
