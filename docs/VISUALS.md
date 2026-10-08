# QuotePilot — Visual Design

> Design tokens, component inventory, and the append-only visual change log.
> CONTEXT rule 1: every new screen is reviewed against this language before it ships.
> Last updated: 2026-10-08 (v0.2.0 build).

## 1. Design tokens

### Color

| Token          | Value                                   | Use                                              |
| -------------- | --------------------------------------- | ------------------------------------------------ |
| `--bg-0`       | `#060a15`                               | page base (darkest)                              |
| `--bg-1`       | `#0a1022`                               | page gradient end / panels                       |
| `--bg-2`       | `#0e1630`                               | elevated surfaces                                |
| `--glass`      | `rgba(255,255,255,0.045)`               | glass card fill                                  |
| `--glass-strong` | `rgba(255,255,255,0.07)`              | hover / active glass                             |
| `--glass-border` | `rgba(255,255,255,0.10)`              | glass card border (1px)                          |
| `--text-1`     | `#eef2ff`                               | primary text (contrast ~15.2:1 on bg-1)          |
| `--text-2`     | `#a8b6d8`                               | secondary text (contrast ~7.1:1)                 |
| `--text-3`     | `#6b7a9e`                               | **decorative only** (~4.0:1 — never for reading text) |
| `--accent`     | `#6ea8fe`                               | primary accent: links, focus ring, CTA gradient  |
| `--accent-2`   | `#a78bfa`                               | gradient partner, highlights                     |
| `--accent-3`   | `#67e8f9`                               | success/info gradient partner                    |
| `--good`       | `#34d399`                               | success states, win-rate bars                    |
| `--warn`       | `#fbbf24`                               | warnings, partial-progress                      |
| `--bad`        | `#f87171`                               | errors, destructive actions                      |

Primary CTA gradient: `linear-gradient(135deg, #6ea8fe, #a78bfa)` with near-black
(`#060a15`) text — ~7.8:1 contrast. Background ambience: two soft radial glows
(accent at 14% top-left, accent-2 at 12% top-right) over a vertical `bg-0 → bg-1` gradient.

### Glass

- Cards: `var(--glass)` fill + `1px solid var(--glass-border)` + `backdrop-filter: blur(20px)`.
- Radius: `--radius-sm: 10px` (buttons, inputs), `--radius-md: 16px` (panels, cards),
  `--radius-lg: 24px` (hero panels, modals). Pills: `999px`.
- Shadow: `0 12px 40px rgba(0,0,0,0.35)` on raised panels; `0 6px 20px rgba(110,168,254,0.18)`
  on CTA hover lift.

### Typography

- Font stack: `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.
- Mono (numbers, timestamps, latencies): `ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace`.
- Scale: display 2.5rem/800 (hero), h1 1.6rem/750, h2 1.15rem/700, body 1rem/400,
  small 0.88rem, caption 0.78rem uppercase + 0.06em tracking (table headers, eyebrows).
- Letter-spacing: `-0.02em` on headings; body default.

### Spacing

Base unit 0.25rem (4px). Common rhythm: 0.5 / 0.75 / 1 / 1.5 / 2 / 3 / 4 rem.
Page container: `max-width: 1080px`, horizontal padding 1.5rem (1rem on mobile).

### Motion

- Standard: `0.15s ease` (hovers, tab switches); lifts: `translateY(-1px)`.
- Entrance: fade + 8px rise, `0.25s ease`, staggered 40ms on card grids.
- Skeleton shimmer: 1.4s loop (disabled under `prefers-reduced-motion`).
- **Reduced motion**: all durations → 0.01ms via the media query; nothing essential
  may depend on animation (progress is text, not just a spinner).

## 2. Component inventory

| Component        | Where              | Description                                                                 |
| ---------------- | ------------------ | --------------------------------------------------------------------------- |
| `btn` / `btn-primary` | web, dashboard | Glass button; primary = accent gradient, dark text. Focus-visible ring 2px accent. |
| Glass panel      | web, dashboard     | `.panel` — the universal content card (blur 20px, radius-lg).              |
| Wizard steps     | web                | `<fieldset>` per step, progress indicator (5 dots + labels), Back/Continue pair — one primary action per screen. |
| Quote card       | web                | `<article>`: carrier name, 6-mo premium (large mono), coverage chips, expandable breakdown (`<button aria-expanded>`). Cheapest gets "Best deal" badge. |
| Badges           | web                | pill: `best-deal` (good gradient), `agent-only` (warn tint), `coming-soon` (text-3). |
| Compare table    | web                | sticky carrier column, row per coverage line, highlight cheapest per row.  |
| Agent card       | web                | name, city, carriers served, `tel:` phone button.                          |
| Tabs             | dashboard          | pill tablist (`role=tablist`), `aria-selected` state, APG arrow-key nav.   |
| HBar chart       | dashboard          | hand-rolled SVG horizontal bars (clicks by element). No chart lib.         |
| Funnel chart     | dashboard          | SVG step bars + "% of entry" conversion text per step.                     |
| VBar chart       | dashboard          | SVG vertical bars (daily sessions, last 14 days).                         |
| Carrier table    | dashboard          | carrier / quotes / avg latency / win-rate % with inline gradient bar.     |
| Empty state      | dashboard          | "No events yet — use the main app to generate data" + "Send test event".  |
| Error banner     | dashboard          | `role=alert` API-unreachable banner with Retry.                            |
| Skeleton         | dashboard          | shimmer placeholder while summary loads.                                   |
| Skip link        | web, dashboard     | first focusable element, reveals on focus.                                 |

Charts are hand-rolled SVG in both apps (keeps initial JS < 200KB per the SEO budget);
every chart duplicates its key numbers as text for screen readers.

## 3. Screenshots

> Placeholder — capture after the v0.2.0 UI lands.

- [ ] `screenshots/01-home-hero.png` — home hero + CTA
- [ ] `screenshots/02-wizard-step.png` — wizard mid-flow
- [ ] `screenshots/03-quotes-ranked.png` — ranked quote cards
- [ ] `screenshots/04-compare.png` — side-by-side compare
- [ ] `screenshots/05-agents.png` — agent directory
- [ ] `screenshots/06-dashboard.png` — analytics dashboard (all four views)

Store under `docs/screenshots/`; reference from this section when captured.

## 4. Rules for visual changes

1. New screens reuse tokens above — no one-off colors, radii, or fonts.
2. Every visual change gets a dated entry in the change log below (append-only).
3. Contrast pairs re-measured after any token change (see `docs/ACCESSIBILITY.md` §2).
4. Mobile (≤640px) checked: single column, ≥44px primary targets, no horizontal scroll.

---

## Visual change log (append-only)

- 2026-10-08 — Initial token set ratified (v0.2.0 build): dark glassy theme, accent
  gradient `#6ea8fe → #a78bfa`, Inter + system mono, radius scale 10/16/24px,
  hand-rolled SVG charts for the dashboard (no chart library — protects the 200KB JS budget).
