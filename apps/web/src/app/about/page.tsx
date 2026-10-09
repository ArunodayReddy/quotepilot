import type { Metadata } from "next";
import { siteMetadata } from "../../lib/metadata";
import { getAboutContent } from "../../lib/cms";
import { About } from "../../views/About";

/** Fully static content — server-rendered from the CMS on page load. */
export async function generateMetadata(): Promise<Metadata> {
  const content = getAboutContent();
  return siteMetadata({
    title: content.seo.title,
    description: content.seo.description,
    path: "/about",
  });
}

export default function AboutPage() {
  const content = getAboutContent();
  return <About content={content} />;
}
