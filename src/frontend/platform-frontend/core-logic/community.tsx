export function CommunityPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 py-8">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Community Guidelines</h1>
        <p className="text-lg text-muted-foreground">
          spike.land is built by and for its community. These guidelines help us maintain a
          welcoming, productive environment for everyone.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Code of Conduct</h2>
        <p className="leading-relaxed text-foreground">
          We are committed to providing a friendly, safe, and welcoming environment for all,
          regardless of experience level, gender identity, sexual orientation, disability, personal
          appearance, body size, race, ethnicity, age, religion, nationality, or similar
          characteristic.
        </p>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>Be kind and courteous to others</li>
          <li>Respect differing viewpoints and experiences</li>
          <li>Give and gracefully accept constructive feedback</li>
          <li>Focus on what is best for the community</li>
          <li>Show empathy towards other community members</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Contributing</h2>
        <p className="leading-relaxed text-foreground">
          We welcome contributions of all kinds: bug reports, feature requests, documentation
          improvements, and code contributions.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h3 className="font-semibold text-foreground">Bug Reports</h3>
            <p className="text-sm text-muted-foreground">
              Found a bug? Open an issue on GitHub with steps to reproduce.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h3 className="font-semibold text-foreground">Feature Requests</h3>
            <p className="text-sm text-muted-foreground">
              Have an idea? Start a discussion on GitHub Discussions.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h3 className="font-semibold text-foreground">Pull Requests</h3>
            <p className="text-sm text-muted-foreground">
              Fork the repo, make your changes, and submit a PR. We review all submissions.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h3 className="font-semibold text-foreground">Documentation</h3>
            <p className="text-sm text-muted-foreground">
              Help us improve docs, tutorials, and guides for the platform.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Support Channels</h2>
        <div className="space-y-3">
          <a
            href="https://github.com/spike-land-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <span className="font-semibold text-foreground">GitHub</span>
            <span className="text-sm text-muted-foreground">Issues, discussions, and code</span>
          </a>
          <a
            href="mailto:hello@spike.land"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <span className="font-semibold text-foreground">Email</span>
            <span className="text-sm text-muted-foreground">hello@spike.land</span>
          </a>
          <a
            href="/messages"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <span className="font-semibold text-foreground">Platform Messages</span>
            <span className="text-sm text-muted-foreground">
              Direct messaging within spike.land
            </span>
          </a>
          <a
            href="/docs"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <span className="font-semibold text-foreground">Documentation</span>
            <span className="text-sm text-muted-foreground">Guides, API docs, and tutorials</span>
          </a>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Token Reward Program</h2>
        <p className="leading-relaxed text-foreground">
          Active contributors earn spike tokens for their contributions. Tokens can be used for
          premium features, priority support, and platform credits.
        </p>
        <ul className="list-inside list-disc space-y-2 text-foreground ml-4">
          <li>
            <strong>Bug reports</strong> — 10 tokens for verified bugs
          </li>
          <li>
            <strong>Pull requests</strong> — 50-500 tokens based on complexity
          </li>
          <li>
            <strong>Documentation</strong> — 25 tokens per accepted contribution
          </li>
          <li>
            <strong>Community help</strong> — 5 tokens for helping others
          </li>
        </ul>
        <a
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          View Token Details
        </a>
      </section>
    </div>
  );
}
