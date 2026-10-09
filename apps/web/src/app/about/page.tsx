import type { Metadata } from "next";
import { siteMetadata } from "../../lib/metadata";
import { About } from "../../views/About";

export const metadata: Metadata = siteMetadata({
  title: "About QuotePilot — honest simulated quote comparison",
  description:
    "QuotePilot's mission: one form, every carrier, compared side by side. Learn how the demo simulation works, how your data is handled, and what we do for security.",
  path: "/about",
});

/** Fully static content — server-rendered. */
export default function AboutPage() {
  return <About />;
}
