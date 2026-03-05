export function TermsWorkshopPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 py-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">MCP Workshop &mdash; Terms &amp; Conditions</h1>
        <p className="text-sm text-muted-foreground">Last updated: March 5, 2026</p>
        <p className="text-sm text-muted-foreground italic">
          This is a template for informational purposes. Consult with a qualified attorney for legal advice specific
          to your situation.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Workshop Description</h2>
        <p className="leading-relaxed text-foreground">
          The MCP Workshop for Dev Teams (&ldquo;Workshop&rdquo;) is an interactive, live online session
          delivered by spike.land (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), operated by
          Zoltan Erdos, United Kingdom. Each Workshop runs for 2 hours and covers the Model Context Protocol
          (MCP) ecosystem, tool development, and integration patterns for software development teams.
        </p>
        <p className="leading-relaxed text-foreground">
          By registering for a Workshop, you (&ldquo;Attendee&rdquo; or &ldquo;Organiser&rdquo;) agree to
          be bound by these Terms and Conditions.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Format</h2>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>Duration: 2 hours, conducted live via video conference (platform provided upon booking)</li>
          <li>Delivery: online only</li>
          <li>Minimum attendees: 4 per session</li>
          <li>Maximum attendees: 8 per session</li>
          <li>Language: English</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Pricing</h2>
        <p className="leading-relaxed text-foreground">Two pricing options are available:</p>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>
            <strong>Per-seat pricing:</strong> &pound;497 per seat. A minimum of 4 seats must be booked per
            session. Maximum 8 seats per session.
          </li>
          <li>
            <strong>Team pricing:</strong> &pound;1,997 for a dedicated team session of up to 8 attendees.
          </li>
        </ul>
        <p className="leading-relaxed text-foreground">
          All prices are stated in GBP and are inclusive of applicable VAT where required by law. Payment is
          due in full via Stripe at the time of booking. The session will not be confirmed until payment clears.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Cancellation &amp; Rescheduling</h2>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>
            <strong>72 hours or more before the scheduled session:</strong> Full refund, or the option to
            reschedule to an alternative date at no charge.
          </li>
          <li>
            <strong>Less than 72 hours before the scheduled session:</strong> No refund. The Organiser may
            reschedule to one alternative date at no charge, subject to availability. This option may only be
            used once per booking.
          </li>
          <li>
            <strong>No-show:</strong> No refund and no rescheduling entitlement.
          </li>
        </ul>
        <p className="leading-relaxed text-foreground">
          Cancellation or rescheduling requests must be submitted in writing to{" "}
          <a href="mailto:hello@spike.land" className="text-primary underline hover:text-primary/80">
            hello@spike.land
          </a>
          . The request timestamp determines which policy applies. Refunds are processed via the original
          payment method within 5&ndash;10 business days.
        </p>
        <p className="leading-relaxed text-foreground">
          spike.land reserves the right to cancel a session if the minimum attendee threshold is not met.
          In that event, a full refund will be issued or an alternative date offered.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Recording Policy</h2>
        <p className="leading-relaxed text-foreground">
          Workshop sessions may be recorded by spike.land for quality assurance and to provide a reference
          recording to registered Attendees. Recordings are shared only with Attendees of that specific
          session and are not made publicly available, sold, or redistributed.
        </p>
        <p className="leading-relaxed text-foreground">
          Attendees must not record, screen-capture, or rebroadcast any part of the Workshop without prior
          written consent from spike.land. Unauthorised recording or redistribution is a breach of these Terms
          and may constitute infringement of intellectual property rights.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Intellectual Property</h2>
        <p className="leading-relaxed text-foreground">
          All Workshop materials, including but not limited to slides, code examples, exercises, documentation,
          and recordings, are and remain the intellectual property of spike.land or its licensors.
        </p>
        <p className="leading-relaxed text-foreground">
          Upon attendance and payment, each registered Attendee is granted a non-exclusive, non-transferable,
          personal-use licence to access and use the Workshop materials solely for their own professional
          development and internal team use. This licence does not permit:
        </p>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>Redistribution, sublicensing, or sale of materials to third parties</li>
          <li>Use of materials to deliver training or workshops to others</li>
          <li>Modification and republication of materials without written consent</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Completion Certificates</h2>
        <p className="leading-relaxed text-foreground">
          A digital completion certificate will be issued to each Attendee who participates in the full
          Workshop session. Certificates are issued within 5 business days of the session date and sent to
          the email address provided at registration.
        </p>
        <p className="leading-relaxed text-foreground">
          Certificates confirm attendance and completion only; they do not constitute a formal qualification
          or accreditation recognised by any regulatory or professional body.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">8. Code of Conduct</h2>
        <p className="leading-relaxed text-foreground">
          All Attendees are expected to engage respectfully with the instructor and other participants.
          spike.land reserves the right to remove any Attendee from a session for disruptive or inappropriate
          behaviour, without refund.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">9. Limitation of Liability</h2>
        <p className="leading-relaxed text-foreground">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, OUR TOTAL LIABILITY ARISING OUT OF OR RELATED
          TO A WORKSHOP SHALL NOT EXCEED THE AMOUNT PAID BY YOU FOR THAT SPECIFIC SESSION. WE SHALL NOT BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR SPECIAL DAMAGES, INCLUDING LOSS OF PROFITS
          OR BUSINESS INTERRUPTION.
        </p>
        <p className="leading-relaxed text-foreground">
          Nothing in these Terms limits liability for death or personal injury caused by negligence, fraud, or
          any other liability that cannot be excluded by English law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">10. Data Protection</h2>
        <p className="leading-relaxed text-foreground">
          Attendee contact information is collected solely to administer the Workshop booking, issue
          certificates, and share session materials. We process this data in accordance with our{" "}
          <a href="/privacy" className="text-primary underline hover:text-primary/80">
            Privacy Policy
          </a>{" "}
          and applicable data protection law, including the UK GDPR and the Data Protection Act 2018.
        </p>
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
          For questions about these Terms or to request a Workshop booking, contact us at{" "}
          <a href="mailto:hello@spike.land" className="text-primary underline hover:text-primary/80">
            hello@spike.land
          </a>
          .
        </p>
      </section>
    </div>
  );
}
