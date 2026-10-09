import type { Metadata } from "next";
import { siteMetadata } from "../lib/metadata";
import { getHomeContent } from "../lib/cms";
import { buildJsonLd, staticFaqs } from "../lib/homeContent";
import { Home } from "../views/Home";

/**
 * Home is an interactive client component (ZIP hero form, carrier marquee,
 * FAQ accordion all need browser state). The page shell — title, meta, OG,
 * and FAQ JSON-LD — plus all page copy is server-rendered from the CMS:
 * content loads here, on page load, and flows into <Home/> as props.
 */
export async function generateMetadata(): Promise<Metadata> {
  const content = getHomeContent();
  return siteMetadata({
    title: content.seo.title,
    description: content.seo.description,
    path: "/",
  });
}

export default function HomePage() {
  const content = getHomeContent();
  const jsonLd = buildJsonLd(staticFaqs(content.faq.items), content.jsonLd.description);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Home content={content} />
    </>
  );
}
