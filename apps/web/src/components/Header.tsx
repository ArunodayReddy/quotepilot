"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../lib/theme";
import { fireAnalytics } from "../lib/analytics";

function navClass(pathname: string, href: string, exact = false) {
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return active ? "nav-link active" : "nav-link";
}

export function Header() {
  const { theme, toggle } = useTheme();
  const pathname = usePathname() ?? "/";

  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand" aria-label="QuotePilot home">
          <span className="brand-mark" aria-hidden="true">Q</span>
          QuotePilot
        </Link>
        <nav aria-label="Primary" className="nav-links">
          <Link href="/" className={navClass(pathname, "/", true)}>
            Home
          </Link>
          <Link href="/quote" className={navClass(pathname, "/quote")}>
            Get quotes
          </Link>
          <Link href="/agents" className={navClass(pathname, "/agents")}>
            Agents
          </Link>
          <Link href="/about" className={navClass(pathname, "/about")}>
            About
          </Link>
        </nav>
        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => {
              toggle();
              fireAnalytics("cta_clicked", { page: "global", element: "theme_toggle" });
            }}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
          </button>
          <Link href="/quote" className="btn btn-primary">
            Get my quotes
          </Link>
        </div>
      </div>
    </header>
  );
}
