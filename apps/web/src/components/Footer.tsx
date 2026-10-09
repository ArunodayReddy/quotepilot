"use client";

import Link from "next/link";
import { openCookieSettings } from "../lib/analytics";
import type { SiteContent } from "../lib/cms";

export function Footer({
  content,
  brandName,
}: {
  content: SiteContent["footer"];
  brandName: string;
}) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <h4>{brandName}</h4>
            <p>{content.brandBlurb}</p>
          </div>
          {content.columns.map((col) => (
            <nav aria-label={col.heading} key={col.heading}>
              <h4>{col.heading}</h4>
              {col.links && (
                <ul>
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              )}
              {col.bullets && (
                <ul>
                  {col.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </nav>
          ))}
        </div>
        <p className="footer-disclaimer">{content.disclaimer}</p>
        <div className="footer-bottom">
          <span>{content.bottom.copyright}</span>
          <span>{content.bottom.sampleNote}</span>
          <button
            type="button"
            className="btn-danger-ghost"
            onClick={openCookieSettings}
            style={{ padding: 0 }}
          >
            {content.bottom.cookieSettings}
          </button>
        </div>
      </div>
    </footer>
  );
}
