# QuotePilot — Compliance Model (v0.7.0)

> **Not legal advice.** This document records how QuotePilot is designed to stay on
> the right side of U.S. insurance, telemarketing, email, and privacy rules. It is a
> product-compliance posture, not a legal opinion. Every regulatory claim below
> carries a source. If a rule changes, update this file and the surfaces it governs.

Last reviewed: 2026-10-08 · Scope: U.S. demo build, 50-state carrier registries.

---

## 1. What QuotePilot is — and isn't

**QuotePilot is a comparison / lead-generation website.** It lets a visitor enter
details once, see simulated demo pricing from carriers that serve their state, and
ask to be notified by email when quotes are ready. It also lists local independent
agents with sample (555-01xx) contact data clearly badged as sample data.

**QuotePilot is NOT:**

- an insurance company (it underwrites nothing, issues no policies);
- a licensed insurance producer / agent / broker (it sells nothing, takes no
  applications, binds no coverage, collects no premiums);
- a source of real binding quotes in this demo build (all prices are simulated).

Because of this, two hard rules apply across the whole product:

1. **Never hold out as an insurer or producer.** No page, email, or ad may say or
   imply that QuotePilot sells insurance, is licensed to sell insurance, or issues
   policies. The footer on every page carries the plain-language disclaimer:
   *"QuotePilot is not an insurance company or licensed insurance producer."*
2. **Estimates, not offers.** Every price shown is an *estimate*, never an offer
   of insurance. The final premium — and whether coverage is available at all — is
   determined solely by the carrier's underwriting when the customer applies
   directly. This "estimates not offers" doctrine is the standard consumer-protection
   posture for quote-aggregator sites and is enforced by the "estimates, not offers"
   disclosure adjacent to every price on quote surfaces, plus the non-negotiable
   "Simulated — demo pricing" badge (CONTEXT.md rule).

**What we must never claim (claims audit, v0.7.0):**

- ❌ "The best deal" / "best price" as a guarantee — reworded to *compare* language.
- ❌ Savings figures unless computed from real results on the page (already a
  product rule; re-verified in v0.7.0).
- ❌ Any implication that a displayed price is locked, binding, or available to
  every driver.
- ❌ Carrier availability beyond what the registry says (agent-channel carriers
  degrade honestly; `available:false` excluded).
- ❌ "Licensed", "insured by us", "we underwrite", or any agency/producer language.

---

## 2. State insurance notes (bullet-grade, sourced)

Rendered on the results page as a "Good to know in {state}" panel from
`data/disclosures/<STATE>.json`. MA, TX, CA, NH are seeded; unknown states degrade
gracefully (no panel). These are *educational notes*, not coverage advice — the
panel says so.

### Massachusetts

