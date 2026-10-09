import type { Metadata } from "next";
import { siteMetadata } from "../../lib/metadata";
import { Wizard } from "../../views/Wizard";

export const metadata: Metadata = siteMetadata({
  title: "Get car insurance quotes — QuotePilot",
  description:
    "Answer a few quick questions and QuotePilot gathers car insurance quotes from every carrier in your state. Simulated demo pricing, delivered by email.",
  path: "/quote",
});

/** The wizard is fully interactive (multi-step state, localStorage resume,
 *  validation) — client-rendered. Metadata is server-rendered for SEO. */
export default function QuotePage() {
  return <Wizard />;
}
