/**
 * CMS content loader — server-only.
 *
 * Page copy lives in `apps/web/data/content/*.json` (the CMS) and components
 * render it from props. Nothing user-facing is hardcoded in components.
 * This module uses node:fs: import it only from server components, pages,
 * and generateMetadata — never from "use client" modules.
 *
 * The loader is the seam: today the backend is versioned JSON files; a real
 * CMS (Sanity/Contentful/API) can replace `loadJson` later without touching
 * any component.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface NavLink {
  label: string;
  href: string;
  /** exact path match for the active state (default: prefix match) */
  exact?: boolean;
}

export interface SiteHeaderContent {
  nav: NavLink[];
  cta: { label: string; href: string };
  themeToggle: { toDark: string; toLight: string };
}

export interface FooterColumn {
  heading: string;
  links?: NavLink[];
  bullets?: string[];
}

export interface SiteFooterContent {
  brandBlurb: string;
  columns: FooterColumn[];
  disclaimer: string;
  bottom: { copyright: string; sampleNote: string; cookieSettings: string };
}

export interface SiteContent {
  brand: { name: string; mark: string; homeHref: string; homeAriaLabel: string };
  meta: { defaultTitle: string; titleTemplate: string; description: string };
  header: SiteHeaderContent;
  footer: SiteFooterContent;
}

export interface HeroCta {
  label: string;
  href: string;
  /** analytics element id */
  element: string;
}

export interface FaqItem {
  id: string;
  q: string;
  /** static answer; absent when `dynamic` resolves it */
  a?: string;
  /** dynamic answer slot, resolved at render time (e.g. from the registry) */
  dynamic?: "carriers";
  /** full static answer used when the dynamic source is unavailable */
  fallback?: string;
  /** sentence template around the live carrier list for the dynamic slot */
  dynamicPrefix?: string;
  dynamicSuffix?: string;
}

export interface HomeContent {
  seo: { title: string; description: string };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    subtitle: string;
    zipLabel: string;
    zipPlaceholder: string;
    zipCta: string;
    zipHint: string;
    zipError: string;
    secondaryCtas: HeroCta[];
    note: string;
  };
  howItWorks: {
    heading: string;
    sub: string;
    steps: { n: string; title: string; text: string }[];
  };
  carriers: {
    heading: string;
    sub: string;
    loadingAriaLabel: string;
    unavailableNote: string;
    marqueeAriaLabel: string;
  };
  faq: { heading: string; sub: string; items: FaqItem[] };
  finalCta: { heading: string; sub: string; cta: string };
  jsonLd: { description: string };
}

/** Rich-text segment: plain, bold, or a link. Paragraphs are segment arrays. */
export type RichSegment =
  | { text: string }
  | { bold: string }
  | { link: { label: string; href: string } };

export interface AboutSection {
  heading: string;
  paragraphs?: RichSegment[][];
  bullets?: string[];
  cta?: { label: string; href: string };
}

export interface AboutContent {
  seo: { title: string; description: string };
  title: string;
  lead: string;
  sections: AboutSection[];
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function fail(path: string, why: string): never {
  throw new Error(`CMS content invalid: ${path} — ${why}`);
}

function str(v: unknown, path: string): string {
  if (typeof v !== "string" || v.length === 0) fail(path, "expected a non-empty string");
  return v as string;
}

function optStr(v: unknown, path: string): string | undefined {
  if (v === undefined) return undefined;
  return str(v, path);
}

function rec(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(path, "expected an object");
  return v as Record<string, unknown>;
}

function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, "expected an array");
  return v as unknown[];
}

function navLink(v: unknown, path: string): NavLink {
  const o = rec(v, path);
  const link: NavLink = { label: str(o.label, `${path}.label`), href: str(o.href, `${path}.href`) };
  if (o.exact !== undefined) {
    if (typeof o.exact !== "boolean") fail(`${path}.exact`, "expected a boolean");
    link.exact = o.exact as boolean;
  }
  return link;
}

