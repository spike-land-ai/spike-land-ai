import { LandingHero } from "./LandingHero";
import { AppShowcase } from "../core-logic/AppShowcase";
import { TryItNow } from "./TryItNow";
import { TryItCta } from "./TryItCta";
import { BlogListView } from "./BlogList";
import { Link } from "../lazy-imports/link";
import {
  Search,
  Globe,
  Code2,
  ArrowRight,
  Zap,
  Layers3,
  Workflow,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@spike-land-ai/shared";
import { useDevModeCopy } from "./useDevModeCopy";

export function LandingPage() {
  const platformRhythmHeading = useDevModeCopy(
    "A narrower story that matches how the company actually gets paid.",
    "The page switches from company framing into implementation framing without changing the runtime underneath.",
  );
  const platformRhythmBody = useDevModeCopy(
    "The product is broad, but the first commercial wedge is not. Start with one high-friction billing, auth, or permissions flow, prove the CI and reliability gain, then expand from there.",
    "Model one brittle journey as typed tool contracts, verify it below the browser, and reuse the same contract across CI, internal tooling, and agent workflows.",
  );
  const howHeading = useDevModeCopy(
    "How the first wedge works",
    "What the runtime is actually changing",
  );
  const howBody = useDevModeCopy(
    "Start with a flaky browser flow, extract the business logic into typed tool contracts, and keep the browser as a thin confidence layer around it.",
    "The same typed contract can stay live across CI, the product, the CLI, and agents while the browser remains a thin smoke layer.",
  );
  const updatesHeading = useDevModeCopy("Latest Intelligence", "Latest implementation notes");
  const updatesBody = useDevModeCopy(
    "Insights from the edge of AI development.",
    "Signals from the edge runtime, product experiments, and shipping notes.",
  );
  const archiveCopy = useDevModeCopy("View Archive", "Read build log");

  return (
    <div className="font-sans text-foreground selection:bg-primary selection:text-primary-foreground dark:selection:bg-primary/40 dark:selection:text-primary-light">
      <LandingHero />

      <div className="rubik-stack pb-24 sm:pb-32">
        <section className="relative">
          <TryItNow />
        </section>

        <section
          aria-labelledby="platform-rhythm-heading"
          className="rubik-container-wide relative overflow-hidden"
        >
          <div className="absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rubik-panel p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Platform rhythm
              </p>
              <h2
                id="platform-rhythm-heading"
                className="mt-4 max-w-xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl"
              >
                {platformRhythmHeading.text}
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
                {platformRhythmBody.text}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Search,
                  title: "Model",
                  copy: "Choose one high-friction billing, auth, permissions, or state-transition flow instead of trying to replace the entire suite.",
                },
                {
                  icon: Workflow,
                  title: "Verify",
                  copy: "Run the important logic as typed tool contracts at function speed and keep the browser for smoke coverage and evidence.",
                },
                {
                  icon: Layers3,
                  title: "Ship",
                  copy: "Expose the same contract to CI, the product surface, the CLI, and agents without rebuilding the flow per channel.",
                },
              ].map((step) => (
                <div key={step.title} className="rubik-panel rubik-panel-muted p-6">
                  <div className="rubik-icon-badge size-12 rounded-2xl">
                    <step.icon className="size-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden">
          <AppShowcase />
        </section>

        <section className="relative">
          <TryItCta />
        </section>

        <section
          aria-labelledby="features-heading"
          className="rubik-section relative overflow-hidden border-y border-border/50 bg-muted/30 dark:bg-transparent"
        >
          {/* Decorative radial gradient — dark mode only */}
          <div className="absolute inset-0 pointer-events-none hidden dark:block bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(15,23,42,0.92)_0%,rgba(76,105,255,0.12)_50%,rgba(81,213,255,0.08)_100%)]" />
          {/* Decorative glow orb */}
          <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px] pointer-events-none dark:bg-primary/10" />

          <div className="rubik-container relative z-10">
            <div className="mx-auto mb-16 max-w-3xl space-y-4 text-center">
              <h2
                id="features-heading"
                className="text-balance text-4xl font-semibold leading-none tracking-[-0.06em] text-foreground sm:text-6xl"
              >
                {howHeading.text.split("actually").length > 1 ? (
                  <>
                    {howHeading.text.split("actually")[0]}
                    <span className="text-primary italic">actually</span>
                    {howHeading.text.split("actually").slice(1).join("actually")}
                  </>
                ) : (
                  howHeading.text
                )}
              </h2>
              <p className="text-lg font-medium leading-8 text-muted-foreground sm:text-xl">
                {howBody.text}{" "}
                <span className="text-foreground font-bold underline decoration-primary/30 dark:decoration-primary/40 decoration-4 underline-offset-4">
                  Model Context Protocol
                </span>
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  title: "Start with one brittle flow",
                  desc: "The right first sale is not a platform migration. It is one painful journey where browser-heavy verification is costing time and confidence every week.",
                  icon: Search,
                  color: "text-blue-500 dark:text-primary-light",
                },
                {
                  title: "Keep Playwright, but thin it down",
                  desc: "spike.land is not asking teams to rip out their browser estate. It keeps smoke coverage in place while moving the important logic below the UI.",
                  icon: Globe,
                  color: "text-emerald-500 dark:text-primary",
                },
                {
                  title: "Reuse the contract everywhere",
                  desc: "A typed tool contract can be exercised in CI, internal tools, the CLI, and by AI agents with the same semantics and audit trail.",
                  icon: Code2,
                  color: "text-primary dark:text-primary-light",
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="rubik-panel group p-8 transition-[border-color,box-shadow] duration-300 hover:border-primary/26 hover:shadow-[var(--panel-shadow-strong)]"
                >
                  <div
                    className={cn(
                      "rubik-icon-badge mb-6 size-14 rounded-2xl group-hover:border-primary/30",
                      feature.color,
                    )}
                  >
                    <feature.icon size={28} aria-hidden="true" />
                  </div>
                  <h3 className="mb-4 text-xl font-semibold tracking-[-0.03em]">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed font-medium text-sm">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {[
                {
                  icon: ShieldCheck,
                  title: "Governed execution",
                  desc: "Hosted auth, metering, and runtime boundaries are part of the product layer, so teams do not have to hand-roll them above raw edge compute.",
                },
                {
                  icon: Globe,
                  title: "Flagship proof point",
                  desc: "COMPASS stays in the story as the hard proof that the same runtime can support a regulated, multilingual, offline-capable workflow.",
                },
              ].map((item) => (
                <div key={item.title} className="rubik-panel p-6">
                  <div className="flex items-center gap-3">
                    <div className="rubik-icon-badge size-10 rounded-xl">
                      <item.icon className="size-4" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-[-0.03em]">{item.title}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* CTA strip */}
            <div className="rubik-panel-strong mt-16 flex flex-col items-start justify-between gap-8 p-8 md:flex-row md:items-center">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary">
                  <Zap size={20} fill="currentColor" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold tracking-[-0.03em] text-foreground">
                    Ready to cut one red build loop down to size?
                  </p>
                  <p className="text-sm text-muted-foreground font-medium">
                    Best fit for teams already carrying Playwright or Cypress pain.
                  </p>
                </div>
              </div>
              <Link
                href="/apps/qa-studio"
                className="rounded-[calc(var(--radius-control)-0.1rem)] bg-foreground px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-background transition-colors hover:bg-foreground/92 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary-light glow-primary"
              >
                Inspect QA Studio
              </Link>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="updates-heading"
          className="rubik-container-wide rubik-section-compact"
        >
          <div>
            <header className="mb-12 flex items-end justify-between border-b border-border/50 pb-8">
              <div className="space-y-2">
                <h2
                  id="updates-heading"
                  className="text-4xl font-semibold tracking-[-0.05em] text-foreground sm:text-5xl"
                >
                  {updatesHeading.text}
                </h2>
                <p className="text-lg text-muted-foreground font-medium">{updatesBody.text}</p>
              </div>
              <Link
                href="/blog"
                className="rubik-kicker-link hidden items-center text-[0.76rem] font-semibold uppercase tracking-[0.16em] sm:inline-flex"
              >
                {archiveCopy.text}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </header>

            <BlogListView limit={3} showHeader={false} />

            <div className="mt-12 sm:hidden">
              <Link
                href="/blog"
                className="rubik-panel rubik-panel-muted flex items-center justify-center gap-2 p-4 text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-foreground"
              >
                {archiveCopy.text}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
