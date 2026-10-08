# QuotePilot

**One form. Every carrier. The best deal.** QuotePilot collects your car-insurance details once, pulls quotes
from every relevant insurance company for your state in the background, and delivers them ranked
side-by-side — on the site and by email when they're ready. Plus a local-agent directory for your area and a
usage-analytics dashboard.

> Status: v0.2.0 — demo MVP. Full pipeline live: wizard → quote engine (6 simulated MA
> carriers) → ranked results + compare → email delivery → agents directory → analytics dashboard.
> Project rules live in `CONTEXT.md` — read it before contributing anything.

## Quick start (target)

```bash
scripts/dev.sh        # starts API + web + dashboard from a clean checkout
```

- Web app: http://localhost:5173
- API: http://localhost:3001/api
- Analytics dashboard: http://localhost:5174

## Structure

See `CONTEXT.md` §3 for the full architecture map. In short:

- `apps/web` — React + Vite + TypeScript frontend (Apple-grade UI)
- `apps/api` — Node + Express + TypeScript backend (quote engine, email, agents, analytics)
- `packages/shared` — shared types + `QuoteAdapter` interface
- `data/` — per-state carrier registries, local-agent directory, masked sample data
- `analytics/dashboard` — usage dashboard (clicks, funnels, carrier performance)
- `docs/` — VISUALS, SECURITY, SEO, ACCESSIBILITY, LOGGING, ARCHITECTURE, DEMO
- `scripts/`, `tests/`

## Core ideas

1. **State-aware quotes** — carrier lists, coverage minimums, and agents key off the user's state.
2. **Async by design** — quotes run as background jobs; the UI never blocks on a carrier.
3. **Adapter pattern** — one adapter per carrier; simulation adapters today, real carrier APIs tomorrow,
   same interface.
4. **Privacy & security first** — validation on every boundary, no PII in logs/analytics, masked sample data.

## Demo

`docs/DEMO.md` holds the 90-second hackathon pitch script.
