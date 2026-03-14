import { useEffect } from "react";
import { trackAnalyticsEvent } from "../hooks/useAnalytics";

export function WorkshopPage() {
  const success =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("success")
      : null;

  useEffect(() => {
    trackAnalyticsEvent("workshop_page_view", { page: "/workshop" });
  }, []);

  return (
    <div className="rubik-container rubik-page rubik-stack">
      {/* Success Banner */}
      {success && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-primary/20 bg-primary/8 p-4 text-center text-sm font-bold text-primary"
        >
          Thank you for purchasing an MCP Workshop seat! We&apos;ll send your access details within
          24h.
        </div>
      )}

      {/* Hero */}
      <section
        className="rubik-panel-strong space-y-6 p-6 text-center sm:p-10"
        aria-labelledby="workshop-hero-heading"
      >
        <div className="space-y-4">
          <span className="rubik-eyebrow">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Live Workshop
          </span>

          <div className="space-y-3">
            <h1
              id="workshop-hero-heading"
              className="text-4xl font-semibold tracking-[-0.06em] text-foreground sm:text-5xl"
            >
              MCP Workshop
            </h1>
            <p className="rubik-lede mx-auto">
              Build production MCP servers from scratch. Hands-on, live, with real deployment to
              Cloudflare Workers.
            </p>
          </div>
        </div>
      </section>

      {/* What You'll Learn */}
      <section aria-labelledby="workshop-learn-heading">
        <div className="mb-6 text-center space-y-2">
          <span className="rubik-eyebrow">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Curriculum
          </span>
          <h2
            id="workshop-learn-heading"
            className="text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl"
          >
            What you&apos;ll build
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "MCP Server Fundamentals",
              description:
                "Zod schemas, tool handlers, and the JSON-RPC protocol that connects your tools to any AI client.",
            },
            {
              title: "Cloudflare Workers Deployment",
              description:
                "D1 databases, R2 storage, Durable Objects — deploy a production MCP server at the edge.",
            },
            {
              title: "Auth & Billing",
              description:
                "Better Auth integration, credit systems, and Stripe checkout for paid tool access.",
            },
            {
              title: "App Store Publishing",
              description:
                "Package your tools as a spike.land app with metadata, discovery, and install flows.",
            },
          ].map(({ title, description }) => (
            <div key={title} className="rubik-panel p-5">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="rubik-panel p-6 sm:p-8 text-center" aria-labelledby="workshop-pricing">
        <h2
          id="workshop-pricing"
          className="mb-4 text-2xl font-semibold tracking-[-0.04em] text-foreground"
        >
          Seats
        </h2>

        <div className="grid gap-6 sm:grid-cols-2 max-w-2xl mx-auto">
          <div className="rubik-panel p-5 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Individual
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-foreground">$4.97</p>
            <p className="mt-2 text-sm text-muted-foreground">
              One seat. Full workshop access + recording.
            </p>
          </div>

          <div className="rubik-panel-strong p-5 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Team (up to 5)
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-foreground">$19.97</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Five seats. Full access + team Slack channel.
            </p>
          </div>
        </div>

        <a
          href="mailto:hello@spike.land?subject=MCP%20Workshop%20Interest"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all duration-200"
        >
          Reserve your seat
        </a>

        <p className="mt-4 text-xs text-muted-foreground">
          Next cohort dates announced via email. Response within 24h.
        </p>
      </section>
    </div>
  );
}
