import { useState, useEffect } from "react";
import { trackAnalyticsEvent } from "../hooks/useAnalytics";
import { trackGoogleAdsEvent, trackMigrationConversion } from "../../core-logic/google-ads";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TierId = "blog-post" | "script" | "mcp-server";

interface MigrationTier {
  id: TierId;
  eyebrow: string;
  name: string;
  price: string;
  currency: string;
  timeline: string;
  description: string;
  deliverable: string;
  deliverableLabel: string;
  includes: string[];
  cta: string;
  highlighted: boolean;
  badge?: string;
}

interface WhyCard {
  icon: string;
  title: string;
  before: string;
  after: string;
}

interface FaqEntry {
  question: string;
  answer: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const TIERS: MigrationTier[] = [
  {
    id: "blog-post",
    eyebrow: "Tier 1",
    name: "The Blog Post",
    price: "$420",
    currency: "USD",
    timeline: "2 weeks",
    description:
      "Gian Pier migrates all 8 of his Next.js projects and writes a brutally honest account of what actually happened.",
    deliverable: "Published MDX post on spike.land/blog",
    deliverableLabel: "Deliverable",
    includes: [
      "Step-by-step migration diary for all 8 projects",
      "Before/after build time benchmarks",
      "Real cost comparison: Vercel bill vs. Cloudflare Workers",
      "Gotchas, surprises, and workarounds documented",
      "Open questions and unresolved edge-cases — no sugar-coating",
    ],
    cta: "Commission the Blog Post",
    highlighted: false,
  },
  {
    id: "script",
    eyebrow: "Tier 2",
    name: "The Script",
    price: "£1,000",
    currency: "GBP",
    timeline: "4 weeks",
    description:
      "Gian Pier turns the migration patterns into a reusable CLI that saves the next person from doing this by hand.",
    deliverable: "Open-source CLI on npm",
    deliverableLabel: "Deliverable",
    includes: [
      "Automated Next.js page/app router → TanStack Start route conversion",
      "Config migration: next.config.js → vite.config.ts",
      "Build pipeline setup with Cloudflare Workers target",
      "CI template (GitHub Actions) included",
      "Published under MIT on npm — community-owned forever",
    ],
    cta: "Fund the Script",
    highlighted: false,
  },
  {
    id: "mcp-server",
    eyebrow: "Tier 3",
    name: "The MCP Server",
    price: "$10,000",
    currency: "USD",
    timeline: "8 weeks",
    description:
      "Point it at any GitHub repo. Get back a migration PR with a full diff preview. No babysitting required.",
    deliverable: "Production MCP tool on spike.land marketplace",
    deliverableLabel: "Deliverable",
    includes: [
      "Takes any GitHub project URL as input",
      "AST-based route transformation — handles edge cases the script can't",
      "Automatic dependency remapping (next/* → TanStack equivalents)",
      "Cloudflare Workers wrangler.toml generation",
      "Opens a real PR against your repo with annotated diff preview",
      "Listed on spike.land marketplace — usable by anyone",
    ],
    cta: "Sponsor the MCP Server",
    highlighted: true,
    badge: "Best Value",
  },
];

const WHY_CARDS: WhyCard[] = [
  {
    icon: "⚡",
    title: "Build Speed",
    before: "40+ min from PR to deploy — builds queuing in Vercel CI",
    after: "~4 seconds with Vite + esbuild on Cloudflare",
  },
  {
    icon: "$",
    title: "Cost",
    before: "$75.40/month — 98.5% is build minutes",
    after: "$0 on Cloudflare Workers free tier",
  },
  {
    icon: "📦",
    title: "Portability",
    before: "Locked into Vercel's serverless runtime",
    after: "Standard Web APIs — runs anywhere",
  },
  {
    icon: "🧩",
    title: "Simplicity",
    before: "Server components, RSC, App Router complexity",
    after: "Plain React + file-based routing that makes sense",
  },
];

const FAQ_ITEMS: FaqEntry[] = [
  {
    question: "Will my Next.js API routes survive the migration?",
    answer:
      "Yes — but they become Cloudflare Workers handlers instead of Vercel serverless functions. The patterns map cleanly. The blog post documents every API route pattern Gian Pier encountered across his 8 projects and how each one translated.",
  },
  {
    question: "What about next/image, next/font, and other Next.js built-ins?",
    answer:
      "Most have drop-in equivalents. next/image becomes standard <img> with Cloudflare Image Resizing. next/font is just CSS. The trickier ones (ISR, on-demand revalidation) require a rethink — the blog post covers exactly which assumptions need to change.",
  },
  {
    question: "How long does a single project migration actually take?",
    answer:
      "Gian Pier's 8 projects ranged from a couple of hours to two full days. Small sites with no API routes: fast. Projects leaning on Next.js ISR or complex middleware: slower. The blog post breaks this down per project so you can estimate your own before committing.",
  },
  {
    question: "Is TanStack Start production-ready?",
    answer:
      "Yes. It's the same TanStack Router most of us have already been running in production, with a server layer added on top. The spike.land platform itself runs on this stack — this marketing page included.",
  },
  {
    question: "What if I want to fund Tier 2 or 3 but you haven't shipped Tier 1 yet?",
    answer:
      "Commission the blog post first. It's $420 and it produces the knowledge base that everything else is built on top of. Funding tiers out of order would mean the script and MCP server get built without the real-world data they need to be good.",
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function TierCard({ tier }: { tier: MigrationTier }) {
  function handleCta() {
    trackAnalyticsEvent("migration_interest", {
      tier: tier.id,
      price: tier.price,
      currency: tier.currency,
    });
    const tierMap: Record<TierId, "blog" | "script" | "mcp"> = {
      "blog-post": "blog",
      script: "script",
      "mcp-server": "mcp",
    };
    trackMigrationConversion(
      tierMap[tier.id],
      tier.id === "blog-post" ? 420 : tier.id === "script" ? 1000 : 10000,
      tier.currency,
    );
    window.location.href = `mailto:hello@spike.land?subject=Migration%20Sponsorship%3A%20${encodeURIComponent(tier.name)}&body=Hi%20Radix%2C%0A%0AI%27d%20like%20to%20sponsor%20%22${encodeURIComponent(tier.name)}%22%20(${encodeURIComponent(tier.price)}).%0A%0A`;
  }

  const panelClass = tier.highlighted ? "rubik-panel-strong" : "rubik-panel";

  const buttonClass = `mt-8 block w-full rounded-[calc(var(--radius-control)-0.1rem)] border px-6 py-3 text-center text-sm font-semibold transition cursor-pointer ${
    tier.highlighted
      ? "border-transparent bg-foreground text-background hover:bg-foreground/92"
      : "border-border bg-background text-foreground hover:border-primary/24 hover:text-primary"
  }`;

  // Anchor ID map: SupportBanner links use #tier-blog, #tier-script, #tier-mcp
  const anchorId =
    tier.id === "blog-post" ? "tier-blog" : tier.id === "script" ? "tier-script" : "tier-mcp";

  return (
    <article
      id={anchorId}
      aria-labelledby={`heading-${tier.id}`}
      className={`flex h-full flex-col p-6 ${panelClass}`}
    >
      {tier.badge && (
        <span className="rubik-chip rubik-chip-accent mb-4 self-start">{tier.badge}</span>
      )}

      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {tier.eyebrow}
      </p>

      <h2
        id={`heading-${tier.id}`}
        className="mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground"
      >
        {tier.name}
      </h2>

      <p className="mt-2 text-sm leading-7 text-muted-foreground">{tier.description}</p>

      <div className="mt-4">
        <span className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
          {tier.price}
        </span>
        <span className="ml-2 text-sm text-muted-foreground">· {tier.timeline}</span>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{tier.deliverableLabel}:</span>{" "}
        {tier.deliverable}
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {tier.includes.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm leading-7 text-foreground">
            <CheckIcon />
            {item}
          </li>
        ))}
      </ul>

      <button type="button" onClick={handleCta} className={buttonClass}>
        {tier.cta}
      </button>
    </article>
  );
}

function WhyCard({ card }: { card: WhyCard }) {
  return (
    <div className="rubik-panel p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-lg">
        {card.icon}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
      <div className="mt-3 space-y-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
            Before
          </span>
          <span className="text-xs text-muted-foreground leading-relaxed">{card.before}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success-foreground">
            After
          </span>
          <span className="text-xs text-muted-foreground leading-relaxed">{card.after}</span>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ item }: { item: FaqEntry }) {
  const [open, setOpen] = useState(false);
  const panelId = `faq-migrate-${item.question.slice(0, 24).replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <div className="border-b border-border py-4 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-4 text-left"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="text-sm font-semibold text-foreground">{item.question}</span>
        <svg
          className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <p id={panelId} className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {item.answer}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function MigratePage() {
  const [scrollTracked, setScrollTracked] = useState(false);
  const successTier =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("success")
      : null;

  useEffect(() => {
    trackAnalyticsEvent("migration_page_view", { page: "/migrate" });
    trackGoogleAdsEvent("migration_page_view", { page: "/migrate" });
  }, []);

  useEffect(() => {
    if (scrollTracked) return;
    function handleScroll() {
      const scrollPercent =
        (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (scrollPercent > 0.6) {
        trackAnalyticsEvent("migration_interest", { section: "scroll_depth_60" });
        trackGoogleAdsEvent("migration_interest", { section: "scroll_depth_60" });
        setScrollTracked(true);
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollTracked]);

  const tierSuccessLabels: Record<string, string> = {
    blog: "Blog Post Migration",
    script: "CLI Script",
    mcp: "MCP Server",
  };

  return (
    <div className="rubik-container rubik-page rubik-stack">
      {/* ------------------------------------------------------------------ */}
      {/* SUCCESS BANNER                                                      */}
      {/* ------------------------------------------------------------------ */}
      {successTier && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-primary/20 bg-primary/8 p-4 text-center text-sm font-bold text-primary"
        >
          Thank you for commissioning {tierSuccessLabels[successTier] ?? successTier}! We&apos;ll be
          in touch within 24h.
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* HERO                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="rubik-panel-strong space-y-6 p-6 text-center sm:p-10"
        aria-labelledby="migrate-hero-heading"
      >
        <div className="space-y-4">
          <span className="rubik-eyebrow">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Next.js Migration Services
          </span>

          <div className="space-y-3">
            <h1
              id="migrate-hero-heading"
              className="text-4xl font-semibold tracking-[-0.06em] text-foreground sm:text-5xl"
            >
              From 40 Minutes to 4 Seconds
            </h1>
            <p className="rubik-lede mx-auto">
              Real numbers from real projects. Gian Pier migrated 8 Next.js apps to TanStack Start +
              Vite + Cloudflare Workers — and he's willing to share exactly how, and build tools so
              you don't have to do it manually.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/70 px-4 py-2 text-sm font-medium text-success-foreground">
          $75.40/month Vercel bill → $0 on Cloudflare Workers
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href="#pricing"
            onClick={() => trackAnalyticsEvent("migration_interest", { section: "hero_cta" })}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all duration-200"
          >
            See the options
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </a>
          <a
            href="mailto:hello@spike.land?subject=Next.js%20Migration%20Question"
            onClick={() => trackAnalyticsEvent("migration_interest", { section: "hero_contact" })}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-7 py-3 text-sm font-semibold text-foreground hover:border-primary/24 hover:text-primary transition-colors"
          >
            Ask a question first
          </a>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SOCIAL PROOF NUMBERS                                                */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Migration metrics" className="grid gap-4 sm:grid-cols-3">
        {[
          {
            stat: "8",
            label: "Next.js projects migrated",
            sub: "by Gian Pier, personally",
          },
          {
            stat: "~10x",
            label: "Build time improvement",
            sub: "40+ min → ~4 sec",
          },
          {
            stat: "$0",
            label: "Hosting cost after migration",
            sub: "Cloudflare free tier covers it",
          },
        ].map(({ stat, label, sub }) => (
          <div key={label} className="rubik-panel p-5 text-center">
            <p className="text-4xl font-semibold tracking-[-0.06em] text-foreground">{stat}</p>
            <p className="mt-2 text-sm font-semibold text-foreground">{label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* TESTIMONIAL / QUOTE                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Blog post excerpt" className="rubik-panel p-6 sm:p-8">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <span className="rubik-eyebrow">
            <span className="h-2 w-2 rounded-full bg-primary" />
            From the migration diary
          </span>
          <blockquote className="text-lg font-medium text-foreground leading-relaxed">
            "I didn't expect the cost difference to be this dramatic. Vercel charges for every
            function invocation over the limit, and with 8 projects that adds up fast. Cloudflare
            Workers on the free tier handles 100,000 requests per day per project. For most
            side-projects, that's effectively free forever."
          </blockquote>
          <p className="text-sm text-muted-foreground">
            — Gian Pier, developer ·{" "}
            <span className="italic">from the unpublished migration diary</span>
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* WHY MIGRATE?                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="why-migrate-heading">
        <div className="mb-6 text-center space-y-2">
          <span className="rubik-eyebrow">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Why migrate at all?
          </span>
          <h2
            id="why-migrate-heading"
            className="text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl"
          >
            The case for leaving Next.js
          </h2>
          <p className="rubik-lede mx-auto">
            Not a rant. Just the data from migrating 8 real projects.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {WHY_CARDS.map((card) => (
            <WhyCard key={card.title} card={card} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* STACK OVERVIEW                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="rubik-panel p-6 sm:p-8" aria-label="Target stack">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-2 text-xl font-semibold tracking-[-0.03em] text-foreground">
            What you're migrating to
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            The spike.land stack. The same thing powering this page.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                name: "TanStack Start",
                role: "Framework",
                note: "File-based routing. SSR when you want it. No magic.",
              },
              {
                name: "Vite + esbuild",
                role: "Build",
                note: "4-second builds. Hot reload that actually works.",
              },
              {
                name: "Cloudflare Workers",
                role: "Runtime",
                note: "Global edge. No cold starts. Free tier is genuinely free.",
              },
            ].map(({ name, role, note }) => (
              <div key={name} className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {role}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{name}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* PRICING GRID                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section id="pricing" aria-labelledby="pricing-heading">
        <div className="mb-6 text-center space-y-2">
          <span className="rubik-eyebrow">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Three ways to make this happen
          </span>
          <h2
            id="pricing-heading"
            className="text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl"
          >
            Pick your level of commitment
          </h2>
          <p className="rubik-lede mx-auto">
            Each tier builds on the one before. Commission in order — the blog post data feeds the
            script, and the script patterns feed the MCP server.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {TIERS.map((tier) => (
            <TierCard key={tier.id} tier={tier} />
          ))}
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          All commissions go directly to Gian Pier. Radix handles coordination.{" "}
          <a
            href="mailto:hello@spike.land"
            className="text-primary underline hover:text-primary/80"
          >
            Questions? Just email.
          </a>
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* HOW IT WORKS                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="rubik-panel p-6 sm:p-8" aria-labelledby="how-it-works-heading">
        <h2
          id="how-it-works-heading"
          className="mb-6 text-xl font-semibold tracking-[-0.03em] text-foreground"
        >
          How this works
        </h2>
        <ol className="space-y-6">
          {[
            {
              step: "01",
              title: "You pick a tier and email us",
              body: "No checkout flow, no SaaS friction. Just email hello@spike.land with which tier you want to commission. We'll confirm scope and payment details.",
            },
            {
              step: "02",
              title: "Gian Pier does the work",
              body: "He's already done the migrations — we're funding the documentation, tooling, and publication. The work is real. The numbers are real.",
            },
            {
              step: "03",
              title: "You get the output first",
              body: "Sponsors get early access to the blog post draft, the script prerelease, or the MCP server beta before public launch.",
            },
            {
              step: "04",
              title: "It ships publicly",
              body: "Blog post goes on spike.land/blog. Script lands on npm. MCP server goes on the spike.land marketplace. Everyone benefits. You just got there first.",
            },
          ].map(({ step, title, body }) => (
            <li key={step} className="flex gap-5">
              <span className="shrink-0 text-2xl font-semibold tracking-[-0.05em] text-primary/30">
                {step}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FAQ                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="rubik-panel mx-auto max-w-3xl p-6 sm:p-8">
        <h2 className="mb-6 text-center text-2xl font-semibold tracking-[-0.04em] text-foreground">
          Frequently asked
        </h2>
        <div>
          {FAQ_ITEMS.map((item) => (
            <FaqItem key={item.question} item={item} />
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* FINAL CTA                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="rubik-panel-strong p-8 text-center sm:p-12"
        aria-labelledby="final-cta-heading"
      >
        <span className="rubik-chip mb-4 inline-block">Still on Next.js?</span>
        <h2
          id="final-cta-heading"
          className="text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl"
        >
          Let's talk.
        </h2>
        <p className="rubik-lede mx-auto mt-3">
          Not ready to commit to a tier? Just want to ask whether your specific app is a good
          migration candidate? Email is fine. No pitch deck, no discovery call, no CRM sequence.
        </p>
        <a
          href="mailto:hello@spike.land?subject=Next.js%20Migration%20Question"
          onClick={() => trackAnalyticsEvent("migration_interest", { section: "final_cta_email" })}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-foreground px-7 py-3 text-sm font-bold text-background hover:bg-foreground/90 active:scale-[0.97] transition-all duration-200"
        >
          hello@spike.land
        </a>
        <p className="mt-4 text-xs text-muted-foreground">Response within 24h on weekdays.</p>
      </section>

      {/* Structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Next.js to TanStack Start Migration",
            provider: {
              "@type": "Organization",
              name: "spike.land",
              url: "https://spike.land",
            },
            description:
              "Migration services to move Next.js projects to TanStack Start + Vite + Cloudflare Workers. Available as a blog post, CLI script, or full MCP server.",
            offers: TIERS.map((tier) => ({
              "@type": "Offer",
              name: tier.name,
              description: tier.description,
              priceCurrency: tier.currency,
              price: tier.id === "blog-post" ? "420" : tier.id === "script" ? "1000" : "10000",
            })),
          }),
        }}
      />
    </div>
  );
}