- **Safe Driver Insurance Plan (SDIP).** MA premiums move with the driver's record
  through the SDIP merit-rating system: surchargeable at-fault accidents and traffic
  violations add merit-rating points, tracked by the Merit Rating Board under
  211 CMR 134.00; a clean record earns an excellent-driver credit.
  Sources: [mass.gov — 211 CMR 134.00](https://stage.mass.gov/doc/safe-driver-insurance-and-merit-rating-plans/download);
  [SDIP explainer](https://www.hcandcinsurance.com/blog/how-massachusetts-safe-driver-insurance-plan-sdip-affects-your-premium).
- **Mandatory PIP.** MA is a no-fault state; every policy must carry at least
  **$8,000** in Personal Injury Protection, which pays medical expenses and lost
  wages regardless of fault.
  Source: [Experian — MA car insurance 2026](http://experian.com/blogs/ask-experian/average-cost-car-insurance-massachusetts/).
- **Minimum liability.** MA drivers must carry at least 25/50/50 bodily-injury
  liability, $30,000 property damage, and $8,000 PIP.
  Source: same Experian guide.
- **Banned rating factors.** MA insurers may not use credit-based insurance scores,
  gender, marital or homeownership status when setting premiums; age may be used
  only to give a discount at 65.
  Source: same Experian guide; also: CA, HI, MA, MI prohibit credit-based scoring
  per [NAIC-linked guidance](http://shieldandstrategy.blogspot.com/2026/09/fico-score-auto-insurance-rate-impact.html).

### California

- **Proposition 103 (1988).** CA requires the Insurance Commissioner to review and
  approve auto-insurance rate changes *before* they take effect (prior approval).
  Source: [CA Legislative Analyst's Office](https://lao.ca.gov/ballot/2011/110461.pdf).
- **Mandatory rating factors, in order.** Premiums must be based primarily on (1)
  driving safety record, (2) annual miles driven, (3) years of driving experience.
  Source: [Consumer Watchdog — Prop 103 background](https://consumerwatchdog.org/in-the-news/background-insurance-reform-detailed-analysis-california-proposition-103/).
- **20% Good Driver Discount.** Insurers must sell a Good Driver Discount policy —
  at least 20% below the rate otherwise charged — to qualifying drivers (3 years
  licensed, ≤1 moving violation, no at-fault injury accidents, no DUI in 7 years).
  Source: [Consumer Watchdog — 20% discount](https://consumerwatchdog.org/insurance/20-good-driver-discount/).
- **Banned rating factors.** Credit-based insurance scores may not be used in CA
  auto rating; territorial (ZIP-based) rating is restricted.
  Sources: CA DOI practice via [consumerwatchdog](https://consumerwatchdog.org/insurance/20-good-driver-discount/);
  credit ban via [NAIC-linked guidance](http://shieldandstrategy.blogspot.com/2026/09/fico-score-auto-insurance-rate-impact.html).

### Texas

- **File-and-use rates.** TX personal-auto insurers file rates with the Texas
  Department of Insurance and may use them immediately; TDI reviews after the fact
  and can disapprove rates that are inadequate, excessive, or unfairly
  discriminatory. (TDI Commissioner asked lawmakers in Sept 2026 to consider a
  buffer period before new rates take effect.)
  Sources: [TDI Filings Made Easy Guide, May 2025](https://www.tdi.texas.gov/pubs/pc/fmeguide0525.pdf);
  [Live Insurance News, Sept 2026](https://www.liveinsurancenews.com/texas-is-one-of-23-states-where/8576386/).
- **Forms need prior approval.** Policy forms and endorsements must be approved by
  TDI before use; rates are file-and-use.
  Source: TDI Filings Made Easy Guide.
- **Competition is the main rate regulator** in a file-and-use system, which is why
  comparing multiple carriers matters in Texas.

### New Hampshire

- **Insurance not statutorily required.** NH is the only U.S. state where auto
  insurance is not required by statute; a financial-responsibility law applies
  instead (drivers who cause accidents must be able to pay).
  Sources: [WSJ Buy Side](https://www.wsj.com/buyside/personal-finance/auto-insurance/cheap-car-insurance-new-hampshire);
  [MoneyGeek](https://www.moneygeek.com/insurance/auto/best-car-insurance-in-new-hampshire/).
- **If you buy, minimums are 25/50/25** ($25k BI per person / $50k per accident /
  $25k property damage), plus **$1,000 MedPay** and **25/50 uninsured-motorist**
  coverage.
  Sources: [insurance.com — NH guide](https://www.insurance.com/auto-insurance/new-hampshire-car-insurance-guide/);
  [insurance.com — NH laws](https://www.insurance.com/auto-insurance/new-hampshire-car-insurance-laws/).

---

## 3. TCPA — telemarketing / text consent posture

QuotePilot's demo build does not place marketing calls or texts. It collects a
phone number (carriers may need it) and offers an **optional** marketing-contact
consent checkbox. The consent capture is built to TCPA prior-express-written-
consent standards so the posture is correct if phone sharing ever goes live:

- **Clear and conspicuous written agreement.** The checkbox sits directly above the
  phone field's use, names who may call/text ("QuotePilot and the insurance
  carriers and licensed agents shown with your quotes"), states the number the
  user provided will be used, and discloses that calls/texts may use automated
  dialing or prerecorded messages. A signed written agreement authorizing the
  seller and the number is the core of "prior express written consent" under
  47 CFR §64.1200(f).
  Source: [FCC final rule on consent](https://www.insidearm.com/news/00094180-fccs-final-rule-on-consent-kills-one-to-o/).
- **Unchecked by default.** Pre-checked consent boxes do not evidence a signature;
  the checkbox starts unchecked and only the user's click records consent.
  Source: [TermsFeed TCPA consent guide](https://www.termsfeed.com/blog/sms-marketing-consent/).
- **Not a condition of purchase.** The label states plainly: "Consent is not a
  condition of getting quotes or purchasing insurance." Required by 47 CFR
  §64.1200(f)(i) disclosure rules.
  Source: same FCC rule summary.
- **One-to-one rule status.** The FCC's Dec 2023 one-to-one consent rule (each
  seller needing separate consent on comparison sites) was **vacated by the
  Eleventh Circuit on Jan 24, 2025** in *Insurance Marketing Coalition v. FCC*;
  the FCC deleted the vacated language and reinstated the prior rules (final rule,
  April 2025). As of 2026 the standard is prior express written consent without the
  one-to-one constraint — but consent must still be "clearly and unmistakably
  stated," which is why our checkbox names the caller class explicitly.
  Sources: [compliancehub.wiki](https://compliancehub.wiki/tcpa-2026-consent-revocation-one-to-one-rule-vacated-compliance/);
  [Thompson Coburn](https://www.thompsoncoburn.com/insights/one-to-one-is-done-the-eleventh-circuit-scraps-the-fccs-new-consent-rule-under-the-tcpa-inviting-future-challenges-to-written-consent-altogether/).
- **Audit trail.** Consent choices (`emailOptIn`, `phoneOptIn`) persist with the
  quote request and are logged as booleans (no PII in logs, per CONTEXT.md rule 5).
  Evidence should include the exact consent language, timestamp, and source — the
  checkbox label is versioned in copy if it changes.

---

## 4. CAN-SPAM — quote-delivery email posture

Quote emails are **user-requested** (the user asked for their quotes), so they are
relationship/transactional in character — but the posture treats them as commercial
anyway, so the checklist is explicit:

1. **Accurate headers** — From name/address must identify QuotePilot; no deceptive
   subject lines ("Your QuotePilot quotes are ready" describes the content).
2. **Physical postal address** — every send carries the sender's valid postal
   address in the footer, from the `SENDER_POSTAL_ADDRESS` env var. **Production
   sends are blocked until this is configured** — a clearly-marked placeholder is
   used in dev, never invented business data.
3. **Opt-out mechanism** — every email includes "Reply STOP / unsubscribe" handling;
   opt-outs honored within 10 business days.
4. **No harvested lists** — recipients are only people who requested quotes.

Sources: [FTC/CAN-SPAM summary (Congress.gov)](https://www.congress.gov/committee-report/108th-congress/senate-report/102/1);
[practical CAN-SPAM checklist](https://mailfloss.com/can-spam-act-compliance/).

---

## 5. Privacy posture (CCPA/CPRA-informed)

QuotePilot is a demo build with no real PII (CONTEXT.md rule 11), but the privacy
policy and product are written as if the law applies — the habits transfer:

- **Notice at collection.** The wizard contact step links the privacy policy and
  states what is collected and why before the user submits.
- **Categories + purposes.** The policy lists exactly what is collected (contact
  details, driver/vehicle/coverage inputs, quote results, analytics events) and
  the purpose of each (generating quotes, delivering them, improving the product).
- **No sale of personal data.** "No personal data is sold or shared" is a footer
  and policy commitment. Lead-gen businesses commonly sell data; QuotePilot does
  not, and says so plainly.
- **Rights.** Know / delete / correct / opt-out of sharing / non-discrimination —
  exercisable via the contact in the privacy policy. Analytics uses hashed session
  IDs; email-like patterns are dropped on write (CONTEXT.md rule).
- **Retention.** Quote job data is retained only as long as needed to serve quotes;
  localStorage wizard data stays on the user's device and is cleared on submit.

Sources for the checklist shape:
[CCPA/CPRA checklist](https://github.com/mattakushi432/claude-code-skills-custom-devtools-pack/blob/HEAD/plugins/devtools-pack/skills/ccpa-checklist/SKILL.md);
[legal-skills CCPA](https://github.com/thomasmoreai/legal-skills-open/blob/HEAD/us/data-protection/skills/ccpa/SKILL.md).

---

## 6. What changes when this goes live

This compliance posture is for the demo. Before production:

- [ ] Engage insurance counsel in each launch state (lead-gen licensing questions
  vary by state; some states require lead-gen registration).
- [ ] Confirm carrier/agent partners' consent and TCPA indemnities in writing.
- [ ] Set `SENDER_POSTAL_ADDRESS` and implement real unsubscribe handling.
- [ ] Replace sample agent data with real, permissioned listings.
- [ ] Re-verify every state disclosure note against the current DOI guidance.

## 7. Attorney review required — NOT legal advice

Nothing in this document, the Terms of Service, the Privacy Policy, or the
Insurance Disclosures page is legal advice. All of it is a good-faith product
draft written without counsel. **Do not operate QuotePilot commercially until a
licensed attorney has reviewed it.** The top items counsel must opine on:

1. **Producer/lead-gen licensing, state by state.** Whether operating an
   insurance-comparison and lead-generation website requires a producer license,
   lead-generator registration, or appointments in each launch state — and whether
   the current "we are not a producer" posture holds once real carrier data and
   paid placements exist.
2. **TCPA/telemarketing exposure.** Review of the phone/email consent flows,
   carrier/agent data-sharing agreements, and indemnities before any phone number
   is shared with a third party or any marketing call/text is placed.
3. **Terms enforceability and privacy-law coverage.** Whether the Terms of
   Service are enforceable as drafted (browsewrap vs. clickwrap), and whether the
   Privacy Policy satisfies CCPA/CPRA and other applicable state privacy laws for
   a production data footprint (which will be larger than this demo's).

### Pre-launch legal checklist

- [ ] Attorney sign-off on Terms of Service, Privacy Policy, and Insurance
  Disclosures (final versions, not drafts).
- [ ] Producer licensing determination per launch state; registrations filed
  where required.
- [ ] Written data-sharing + TCPA indemnity agreements with every carrier/agent
  partner that receives user data.
- [ ] CAN-SPAM: `SENDER_POSTAL_ADDRESS` configured; one-click unsubscribe +
  10-day opt-out honoring implemented and tested.
- [ ] Cookie consent reviewed against applicable state privacy laws (opt-in vs.
  opt-out regimes).
- [ ] State DOI advertising rules reviewed for quote-advertising claims
  (no "best price" guarantees; savings claims substantiated).
- [ ] Data-broker registration analysis (some states require registration for
  businesses that sell/share personal data — QuotePilot does not sell, but
  counsel should confirm the analysis).
- [ ] Incident-response plan and breach-notification procedures documented.
- [ ] State minimum-coverage data re-verified against current DOI guidance
  (minimums change — e.g., MA 2026, VA 2025, TN 2023).
