"use client";

import Link from "next/link";
import { fireAnalytics } from "../lib/analytics";

/**
 * A next/link that fires an analytics event on click. Lets server-rendered
 * content pages (e.g. About) track CTAs without becoming client components.
 */
export function TrackedCta({
  href,
  className,
  event,
  element,
  page,
  children,
}: {
  href: string;
  className?: string;
  event: "cta_clicked";
  element: string;
  page: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => fireAnalytics(event, { page, element })}
    >
      {children}
    </Link>
  );
}
