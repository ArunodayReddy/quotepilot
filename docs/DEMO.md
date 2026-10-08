# QuotePilot — Demo Guide

> 90-second hackathon pitch script + live demo flow. Practice twice; aim for 85 seconds
> spoken so nerves have room. Last updated: 2026-10-08 (v0.2.0 build).

## 1. The 90-second pitch (word-for-word, timed beats)

**[0:00–0:12] THE HOOK — the pain**
> "Shopping for car insurance is miserable. You fill out the same long form on ten
> different websites, you get ten phone calls, and you still don't know if you got a
> good deal. Americans overpay by billions every year because comparing quotes is
> just too painful to finish."

**[0:12–0:25] THE IDEA — one line**
> "QuotePilot fixes it with one form. You enter your details once — five quick steps —
> and in the background we pull quotes from *every* carrier in your state. They show up
> ranked, on our site, and in your inbox. One form, every carrier, best deal wins."

**[0:25–0:45] LIVE DEMO — the wizard** *(click along as you speak)*
> "Watch. I'm in Massachusetts — five steps: location, drivers, vehicle, coverage,
> contact. Smart defaults, no typing marathons… and done. The moment I hit submit, we
> fan out to twelve carriers in parallel — GEICO, Progressive, Allstate, Liberty Mutual,
> the agent-only carriers too — each on its own clock, so one slow carrier can't stall
> the page."

**[0:45–1:05] LIVE DEMO — the payoff**
> "Here they come — ranked cheapest first. Allstate at thirteen-forty-seven for six
> months… I can expand any card for the coverage breakdown, or open side-by-side compare.
> Notice the badges: agent-only carriers like Arbella route you to a real local agent
> with a tap-to-call number — we don't pretend every carrier sells direct. And the quotes
> just landed in my inbox too."

**[1:05–1:20] THE MOAT — why this wins**
> "Three things make this real, not a mockup. One: the adapter pattern — every carrier
> is a pluggable module, so real carrier APIs slot in without touching the UI. Two:
> state-aware everything — carrier lists, minimum coverages, and agent directories key
> off your state. Three: we instrument everything — every click feeds a live analytics
> dashboard with funnels and carrier win-rates."

**[1:20–1:30] THE CLOSE**
> "QuotePilot: one form, every carrier, zero hassle. Thank you."
> *(Hold on the ranked quotes screen. Smile. Stop talking.)*

**Delivery notes**

- Speak the numbers slowly ("thirteen-forty-seven") — judges remember prices.
- Never say "um" during the 0:25–1:05 demo window; narrate clicks *before* you click.
- If a beat runs long, cut the 1:05–1:20 moat to one sentence: "Pluggable carrier
  adapters, state-aware everything, full analytics." Then close.

## 2. Live demo flow (setup + clicks + fallbacks)

### Before the judges arrive

1. `bash scripts/dev.sh` from a clean checkout — verify three URLs print and the API
   health-check passes.
2. Open `http://localhost:5173` (web) and `http://localhost:5174` (dashboard) in two tabs.
3. Pre-run one quote job with the **sample profile** (`data/sample/profile.sample.json` —
   masked demo data) so the dashboard has events and you know current pricing.
4. Open the dashboard's *Carrier performance* tab — leave it as your "moat" visual.
5. Silence notifications. Full-screen the browser. Zoom to 125% so the back row reads prices.

### Click path (mirrors the script)

| Beat    | URL / action                                                        | What to say (short)                        |
| ------- | ------------------------------------------------------------------- | ------------------------------------------ |
| 0:25    | `localhost:5173` → "Get my quotes"                                  | "Five quick steps…"                        |
| 0:30    | Wizard steps 1–5 (use saved/sample profile, tab through quickly)    | "Smart defaults, minimal typing."          |
| 0:40    | Submit → watch progress "7 of 12 quotes ready"                      | "Twelve carriers, in parallel."            |
| 0:50    | Ranked cards appear → expand cheapest → open Compare                | "Ranked cheapest first. Side by side."     |
| 1:00    | Agents tab → tap-to-call button (don't actually call)               | "Agent-only carriers get real local agents." |
| 1:10    | Switch tab → `localhost:5174` dashboard                             | "Every click lands here — funnels, win-rates." |

### Fallback: if the API is slow on stage

- **Quotes trickling?** Narrate it as a feature: *"Watch — each carrier resolves on its
  own clock. The page never blocks."* The progress counter is your friend.
- **A carrier times out?** *"And there's the timeout handling — one slow carrier degrades
  its card, never the page."* (This is genuinely implemented; own it.)
- **API down entirely?** Pivot to the dashboard tab (it shows your pre-run data) and the
  pre-captured screenshots in `docs/VISUALS.md`. Say: *"Venue Wi-Fi — let me show you the
  instrumented run from this morning."* Never debug live on stage.
- **Email not arriving?** In dev the email is *logged*, not sent — say so upfront:
  *"In this demo build, delivery is logged to the console; production uses SMTP."*

## 3. Judge Q&A cheat sheet

**"Is the pricing real?"**
> "The pricing engine is real; today's adapters are simulations anchored to researched
> quotes — Allstate Massachusetts at $1,347 per six months for this coverage shape is a
> real data point from our research. The adapter interface is fixed, so real carrier APIs
> replace the simulation bodies with zero UI changes."

**"How does the simulation work?"**
> "One adapter per carrier implementing a shared `QuoteAdapter` interface. Each takes a
> sanitized rating profile — ZIP, vehicle class, coverage selections — and returns a
> six-month premium with latency tracking. They run in a bounded-concurrency background
> job with per-carrier timeouts, so results stream in as each carrier settles."

**"What about my personal data / security?"**
> "Three layers. Input is validated with zod on every API boundary. We never log PII,
> secrets, or raw payloads — the logger redacts them by pattern. And analytics stores
> only a salted hash of the session ID; the dashboard shows aggregates, never
> per-user data. Rate limiting, CSP headers, and dependency audits round it out —
> details are in `docs/SECURITY.md`."

**"Why not just use an existing aggregator?"**
> "Existing aggregators sell your phone number to lead-gen farms — that's their business
> model. QuotePilot is the comparison experience without the spam: quotes on-site and by
> email, agent directory for carriers that need a human, and full transparency on how
> each price was produced."

**"How do you handle states beyond Massachusetts?"**
> "Everything is state-aware by design: the carrier registry, minimum coverages, and
> agent directory all key off the user's state from JSON data files — no code changes to
> add a state. MA is fully seeded; NH, CA, and TX starter lists are in."

**"What breaks at scale?"**
> "Two things, both planned for. The in-process job queue becomes BullMQ + Redis when we
> need multiple API instances or restart-proof jobs — the queue interface doesn't change.
> And SQLite analytics moves to Postgres/ClickHouse past ~1M events/day with the summary
> endpoint contract untouched. See `docs/ARCHITECTURE.md` §4–5."

**"Who's the customer / how do you make money?"**
> "Consumers get it free — the wedge is the zero-hassle experience. Revenue paths we're
> exploring: featured placement for carriers (clearly labeled), agent-directory
> subscriptions for independent agencies, and white-label quote widgets for banks and
> auto marketplaces. No lead-gen spam, ever — that's the brand."
