import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTheme } from "../lib/theme";
import { fireAnalytics, openCookieSettings } from "../lib/analytics";
import { CookieBanner } from "./CookieBanner";

function Header() {
  const { theme, toggle } = useTheme();

  return (
    <header className="site-header">
      <div className="container">
        <NavLink to="/" className="brand" aria-label="QuotePilot home">
          <span className="brand-mark" aria-hidden="true">Q</span>
          QuotePilot
        </NavLink>
        <nav aria-label="Primary" className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Home
          </NavLink>
          <NavLink to="/quote" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Get quotes
          </NavLink>
          <NavLink to="/agents" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Agents
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            About
          </NavLink>
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
          <NavLink to="/quote" className="btn btn-primary">
            Get my quotes
          </NavLink>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <h4>QuotePilot</h4>
            <p>One form. Compare carriers side by side. Demo experience with simulated pricing.</p>
          </div>
          <nav aria-label="Footer">
            <h4>Explore</h4>
            <ul>
              <li><NavLink to="/">Home</NavLink></li>
              <li><NavLink to="/quote">Get quotes</NavLink></li>
              <li><NavLink to="/agents">Local agents</NavLink></li>
              <li><NavLink to="/about">About</NavLink></li>
            </ul>
          </nav>
          <nav aria-label="Legal">
            <h4>Legal</h4>
            <ul>
              <li><NavLink to="/terms">Terms of Service</NavLink></li>
              <li><NavLink to="/privacy">Privacy Policy</NavLink></li>
              <li><NavLink to="/disclosures">Important Disclosures</NavLink></li>
            </ul>
          </nav>
          <div>
            <h4>Honest pricing</h4>
            <ul>
              <li>All quotes shown are simulated demo pricing</li>
              <li>No personal data is sold or shared</li>
            </ul>
          </div>
        </div>
        <p className="footer-disclaimer">
          QuotePilot is not an insurance company or licensed insurance producer. All prices are
          simulated estimates, not offers of insurance — your final premium is determined by the
          carrier&apos;s underwriting. Carrier availability varies by state.
        </p>
        <div className="footer-bottom">
          <span>© 2026 QuotePilot. Demo build — all prices simulated.</span>
          <span>Sample data only. No real PII.</span>
          <button
            type="button"
            className="btn-danger-ghost"
            onClick={openCookieSettings}
            style={{ padding: 0 }}
          >
            Cookie settings
          </button>
        </div>
      </div>
    </footer>
  );
}

export function Layout() {
  const { pathname } = useLocation();

  // Move focus to the top of the page on route change (a11y).
  useEffect(() => {
    const main = document.getElementById("main-content");
    main?.setAttribute("tabindex", "-1");
    main?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
    return () => {
      main?.removeAttribute("tabindex");
    };
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Header />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
      <CookieBanner />
    </>
  );
}
