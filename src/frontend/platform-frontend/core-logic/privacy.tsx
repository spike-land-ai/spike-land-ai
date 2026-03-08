export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 py-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: March 4, 2026</p>
      </div>

      <p className="leading-relaxed text-foreground">
        This Privacy Policy explains how spike.land (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
        &ldquo;our&rdquo;) collects, uses, and protects your personal data when you use our platform
        at{" "}
        <a href="https://spike.land" className="text-primary underline hover:text-primary/80">
          spike.land
        </a>
        . We are committed to compliance with the General Data Protection Regulation (GDPR) and
        other applicable privacy laws.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Data We Collect</h2>
        <h3 className="font-medium text-foreground">Account data (via OAuth)</h3>
        <p className="leading-relaxed text-foreground">
          When you sign in with GitHub or Google, we receive your name, email address, profile
          picture URL, and a unique identifier from the identity provider. We do not receive or
          store your OAuth tokens beyond what is necessary for session management.
        </p>
        <h3 className="font-medium text-foreground mt-3">Usage data</h3>
        <p className="leading-relaxed text-foreground">
          We collect anonymised usage analytics: page views, route changes, and MCP tool
          invocations. This data is aggregated and cannot be used to identify you individually.
        </p>
        <h3 className="font-medium text-foreground mt-3">Payment data</h3>
        <p className="leading-relaxed text-foreground">
          Billing is handled entirely by{" "}
          <a
            href="https://stripe.com/privacy"
            className="text-primary underline hover:text-primary/80"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stripe
          </a>
          . We never see or store your full card number. We store only Stripe customer IDs and
          subscription status in our database.
        </p>
        <h3 className="font-medium text-foreground mt-3">Content data</h3>
        <p className="leading-relaxed text-foreground">
          Applications, code, messages, and other content you create on the Platform are stored in
          Cloudflare D1 and R2 and associated with your account.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Legal Basis for Processing (GDPR)</h2>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>
            <strong>Contract performance</strong> — to provide the services you signed up for
          </li>
          <li>
            <strong>Legitimate interests</strong> — to operate, improve, and secure the Platform
          </li>
          <li>
            <strong>Legal obligation</strong> — to comply with applicable laws and regulations
          </li>
          <li>
            <strong>Consent</strong> — for optional analytics cookies (where required by law)
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. How We Use Your Data</h2>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>Authenticate you and maintain your session</li>
          <li>Display your profile within the Platform</li>
          <li>Process subscription payments via Stripe</li>
          <li>Send important service-related notifications (no marketing without opt-in)</li>
          <li>Aggregate anonymous usage statistics to improve the Platform</li>
          <li>Investigate abuse reports and enforce our Terms of Service</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Data Storage and Security</h2>
        <p className="leading-relaxed text-foreground">
          Your data is stored on{" "}
          <a
            href="https://www.cloudflare.com/privacypolicy/"
            className="text-primary underline hover:text-primary/80"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cloudflare
          </a>{" "}
          infrastructure (Workers, D1, R2) distributed globally. Our infrastructure provider,
          Cloudflare, maintains SOC 2 Type II and ISO 27001 certifications. These certifications
          apply to Cloudflare's infrastructure, not to the spike.land application layer.
        </p>
        <p className="leading-relaxed text-foreground">
          We implement industry-standard security measures: HTTPS everywhere, session tokens stored
          in HttpOnly cookies, and least-privilege access controls for internal services. We do not
          sell your personal information to third parties.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Cookies</h2>
        <p className="leading-relaxed text-foreground">We use three categories of cookies:</p>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>
            <strong>Essential cookies</strong> — required for authentication and session management
            (cannot be disabled without breaking core functionality)
          </li>
          <li>
            <strong>Analytics cookies</strong> — anonymised, first-party usage tracking to improve
            the Platform (you can opt out via Settings)
          </li>
          <li>
            <strong>Advertising cookies</strong> — Google Ads conversion tracking to measure the
            effectiveness of our advertising campaigns (only loaded with your consent via
            &ldquo;Accept All&rdquo;)
          </li>
        </ul>
        <p className="leading-relaxed text-foreground">
          Advertising cookies are only set when you explicitly accept all cookies. You can withdraw
          consent at any time via Settings.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Third-Party Services</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-semibold text-foreground">Service</th>
                <th className="py-2 pr-4 font-semibold text-foreground">Purpose</th>
                <th className="py-2 font-semibold text-foreground">Privacy Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr>
                <td className="py-2 pr-4">Stripe</td>
                <td className="py-2 pr-4">Payment processing</td>
                <td className="py-2">
                  <a
                    href="https://stripe.com/privacy"
                    className="text-primary underline hover:text-primary/80"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    stripe.com/privacy
                  </a>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Cloudflare</td>
                <td className="py-2 pr-4">Hosting, CDN, DDoS protection</td>
                <td className="py-2">
                  <a
                    href="https://www.cloudflare.com/privacypolicy/"
                    className="text-primary underline hover:text-primary/80"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    cloudflare.com/privacypolicy
                  </a>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4">GitHub (OAuth)</td>
                <td className="py-2 pr-4">Authentication</td>
                <td className="py-2">
                  <a
                    href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
                    className="text-primary underline hover:text-primary/80"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub Privacy Statement
                  </a>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Google (OAuth)</td>
                <td className="py-2 pr-4">Authentication</td>
                <td className="py-2">
                  <a
                    href="https://policies.google.com/privacy"
                    className="text-primary underline hover:text-primary/80"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    policies.google.com/privacy
                  </a>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Google Ads</td>
                <td className="py-2 pr-4">Advertising conversion tracking</td>
                <td className="py-2">
                  <a
                    href="https://policies.google.com/technologies/ads"
                    className="text-primary underline hover:text-primary/80"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Ads Privacy
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Data Retention</h2>
        <p className="leading-relaxed text-foreground">
          We retain your personal data for as long as your account is active. If you delete your
          account, we will delete or anonymise your personal data within 30 days, except where we
          are required to retain it for legal or compliance reasons (e.g., payment records for 7
          years under UK tax law).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">8. Your Rights (GDPR)</h2>
        <p className="leading-relaxed text-foreground">
          If you are located in the European Economic Area or the UK, you have the following rights:
        </p>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>
            <strong>Access</strong> — request a copy of the personal data we hold about you
          </li>
          <li>
            <strong>Rectification</strong> — request correction of inaccurate data
          </li>
          <li>
            <strong>Erasure</strong> — request deletion of your data (&ldquo;right to be
            forgotten&rdquo;)
          </li>
          <li>
            <strong>Portability</strong> — receive your data in a machine-readable format
          </li>
          <li>
            <strong>Objection</strong> — object to processing based on legitimate interests
          </li>
          <li>
            <strong>Restriction</strong> — request that we limit how we use your data
          </li>
        </ul>
        <p className="leading-relaxed text-foreground">
          To exercise any of these rights, contact us at{" "}
          <a
            href="mailto:zoltan.erdos@spike.land"
            className="text-primary underline hover:text-primary/80"
          >
            zoltan.erdos@spike.land
          </a>
          . We will respond within 30 days.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">9. Breach Notification</h2>
        <p className="leading-relaxed text-foreground">
          In the event of a data breach affecting your personal data, we will notify affected users
          within 72 hours in accordance with GDPR Article 33. We will also notify the relevant
          supervisory authority where required. Notifications will include the nature of the breach,
          likely consequences, and the measures taken to address it.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">10. California Privacy Rights (CCPA/CPRA)</h2>
        <p className="leading-relaxed text-foreground">
          If you are a California resident, the California Consumer Privacy Act (CCPA) and
          California Privacy Rights Act (CPRA) provide you with the following rights:
        </p>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>
            <strong>Right to Know</strong> — you may request that we disclose the categories and
            specific pieces of personal information we have collected about you, the categories of
            sources, the business purpose for collecting it, and the categories of third parties
            with whom we share it
          </li>
          <li>
            <strong>Right to Delete</strong> — you may request that we delete the personal
            information we have collected from you, subject to certain exceptions
          </li>
          <li>
            <strong>Right to Opt-Out</strong> — you have the right to opt out of the sale or sharing
            of your personal information. We do not sell your personal information
          </li>
          <li>
            <strong>Right to Non-Discrimination</strong> — we will not discriminate against you for
            exercising any of your CCPA/CPRA rights
          </li>
        </ul>
        <p className="leading-relaxed text-foreground">
          To exercise any of these rights, contact us at{" "}
          <a
            href="mailto:zoltan.erdos@spike.land"
            className="text-primary underline hover:text-primary/80"
          >
            zoltan.erdos@spike.land
          </a>
          . We will verify your identity before processing your request and respond within 45 days.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">11. Children&rsquo;s Privacy</h2>
        <p className="leading-relaxed text-foreground">
          The Platform is not directed to children under 13. We do not knowingly collect personal
          data from children. If you believe a child has provided us with personal data, please
          contact us and we will delete it promptly.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">12. Changes to This Policy</h2>
        <p className="leading-relaxed text-foreground">
          We may update this Privacy Policy periodically. We will notify you of significant changes
          via email or an in-app notice at least 14 days before they take effect.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">13. Contact & Data Protection Officer</h2>
        <p className="leading-relaxed text-foreground">
          For privacy questions or to exercise your rights, email our Data Protection Officer (DPO)
          at{" "}
          <a
            href="mailto:zoltan.erdos@spike.land"
            className="text-primary underline hover:text-primary/80"
          >
            zoltan.erdos@spike.land
          </a>{" "}
          or open an issue on our{" "}
          <a
            href="https://github.com/spike-land-ai"
            className="text-primary underline hover:text-primary/80"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub organization
          </a>
          .
        </p>
      </section>
    </div>
  );
}
