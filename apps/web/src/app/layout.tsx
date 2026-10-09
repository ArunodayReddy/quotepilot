import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "../lib/theme";
import { themeInitScript } from "../lib/theme";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { RouteTracker } from "../components/RouteTracker";
import { CookieBanner } from "../components/CookieBanner";
import "../styles/tokens.css";
import "../styles/main.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://quotepilot.example.com"),
  title: {
    default: "QuotePilot — One form. Every carrier. Compare side by side.",
    template: "%s",
  },
  description:
    "QuotePilot gathers car insurance quotes from every relevant carrier in your state with one short form. Compare ranked quotes on the site and by email. Demo build with simulated pricing.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1e" },
    { media: "(prefers-color-scheme: light)", color: "#f6f8fc" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
          <Header />
          <main id="main-content">{children}</main>
          <Footer />
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
