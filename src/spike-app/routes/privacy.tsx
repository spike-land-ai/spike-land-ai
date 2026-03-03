export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-gray-500">Last updated: March 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Information We Collect</h2>
        <p className="leading-relaxed text-gray-700">
          When you sign in via GitHub or Google, we receive your name, email address, and profile
          picture from the identity provider. We also collect basic usage analytics (page views,
          tool invocations) to improve the platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">How We Use Your Information</h2>
        <ul className="list-inside list-disc space-y-2 text-gray-700">
          <li>Authenticate you and maintain your session</li>
          <li>Display your profile within the platform</li>
          <li>Aggregate anonymous usage statistics</li>
          <li>Send important service-related notifications</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Data Storage</h2>
        <p className="leading-relaxed text-gray-700">
          Your data is stored on Cloudflare infrastructure. We do not sell your
          personal information to third parties. Application data you create (apps, tools, messages)
          is stored as long as your account is active.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Cookies</h2>
        <p className="leading-relaxed text-gray-700">
          We use essential cookies for authentication and session management. No third-party
          advertising cookies are used.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="leading-relaxed text-gray-700">
          For privacy-related questions, open an issue on our{" "}
          <a
            href="https://github.com/spike-land-ai"
            className="text-blue-600 underline hover:text-blue-800"
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
