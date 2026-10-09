"use client";
import { useEffect, useRef, useState } from "react";
import { useAnalytics } from "../lib/analytics";

/**
 * Delightful loading state: a brand-styled animated orb loader paired with
 * rotating witty-but-honest status lines. Waiting should feel like progress,
 * not a dead end.
 *
 * Honesty rule: lines describe what is actually happening (contacting
 * carriers, measuring distance) — never fake claims ("found you $500 off!").
 * Reduced motion: static first line, no animation, no rotation.
 */

const QUOTE_LINES = [
  "Knocking on GEICO's door…",
  "Haggling with Progressive…",
  "Asking Allstate for their best number…",
  "Checking what Liberty Mutual will do…",
  "Comparing carriers so you don't have to…",
  "Double-checking the fine print…",
  "Polishing your quotes…",
];

const AGENT_LINES = [
  "Finding humans near you…",
  "Checking who's open right now…",
  "Measuring miles, not minutes…",
  "Polishing the map pins…",
  "Reading the office hours…",
];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function LoadingMessages({ context }: { context: "quotes" | "agents" }) {
  const lines = context === "quotes" ? QUOTE_LINES : AGENT_LINES;
  const [index, setIndex] = useState(0);
  const reduced = usePrefersReducedMotion();
  const track = useAnalytics(context === "quotes" ? "quotes" : "agents");
  const firedRef = useRef(false);

  // One analytics event per loading session — never PII, just the context.
  useEffect(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      track("loading_view", { metadata: { context } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % lines.length);
    }, 3000);
    return () => window.clearInterval(t);
  }, [reduced, lines.length]);

  return (
    <div className="loading-delight" role="status" aria-live="polite">
      <span className="orb-loader" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <p key={reduced ? "static" : index} className="loading-line">
        {lines[reduced ? 0 : index]}
      </p>
    </div>
  );
}
