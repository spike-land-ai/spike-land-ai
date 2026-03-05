export function TermsBuildPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 py-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">AI App Builder &mdash; Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: March 5, 2026</p>
        <p className="text-sm text-muted-foreground italic">
          This is a template for informational purposes. Consult with a qualified attorney for legal advice specific
          to your situation.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Service Description</h2>
        <p className="leading-relaxed text-foreground">
          The AI App Builder service (&ldquo;Service&rdquo;) is provided by spike.land (&ldquo;we&rdquo;,
          &ldquo;us&rdquo;, or &ldquo;our&rdquo;), operated by Zoltan Erdos, United Kingdom. Under this Service,
          we build a minimum viable product (&ldquo;MVP&rdquo;) web application consisting of up to three screens
          with a Model Context Protocol (&ldquo;MCP&rdquo;) backend. Work commences after you (&ldquo;Client&rdquo;)
          have submitted an approved project brief and payment has been received.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Deliverables</h2>
        <p className="leading-relaxed text-foreground">Upon completion, we will deliver:</p>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>A working, deployed web application (up to 3 screens) accessible via a public URL</li>
          <li>Full source code repository (GitHub or equivalent), transferred to the Client&rsquo;s account</li>
          <li>Technical documentation covering architecture, deployment steps, and environment variables</li>
          <li>MCP backend configuration and API endpoint documentation</li>
        </ul>
        <p className="leading-relaxed text-foreground">
          Deliverables are scoped to the agreed project brief. Features or screens outside the approved brief
          are not included and may be quoted separately.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Payment</h2>
        <p className="leading-relaxed text-foreground">
          The Service fee is &pound;1,997 (including applicable VAT where required by law), payable in full via
          Stripe before work begins. No work will commence until payment is confirmed. All prices are stated in
          GBP. By completing payment you authorise the charge to your nominated payment method.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Intellectual Property</h2>
        <p className="leading-relaxed text-foreground">
          Upon receipt of full payment and delivery of the final deliverables, all intellectual property rights
          in the application, source code, and documentation created specifically for your project transfer
          exclusively to the Client. spike.land retains no licence to use, reproduce, or distribute the delivered
          work after transfer, except as required to provide the 14-day warranty described in Section 8.
        </p>
        <p className="leading-relaxed text-foreground">
          spike.land retains ownership of any pre-existing libraries, frameworks, templates, or tooling
          incorporated into the deliverables that were not created specifically for this project. Such components
          are provided under their respective open-source licences, details of which will be included in the
          project documentation.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Revisions</h2>
        <p className="leading-relaxed text-foreground">
          One round of revisions is included within 7 days of delivery. A revision round means a consolidated
          set of changes submitted in a single written list. Additional revision rounds beyond the first are
          available at &pound;250 per round, invoiced before work begins on that round.
        </p>
        <p className="leading-relaxed text-foreground">
          Revisions are limited to adjustments within the original approved brief. Changes to scope, additional
          screens, or new features constitute a new engagement and will be quoted separately.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Timeline</h2>
        <p className="leading-relaxed text-foreground">
          We target delivery within 48 hours of brief approval. The 48-hour clock begins when we confirm in
          writing that the project brief is approved and payment has cleared. Delays caused by the Client
          (e.g., late provision of assets, credentials, or feedback) will pause the clock accordingly.
        </p>
        <p className="leading-relaxed text-foreground">
          The 48-hour timeline is a target, not a guarantee. Complex requirements may require additional time,
          and we will notify you promptly if an extension is needed.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Cancellation &amp; Refunds</h2>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>
            <strong>Before work starts:</strong> Full refund if cancellation is requested before brief approval
            is confirmed.
          </li>
          <li>
            <strong>Work in progress:</strong> 50% refund if cancellation is requested after work has commenced
            but before delivery. The partial deliverables produced to that point will be provided to the Client.
          </li>
          <li>
            <strong>After delivery:</strong> No refund is available once the final deliverables have been
            transferred to the Client.
          </li>
        </ul>
        <p className="leading-relaxed text-foreground">
          Refunds are processed via the original payment method within 5&ndash;10 business days.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">8. Warranty</h2>
        <p className="leading-relaxed text-foreground">
          We provide a 14-day bug fix warranty from the date of delivery. During this period, we will correct
          any defects that prevent the application from functioning as described in the approved brief, at no
          additional charge. The warranty does not cover issues arising from Client modifications, third-party
          service changes, or scope changes after delivery.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">9. Limitation of Liability</h2>
        <p className="leading-relaxed text-foreground">
          THE SERVICE IS PROVIDED ON A REASONABLE-EFFORTS BASIS. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE
          LAW, OUR TOTAL LIABILITY TO YOU ARISING OUT OF OR RELATED TO THE SERVICE SHALL NOT EXCEED THE SERVICE
          FEE PAID BY YOU (&pound;1,997). WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL,
          OR SPECIAL DAMAGES, INCLUDING LOSS OF PROFITS, LOSS OF DATA, OR BUSINESS INTERRUPTION, HOWEVER CAUSED.
        </p>
        <p className="leading-relaxed text-foreground">
          Nothing in these Terms limits liability for death or personal injury caused by negligence, fraud, or
          any other liability that cannot be excluded by English law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">10. Client Responsibilities</h2>
        <p className="leading-relaxed text-foreground">The Client agrees to:</p>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>Provide a clear, complete project brief prior to brief approval</li>
          <li>Supply any required assets, API keys, or third-party credentials promptly</li>
          <li>Ensure they have the rights to any content or materials provided to spike.land</li>
          <li>Not use the delivered application for unlawful purposes</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">11. Governing Law</h2>
        <p className="leading-relaxed text-foreground">
          These Terms are governed by the laws of England and Wales. Any dispute shall be subject to the
          exclusive jurisdiction of the courts of England and Wales.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">12. Contact</h2>
        <p className="leading-relaxed text-foreground">
          For questions about these Terms or the AI App Builder service, contact us at{" "}
          <a href="mailto:hello@spike.land" className="text-primary underline hover:text-primary/80">
            hello@spike.land
          </a>
          .
        </p>
      </section>
    </div>
  );
}
