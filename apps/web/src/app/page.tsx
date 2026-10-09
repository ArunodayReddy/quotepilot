import type { Metadata } from "next";
import { siteMetadata } from "../lib/metadata";
import { buildJsonLd, staticFaqs } from "../lib/homeContent";
import { Home } from "../views/Home";

export const metadata: Metadata = siteMetadata({
  title: "QuotePilot — One form. Every carrier. Compare side by side.",
  description:
    "QuotePilot gathers car insurance quotes from every relevant carrier in your state with one short form. Compare ranked quotes on the site and by email. Demo build with simulated pricing.",
  path: "/",
});

/**
 * Home is an interactive client component (ZIP hero form, carrier marquee,
 * FAQ accordion all need browser state). The page shell — title, meta, OG,
 * and FAQ JSON-LD — is server-rendered for SEO.
 */
export default function HomePage() {
  const jsonLd = buildJsonLd(staticFaqs());
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Home />
    </>
  );
}
