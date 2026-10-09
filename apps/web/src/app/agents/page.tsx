import type { Metadata } from "next";
import { Suspense } from "react";
import { siteMetadata } from "../../lib/metadata";
import { Agents } from "../../views/Agents";

export const metadata: Metadata = siteMetadata({
  title: "Local insurance agents near you — QuotePilot",
  description:
    "Find local independent insurance agents near your ZIP — map, distance, addresses, phone numbers, open hours, carriers, and languages.",
  path: "/agents",
});

/**
 * Interactive search + Leaflet map — client-rendered. The Suspense boundary
 * is required: next/navigation's useSearchParams needs one at build time.
 */
export default function AgentsPage() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <div className="container">
            <p>Loading agent search…</p>
          </div>
        </div>
      }
    >
      <Agents />
    </Suspense>
  );
}
