# QuotePilot — Accessibility

> Accessibility is not optional (CONTEXT rule 3). Target: **WCAG 2.2 AA** across
> `apps/web` and `analytics/dashboard`. Last updated: 2026-10-08 (v0.2.0 build).

## 1. Checklist — as implemented

### Landmarks & structure

- [x] `<header>`, `<nav>`, `<main>`, `<footer>` landmarks on every page; exactly one `<main>`.
- [x] One `<h1>` per page; no skipped heading levels.
- [x] Wizard steps are `<fieldset>` + `<legend>`; quote results are `<article>` cards
      in a labelled `<section>`; data tables use `<th scope>` (dashboard carrier table).

### Labels & names

- [x] Every input has a visible `<label>` (placeholders are hints, never labels).
- [x] Icon-only buttons have `aria-label` (e.g. dashboard Refresh, card expand toggles).
- [x] SVG charts have `role="img"` + `aria-label` describing the data; key numbers are
      also present as real text so screen readers don't depend on the SVG.

### Focus management

- [x] Visible focus ring on every interactive element (`:focus-visible`, 2px accent outline,
      never `outline: none` without a replacement).
- [x] Wizard step changes move focus to the new step heading (`tabindex="-1"` + `.focus()`).
- [x] Modal/drawer (compare view, mobile nav): focus trapped while open, Escape closes,
      focus returns to the trigger on close.
- [x] Skip link ("Skip to main content" / "Skip to dashboard content") as the first
      focusable element.

### Keyboard flows

- [x] Entire wizard completable by keyboard: native inputs, radio groups arrow-key
      navigable, step Back/Continue are real `<button>`s.
- [x] Dashboard tabs are `role="tablist"`/`role="tab"` with `aria-selected`; arrow-key
      navigation follows the APG tabs pattern.
- [x] Quote card expand/collapse is a `<button aria-expanded>` — no div-onClick.
- [x] No keyboard traps; tab order matches visual order.

### Contrast

- [x] Body text and UI labels ≥ 4.5:1 against backgrounds (dark glass theme tokens
      measured; see `docs/VISUALS.md`).
- [x] Large text (≥ 24px / 19px bold) ≥ 3:1.
- [x] Focus indicators ≥ 3:1 against adjacent colors.
- [x] Charts never rely on color alone: bars carry numeric labels; win-rate has % text.

### Motion

- [x] `prefers-reduced-motion: reduce` disables transitions, shimmer/skeleton animation,
      and decorative parallax (CSS media query in both apps).
- [x] No auto-playing video/audio; progress polling doesn't move focus or announce.

### Live regions

- [x] Quote job progress uses `aria-live="polite"` status text ("7 of 12 quotes ready").
- [x] Form validation errors: `aria-describedby` links input → error message;
      error summary on submit moves focus to the summary with `role="alert"`.
- [x] Dashboard "updated HH:MM:SS" is `aria-live="off"` (decorative); API errors use
      `role="alert"` once, not on every poll retry.

### Touch & pointer

- [x] Touch targets ≥ 24×24 CSS px (WCAG 2.2), primary CTAs ≥ 44×44.
- [x] No hover-only functionality; tooltips also open on focus.

## 2. Contrast tokens (measured pairs)

| Foreground | Background      | Ratio  | Use                |
| ---------- | --------------- | ------ | ------------------ |
| `#eef2ff`  | `#0a1022`       | ~15.2  | body text          |
| `#a8b6d8`  | `#0a1022`       | ~7.1   | secondary text     |
| `#6ea8fe`  | `#0a1022`       | ~5.6   | links, focus ring  |
| `#060a15`  | `#6ea8fe→#a78bfa` gradient | ~7.8 | primary button text |
| `#6b7a9e`  | `#0a1022`       | ~4.0   | **decorative only — never for text** |

Rule: `--text-3` (`#6b7a9e`) is for non-essential decoration (chart axes, dividers).
Anything a user must read uses `--text-1` or `--text-2`.

## 3. Testing procedure (run before every release)

1. **Keyboard only**: complete the wizard, expand a quote card, open compare, use every
   dashboard tab. No mouse. Note any trap or invisible focus.
2. **Screen reader**: NVDA (Windows) + VoiceOver (macOS/iOS), latest versions.
   Check landmarks list, heading order, form labels, live-region announcements.
3. **Automated**: `axe-core` via Lighthouse CI (accessibility ≥ 95) + `eslint-plugin-jsx-a11y`
   in the web app build. Automated catches ~30% — never a substitute for 1–2.
4. **Contrast**: measure the actual token pairs with a color-contrast analyzer after any
   theme change; record results in `docs/VISUALS.md` visual change log.
5. **Zoom & reflow**: 200% zoom and 320px width — no horizontal scrolling, no clipped
   controls, wizard remains single-column.
6. **Reduced motion**: enable OS reduced-motion; verify no animation, skeleton becomes static.

Defects found go in the issue tracker with the WCAG criterion number (e.g. `2.4.7`,
`1.4.3`) and block release until fixed.
