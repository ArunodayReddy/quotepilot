import type { Metadata } from "next";
import Link from "next/link";
import { siteMetadata } from "../lib/metadata";

export const metadata: Metadata = siteMetadata({
  title: "Page not found — QuotePilot",
  description: "That page doesn't exist. Head back home or start a quote.",
  path: "/404",
});

export default function NotFound() {
  return (
    <div className="page">
      <div className="container">
        <div className="empty-state glass">
          <h1>Lost? Let&apos;s get you back on the road.</h1>
          <p>That page doesn&apos;t exist.</p>
          <Link href="/" className="btn btn-primary">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
