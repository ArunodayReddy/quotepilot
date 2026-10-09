import type { Metadata } from "next";
import { siteMetadata } from "../../../lib/metadata";
import { Quotes } from "../../../views/Quotes";

export async function generateMetadata({
  params,
}: {
  params: { jobId: string };
}): Promise<Metadata> {
  // The page title is dynamic in the client (it flips when quotes complete),
  // which generateMetadata can't observe — use the "gathering" title.
  return siteMetadata({
    title: "Gathering your quotes… — QuotePilot",
    description:
      "Watch QuotePilot gather car insurance quotes from every carrier in your state, ranked side by side. Simulated demo pricing.",
    path: `/quotes/${params.jobId}`,
  });
}

/** Live job polling, progress, compare, email opt-in — client-rendered. */
export default function QuotesPage({ params }: { params: { jobId: string } }) {
  return <Quotes jobId={params.jobId} />;
}
