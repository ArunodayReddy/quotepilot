import type { Metadata } from "next";
import { siteMetadata } from "../../lib/metadata";
import { Privacy } from "../../views/Privacy";

export const metadata: Metadata = siteMetadata({
  title: "Privacy Policy — QuotePilot",
  description:
    "What QuotePilot collects, why, what we never sell, and the rights you have over your information.",
  path: "/privacy",
});

/** Fully static content — server-rendered. */
export default function PrivacyPage() {
  return <Privacy />;
}