function validateSiteContent(raw: unknown): SiteContent {
  const o = rec(raw, "site.json");
  const brand = rec(o.brand, "site.json.brand");
  const meta = rec(o.meta, "site.json.meta");
  const header = rec(o.header, "site.json.header");
  const footer = rec(o.footer, "site.json.footer");
  const bottom = rec(footer.bottom, "site.json.footer.bottom");
  const themeToggle = rec(header.themeToggle, "site.json.header.themeToggle");
  const cta = rec(header.cta, "site.json.header.cta");
  return {
    brand: {
      name: str(brand.name, "site.json.brand.name"),
      mark: str(brand.mark, "site.json.brand.mark"),
      homeHref: str(brand.homeHref, "site.json.brand.homeHref"),
      homeAriaLabel: str(brand.homeAriaLabel, "site.json.brand.homeAriaLabel"),
    },
    meta: {
      defaultTitle: str(meta.defaultTitle, "site.json.meta.defaultTitle"),
      titleTemplate: str(meta.titleTemplate, "site.json.meta.titleTemplate"),
      description: str(meta.description, "site.json.meta.description"),
    },
    header: {
      nav: arr(header.nav, "site.json.header.nav").map((l, i) => navLink(l, `site.json.header.nav[${i}]`)),
      cta: { label: str(cta.label, "site.json.header.cta.label"), href: str(cta.href, "site.json.header.cta.href") },
      themeToggle: {
        toDark: str(themeToggle.toDark, "site.json.header.themeToggle.toDark"),
        toLight: str(themeToggle.toLight, "site.json.header.themeToggle.toLight"),
      },
    },
    footer: {
      brandBlurb: str(footer.brandBlurb, "site.json.footer.brandBlurb"),
      columns: arr(footer.columns, "site.json.footer.columns").map((c, i) => {
        const col = rec(c, `site.json.footer.columns[${i}]`);
        const out: FooterColumn = { heading: str(col.heading, `site.json.footer.columns[${i}].heading`) };
        if (col.links !== undefined)
          out.links = arr(col.links, `site.json.footer.columns[${i}].links`).map((l, j) =>
            navLink(l, `site.json.footer.columns[${i}].links[${j}]`),
          );
        if (col.bullets !== undefined)
          out.bullets = arr(col.bullets, `site.json.footer.columns[${i}].bullets`).map((b, j) =>
            str(b, `site.json.footer.columns[${i}].bullets[${j}]`),
          );
        if (!out.links && !out.bullets)
          fail(`site.json.footer.columns[${i}]`, "needs links or bullets");
        return out;
      }),
      disclaimer: str(footer.disclaimer, "site.json.footer.disclaimer"),
      bottom: {
        copyright: str(bottom.copyright, "site.json.footer.bottom.copyright"),
        sampleNote: str(bottom.sampleNote, "site.json.footer.bottom.sampleNote"),
        cookieSettings: str(bottom.cookieSettings, "site.json.footer.bottom.cookieSettings"),
      },
    },
  };
}

function faqItem(v: unknown, path: string): FaqItem {
  const o = rec(v, path);
  const item: FaqItem = { id: str(o.id, `${path}.id`), q: str(o.q, `${path}.q`) };
  const a = optStr(o.a, `${path}.a`);
  if (a !== undefined) item.a = a;
  if (o.dynamic !== undefined) {
    if (o.dynamic !== "carriers") fail(`${path}.dynamic`, 'expected "carriers"');
    item.dynamic = "carriers";
  }
  const fallback = optStr(o.fallback, `${path}.fallback`);
  if (fallback !== undefined) item.fallback = fallback;
  if (item.a === undefined && item.dynamic === undefined)
    fail(path, "needs an answer (a) or a dynamic slot");
  if (item.dynamic && !item.fallback) fail(path, "dynamic items need a fallback answer");
  const dynamicPrefix = optStr(o.dynamicPrefix, `${path}.dynamicPrefix`);
  const dynamicSuffix = optStr(o.dynamicSuffix, `${path}.dynamicSuffix`);
  if (item.dynamic && (!dynamicPrefix || !dynamicSuffix))
    fail(path, "dynamic items need dynamicPrefix and dynamicSuffix");
  if (dynamicPrefix !== undefined) item.dynamicPrefix = dynamicPrefix;
  if (dynamicSuffix !== undefined) item.dynamicSuffix = dynamicSuffix;
  return item;
}

