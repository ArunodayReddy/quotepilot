"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../lib/theme";
import { fireAnalytics } from "../lib/analytics";
import type { SiteContent } from "../lib/cms";

function navClass(pathname: string, href: string, exact = false) {
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return active ? "nav-link active" : "nav-link";
}

export function Header({
  content,
  brand,
}: {
  content: SiteContent["header"];
  brand: SiteContent["brand"];
}) {
  const { theme, toggle } = useTheme();
  const pathname = usePathname() ?? "/";
  const toggleLabel = theme === "dark" ? content.themeToggle.toLight : content.themeToggle.toDark;

  return (
    <header className="site-header">
      <div className="container">
        <Link href={brand.homeHref} className="brand" aria-label={brand.homeAriaLabel}>
          <span className="brand-mark" aria-hidden="true">
            {brand.mark}
          </span>
          {brand.name}
        </Link>
        <nav aria-label="Primary" className="nav-links">
          {content.nav.map((link) => (
            <Link key={link.href} href={link.href} className={navClass(pathname, link.href, link.exact)}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => {
              toggle();
              fireAnalytics("cta_clicked", { page: "global", element: "theme_toggle" });
            }}
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
          </button>
          <Link href={content.cta.href} className="btn btn-primary">
            {content.cta.label}
          </Link>
        </div>
      </div>
    </header>
  );
}
