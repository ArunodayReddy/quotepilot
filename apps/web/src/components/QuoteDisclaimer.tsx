import Link from "next/link";
import { SimBadge } from "./SimBadge";

/**
 * Prominent estimates-not-offers disclaimer for quote result surfaces.
 * Plain language: prices are estimates, not offers; final premium is the
 * carrier's underwriting alone. Always paired with the SimBadge while
 * adapters are simulations.
 */
export function QuoteDisclaimer() {
  return (
    <section
      className="glass quote-disclaimer"
      aria-labelledby="quote-disclaimer-heading"
      role="note"
    >
      <h2 id="quote-disclaimer-heading" className="quote-disclaimer-title">
        Estimates, not offers <SimBadge />
      </h2>
      <p>
        <strong>These are estimates, not offers of insurance.</strong> Every price on
        this page is simulated demo pricing — realistic bands anchored to real quote
        research, not real carrier offers. Nothing here is a binder, a contract, or a
        promise that a carrier will insure you.
      </p>
      <p>
        Your final premium — and whether coverage is available to you at all — is
        determined solely by the carrier&apos;s own underwriting when you apply with
        them directly. Always confirm the price and terms with the carrier before
        purchasing. Coverage requirements and availability vary by state;{" "}
        <Link href="/disclosures">read our insurance disclosures</Link>.
      </p>
    </section>
  );
}