function validateHomeContent(raw: unknown): HomeContent {
  const o = rec(raw, "home.json");
  const seo = rec(o.seo, "home.json.seo");
  const hero = rec(o.hero, "home.json.hero");
  const how = rec(o.howItWorks, "home.json.howItWorks");
  const carriers = rec(o.carriers, "home.json.carriers");
  const faq = rec(o.faq, "home.json.faq");
  const finalCta = rec(o.finalCta, "home.json.finalCta");
  const jsonLd = rec(o.jsonLd, "home.json.jsonLd");
  return {
    seo: {
      title: str(seo.title, "home.json.seo.title"),
      description: str(seo.description, "home.json.seo.description"),
    },
    hero: {
      eyebrow: str(hero.eyebrow, "home.json.hero.eyebrow"),
      title: str(hero.title, "home.json.hero.title"),
      titleAccent: str(hero.titleAccent, "home.json.hero.titleAccent"),
      subtitle: str(hero.subtitle, "home.json.hero.subtitle"),
      zipLabel: str(hero.zipLabel, "home.json.hero.zipLabel"),
      zipPlaceholder: str(hero.zipPlaceholder, "home.json.hero.zipPlaceholder"),
      zipCta: str(hero.zipCta, "home.json.hero.zipCta"),
      zipHint: str(hero.zipHint, "home.json.hero.zipHint"),
      zipError: str(hero.zipError, "home.json.hero.zipError"),
      secondaryCtas: arr(hero.secondaryCtas, "home.json.hero.secondaryCtas").map((c, i) => {
        const cc = rec(c, `home.json.hero.secondaryCtas[${i}]`);
        return {
          label: str(cc.label, `home.json.hero.secondaryCtas[${i}].label`),
          href: str(cc.href, `home.json.hero.secondaryCtas[${i}].href`),
          element: str(cc.element, `home.json.hero.secondaryCtas[${i}].element`),
        };
      }),
      note: str(hero.note, "home.json.hero.note"),
    },
    howItWorks: {
      heading: str(how.heading, "home.json.howItWorks.heading"),
      sub: str(how.sub, "home.json.howItWorks.sub"),
      steps: arr(how.steps, "home.json.howItWorks.steps").map((s, i) => {
        const st = rec(s, `home.json.howItWorks.steps[${i}]`);
        return {
          n: str(st.n, `home.json.howItWorks.steps[${i}].n`),
          title: str(st.title, `home.json.howItWorks.steps[${i}].title`),
          text: str(st.text, `home.json.howItWorks.steps[${i}].text`),
        };
      }),
    },
    carriers: {
      heading: str(carriers.heading, "home.json.carriers.heading"),
      sub: str(carriers.sub, "home.json.carriers.sub"),
      loadingAriaLabel: str(carriers.loadingAriaLabel, "home.json.carriers.loadingAriaLabel"),
      unavailableNote: str(carriers.unavailableNote, "home.json.carriers.unavailableNote"),
      marqueeAriaLabel: str(carriers.marqueeAriaLabel, "home.json.carriers.marqueeAriaLabel"),
    },
    faq: {
      heading: str(faq.heading, "home.json.faq.heading"),
      sub: str(faq.sub, "home.json.faq.sub"),
      items: arr(faq.items, "home.json.faq.items").map((f, i) => faqItem(f, `home.json.faq.items[${i}]`)),
    },
    finalCta: {
      heading: str(finalCta.heading, "home.json.finalCta.heading"),
      sub: str(finalCta.sub, "home.json.finalCta.sub"),
      cta: str(finalCta.cta, "home.json.finalCta.cta"),
    },
    jsonLd: {
      description: str(jsonLd.description, "home.json.jsonLd.description"),
    },
  };
}

