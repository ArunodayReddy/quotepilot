/* Shared Next.js metadata builder — replaces the old react-helmet-async <Seo />. */
import type { Metadata } from "next";

const SITE_NAME = "QuotePilot";
/** Placeholder canonical base (matches the old Seo component). Swap for the
 *  production domain at deploy time. */
export const CANONICAL_BASE = "https://quotepilot.example.com";

export function siteMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const canonical = `${CANONICAL_BASE}${path}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
