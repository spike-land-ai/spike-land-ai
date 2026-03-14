export function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 py-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: March 4, 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
        <p className="leading-relaxed text-foreground">
          By accessing or using spike.land (the &ldquo;Platform&rdquo;), you agree to be bound by
          these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to all Terms, you may
          not use the Platform. These Terms constitute a legally binding agreement between you and
          SPIKE LAND LTD, a company registered in England and Wales (company number 16906682), whose
          registered address is Brighton, UK (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
          &ldquo;our&rdquo;).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Eligibility</h2>
        <p className="leading-relaxed text-foreground">
          You must be at least 13 years old to use spike.land. If you are under 18, you represent
          that a parent or guardian has reviewed and agreed to these Terms on your behalf. By using
          the Platform you represent that you have the legal capacity to enter into this agreement.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Subscription Billing</h2>
        <p className="leading-relaxed text-foreground">
          Paid plans (Pro and Business) are billed on a monthly recurring basis via Stripe. By
          subscribing, you authorise us to charge your payment method at the beginning of each
          billing period. Prices are displayed in USD (Pro: $29/mo, Business: $99/mo) and are
          subject to change with 30 days&rsquo; notice.
        </p>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>
            You may cancel your subscription at any time from the Settings &rarr; Billing page.
          </li>
          <li>
            Cancellation takes effect at the end of the current billing period; no prorated refunds
            are issued.
          </li>
          <li>
            We reserve the right to suspend access for unpaid invoices after a 7-day grace period.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Acceptable Use</h2>
        <p className="leading-relaxed text-foreground">You agree not to:</p>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>
            Use the Platform to generate, store, or transmit unlawful, harmful, or abusive content
          </li>
          <li>
            Attempt to reverse-engineer, scrape, or disrupt the Platform or its infrastructure
          </li>
          <li>Resell or sublicense API access or MCP tools without our written consent</li>
          <li>Use automated means to create accounts or circumvent rate limits</li>
          <li>Violate any applicable laws, regulations, or third-party rights</li>
        </ul>
        <p className="leading-relaxed text-foreground">
          Automated access is permitted only through our published APIs and MCP tool interfaces.
          Abuse may result in immediate account suspension without refund.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Intellectual Property</h2>
        <p className="leading-relaxed text-foreground">
          You retain full ownership of applications, code, and content you create using the
          Platform. By publishing an application to the App Store, you grant spike.land a worldwide,
          non-exclusive, royalty-free licence to display, distribute, and promote it within the
          Platform solely for the purpose of operating the store. You may remove your application
          from the store at any time.
        </p>
        <p className="leading-relaxed text-foreground">
          All Platform code, trademarks, logos, and documentation not created by users remain the
          exclusive property of spike.land or its licensors.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Privacy</h2>
        <p className="leading-relaxed text-foreground">
          Your use of the Platform is also governed by our{" "}
          <a href="/privacy" className="text-primary underline hover:text-primary/80">
            Privacy Policy
          </a>
          , which is incorporated into these Terms by reference.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Limitation of Liability</h2>
        <p className="leading-relaxed text-foreground">
          THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
          IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA, REVENUE,
          OR PROFITS, ARISING FROM YOUR USE OF OR INABILITY TO USE THE PLATFORM.
        </p>
        <p className="leading-relaxed text-foreground">
          Our total liability to you for any claim arising out of or related to these Terms shall
          not exceed the amount you paid us in the 12 months preceding the event giving rise to the
          claim.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">8. Termination</h2>
        <p className="leading-relaxed text-foreground">
          We may suspend or terminate your account at any time for violation of these Terms, or for
          any reason with 30 days&rsquo; notice. Upon termination, your right to use the Platform
          ceases immediately. Sections 5, 7, and 9 survive termination.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">9. Governing Law</h2>
        <p className="leading-relaxed text-foreground">
          These Terms are governed by the laws of England and Wales. Any dispute shall be subject to
          the exclusive jurisdiction of the courts of England and Wales.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">10. Changes to Terms</h2>
        <p className="leading-relaxed text-foreground">
          We may update these Terms from time to time. We will notify you of material changes via
          email or an in-app banner at least 14 days before they take effect. Continued use of the
          Platform after the effective date constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">11. Contact</h2>
        <p className="leading-relaxed text-foreground">
          Questions about these Terms? Open an issue on our{" "}
          <a
            href="https://github.com/spike-land-ai"
            className="text-primary underline hover:text-primary/80"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub organization
          </a>{" "}
          or email us at{" "}
          <a
            href="mailto:hello@spike.land"
            className="text-primary underline hover:text-primary/80"
          >
            hello@spike.land
          </a>
          .
        </p>
      </section>
    </div>
  );
}
