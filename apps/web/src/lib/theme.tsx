"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark";
type ThemeMode = Theme | "system";

const STORAGE_KEY = "quotepilot.theme";

interface ThemeContextValue {
  theme: Theme; // resolved
  mode: ThemeMode; // user preference
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(mode: ThemeMode): Theme {
  if (mode !== "system") return mode;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function readStoredMode(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // SSR-safe: start at "system" (no localStorage access during render — the
  // inline theme script in the root layout already set data-theme pre-paint),
  // then hydrate the stored preference on mount.
  const [mode, setModeState] = useState<ThemeMode>("system");
  const theme = resolveTheme(mode);

  useEffect(() => {
    setModeState(readStoredMode());
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Follow OS changes while in "system" mode.
  useEffect(() => {
    if (mode !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => document.documentElement.setAttribute("data-theme", resolveTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const resolved = resolveTheme(prev);
      const next: ThemeMode = resolved === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/* Inline script rendered in the root layout <head> (beforeInteractive) —
 * applies the saved/OS theme before first paint to prevent a theme flash. */
export const themeInitScript = `(function(){try{var m=localStorage.getItem('quotepilot.theme');var t=m==='light'?'light':m==='dark'?'dark':(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
