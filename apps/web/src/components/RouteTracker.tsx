"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { fireAnalytics } from "../lib/analytics";

/**
 * Fires a page_view analytics event on every client-side route change and
 * moves focus to the top of the page (a11y). Replaces the react-router
 * PageViewTracker + Layout focus effect from the Vite build.
 */
export function RouteTracker() {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    fireAnalytics("page_view", { page: pathname });
    const main = document.getElementById("main-content");
    main?.setAttribute("tabindex", "-1");
    main?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
    return () => {
      main?.removeAttribute("tabindex");
    };
  }, [pathname]);

  return null;
}
