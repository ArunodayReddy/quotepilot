import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "../lib/theme";
import { themeInitScript } from "../lib/theme";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { RouteTracker } from "../components/RouteTracker";
import { CookieBanner } from "../components/CookieBanner";
import { getSiteContent } from "../lib/cms";
import "../styles/tokens.css";
import "../styles/main.css";
import "leaflet/dist/leaflet.css";

/** Site-wide metadata comes from the CMS, like all other page copy. */
export async function generateMetadata(): Promise<Metadata> {
  const site = getSiteContent();
  return {
    metadataBase: new URL("https://quotepilot.example.com"),
    title: {
      default: site.meta.defaultTitle,
      template: site.meta.titleTemplate,
    },
    description: site.meta.description,
    icons: { icon: "/favicon.svg" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1e" },
    { media: "(prefers-color-scheme: light)", color: "#f6f8fc" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const site = getSiteContent();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Apply the saved/OS theme before first paint — prevents flash of wrong theme.
            A raw parser-inserted script: runs during HTML parsing, before React hydrates. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          <RouteTracker />
          <a className="skip-link" href="#main-content">
            Skip to main content
          </a>
          <Header content={site.header} brand={site.brand} />
          <main id="main-content">{children}</main>
          <Footer content={site.footer} brandName={site.brand.name} />
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