- **2026-10-08 — Initial web app visual system (v0.2.0, web track).** First full build of
  `apps/web`: design tokens in `src/styles/tokens.css` (light/dark via `[data-theme]` with
  `prefers-color-scheme` fallback; accent blue→cyan gradient, glass `--surface` + 20px blur,
  radii 10/16/24/999, `--ease-out` cubic-bezier motion, orbs for hero gradients). Global styles
  in `src/styles/main.css`: sticky glass header with brand mark, pill CTA, theme toggle;
  hero with animated drifting orbs + gradient headline "One form. Every carrier. The best
  deal."; glass step cards (How it works, 3-up grid); infinite carrier marquee with edge
  fade masks (text badges: GEICO, Progressive, Allstate, Liberty Mutual, Plymouth Rock,
  Amica); FAQ accordion; glass footer. Quote cards: glass, 2.5rem price display,
  coverage-match meter, `<details>` caveats, gold "Best deal" ribbon on #1, and the amber
  "Simulated — demo pricing" pill badge on every card. Compare table (up to 3) with sticky
  header row. Wizard: glass card, gradient progress bar + numbered step indicator, resume
  banner, toggle switches and range sliders for coverage, danger-ghost remove-driver buttons.
  Agents page: glass search panel + agent cards with tel: phone links and "Sample data"
  badges. Motion: IntersectionObserver `.reveal` fade-up, orb drift, marquee loop — all
  disabled under `prefers-reduced-motion`. Focus: visible `--focus-ring` on all interactive
  elements; wizard moves focus to the step heading per step; skip link in header.
  Contrast targets ≥ 4.5:1 for body text in both themes.

## 2026-10-08 — v0.2.0 static snapshot
- Added `docs/snapshots/v0.2.0-preview.html`: single-file static preview of the four key screens
  (Home hero, Wizard step 3, ranked Quotes with live smoke-test data, Analytics dashboard),
  rendered from the real design tokens (`apps/web/src/styles/tokens.css`), real hero/wizard copy,
  and real quote figures (GEICO $1,274 → Amica $1,576). Built because headless screenshots are
  blocked in this environment; labeled clearly as a static preview, dashboard numbers illustrative.

## 2026-10-08 — v0.3.0 form overhaul: Select component + field standards
- **New component: `Select` (`apps/web/src/components/Select.tsx`).** Custom accessible dropdown
  replacing all native selects: glass trigger button with chevron (rotates on open), floating
  listbox popup with pop-in animation, checkmark on the selected option, hover/keyboard active
  states in `--accent-soft`, error state in `--danger`. Full keyboard map (ArrowUp/Down, Home/End,
  Enter/Space, Escape, Tab, type-ahead with 600ms buffer). ARIA: `aria-haspopup="listbox"`,
  `aria-expanded`, `aria-activedescendant`, `role="listbox"`/`role="option"` + `aria-selected`.
  Animation disabled under `prefers-reduced-motion` (global reset covers it).
- **Field standards (insurer-grade):** DOB uses native `input[type="date"]` with `max=today` and
  theme-aware `color-scheme` (dark calendar picker in dark mode); proper `autocomplete` tokens
  everywhere (`street-address`, `postal-code`, `given-name`, `family-name`, `bday`, `email`, `tel`);
  driver cards are now `fieldset`/`legend`; state dropdown shows full names ("Massachusetts"),
  stores codes ("MA"); make dropdown covers top 25 makes + Other with conditional free-text.
- **Home dynamics:** carrier marquee renders registry logos+names from the API with skeleton
  shimmer badges while loading and a graceful degraded message on failure; FAQ answer for
  states/carriers is interpolated from the live registry (fallback copy when offline).
- **Snapshot:** `docs/snapshots/v0.2.0-preview.html` wizard screen updated to the Drivers step
  showing the DOB date field and custom dropdowns.