function richSegment(v: unknown, path: string): RichSegment {
  const o = rec(v, path);
  const keys = Object.keys(o);
  if (keys.length !== 1) fail(path, "segment must have exactly one of: text, bold, link");
  if (o.text !== undefined) return { text: str(o.text, `${path}.text`) };
  if (o.bold !== undefined) return { bold: str(o.bold, `${path}.bold`) };
  const link = rec(o.link, `${path}.link`);
  return {
    link: {
      label: str(link.label, `${path}.link.label`),
      href: str(link.href, `${path}.link.href`),
    },
  };
}

function validateAboutContent(raw: unknown): AboutContent {
  const o = rec(raw, "about.json");
  const seo = rec(o.seo, "about.json.seo");
  return {
    seo: {
      title: str(seo.title, "about.json.seo.title"),
      description: str(seo.description, "about.json.seo.description"),
    },
    title: str(o.title, "about.json.title"),
    lead: str(o.lead, "about.json.lead"),
    sections: arr(o.sections, "about.json.sections").map((s, i) => {
      const sec = rec(s, `about.json.sections[${i}]`);
      const out: AboutSection = { heading: str(sec.heading, `about.json.sections[${i}].heading`) };
      if (sec.paragraphs !== undefined)
        out.paragraphs = arr(sec.paragraphs, `about.json.sections[${i}].paragraphs`).map((p, j) =>
          arr(p, `about.json.sections[${i}].paragraphs[${j}]`).map((seg, k) =>
            richSegment(seg, `about.json.sections[${i}].paragraphs[${j}][${k}]`),
          ),
        );
      if (sec.bullets !== undefined)
        out.bullets = arr(sec.bullets, `about.json.sections[${i}].bullets`).map((b, j) =>
          str(b, `about.json.sections[${i}].bullets[${j}]`),
        );
      if (sec.cta !== undefined) {
        const cta = rec(sec.cta, `about.json.sections[${i}].cta`);
        out.cta = {
          label: str(cta.label, `about.json.sections[${i}].cta.label`),
          href: str(cta.href, `about.json.sections[${i}].cta.href`),
        };
      }
      if (!out.paragraphs && !out.bullets)
        fail(`about.json.sections[${i}]`, "needs paragraphs or bullets");
      return out;
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Loader                                                              */
/* ------------------------------------------------------------------ */

/** Candidate content dirs: apps/web cwd first, repo-root cwd as fallback. */
function contentDir(): string {
  const candidates = [
    join(process.cwd(), "data/content"),
    join(process.cwd(), "apps/web/data/content"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  throw new Error(
    `CMS content directory not found (tried ${candidates.join(", ")}). ` +
      "Run Next.js from apps/web or the repo root.",
  );
}

const cache = new Map<string, unknown>();

function load<T>(file: string, validate: (raw: unknown) => T): T {
  // In production the content is fixed at build/deploy; in dev re-read so
  // edits apply without a restart.
  if (process.env.NODE_ENV === "production" && cache.has(file)) {
    return cache.get(file) as T;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(contentDir(), file), "utf8"));
  } catch (e) {
    throw new Error(`CMS content unreadable: ${file} — ${e instanceof Error ? e.message : String(e)}`);
  }
  const validated = validate(raw);
  cache.set(file, validated);
  return validated;
}

export function getSiteContent(): SiteContent {
  return load("site.json", validateSiteContent);
}

export function getHomeContent(): HomeContent {
  return load("home.json", validateHomeContent);
}

export function getAboutContent(): AboutContent {
  return load("about.json", validateAboutContent);
}
