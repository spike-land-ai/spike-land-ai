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
    "A homepage that explains the system before it asks for trust.",
    "The interface retunes itself as if an agent is actively rebuilding it for developers.",
  );
  const platformRhythmBody = useDevModeCopy(
    "spike.land is strongest when it feels like one coherent operating layer for agentic work. This section turns the message into a simple sequence: connect, compose, deploy.",
    "The same page pivots into implementation language in place: connect the endpoint, compose the toolchain, deploy the runtime. No route swap, no new screen.",
  );
  const howHeading = useDevModeCopy("How it actually works", "What the runtime is patching");
  const howBody = useDevModeCopy(
    "spike.land connects your AI assistant to real-world tools using the Model Context Protocol.",
    "spike.land is swapping from explorer copy into builder copy while keeping the same MCP-backed surface live.",
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

      <div className="space-y-24 pb-32 sm:space-y-36">
        <section className="relative">
          <TryItNow />
        </section>

        <section
          aria-labelledby="platform-rhythm-heading"
          className="relative overflow-hidden px-4 sm:px-6"
        >
          <div className="absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[2rem] border border-border/60 bg-card/80 p-8 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                Platform rhythm
              </p>
              <h2
                id="platform-rhythm-heading"
                className="mt-4 max-w-xl text-4xl font-black tracking-tight sm:text-5xl"
              >
                {platformRhythmHeading.text}
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
                {platformRhythmBody.text}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Search,
                  title: "Connect",
                  copy: "Attach Claude, Cursor, or VS Code to a single MCP endpoint.",
                },
                {
                  icon: Workflow,
                  title: "Compose",
                  copy: "Mix built-in tools, custom logic, and generated flows without glue code.",
                },
                {
                  icon: Layers3,
                  title: "Deploy",
                  copy: "Ship globally with edge-native hosting, auth, and runtime primitives.",
                },
              ].map((step) => (
                <div
                  key={step.title}
                  className="rounded-[2rem] border border-border/60 bg-muted/30 p-6"
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <step.icon className="size-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-black tracking-tight">{step.title}</h3>
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
          className="py-32 border-y border-border/50 bg-muted/30 dark:bg-transparent relative overflow-hidden"
        >
          {/* Decorative radial gradient — dark mode only */}
          <div className="absolute inset-0 pointer-events-none hidden dark:block bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(15,23,42,0.9)_0%,rgba(79,70,229,0.15)_50%,rgba(20,184,166,0.1)_100%)]" />
          {/* Decorative glow orb */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 dark:bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="relative z-10 mx-auto max-w-5xl px-6">
            <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
              <h2
                id="features-heading"
                className="text-4xl sm:text-6xl font-black tracking-tighter text-foreground text-balance leading-none"
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
              <p className="text-xl text-muted-foreground leading-relaxed font-medium">
                {howBody.text}{" "}
                <span className="text-foreground font-bold underline decoration-primary/30 dark:decoration-primary/40 decoration-4 underline-offset-4">
                  Model Context Protocol
                </span>
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  title: "Browse & connect",
                  desc: "Pick from our library of ready-made tools. Each one connects to your AI assistant in seconds — no coding required.",
                  icon: Search,
                  color: "text-blue-500 dark:text-primary-light",
                },
                {
                  title: "Works everywhere",
                  desc: "Built on an open standard supported by Claude, ChatGPT, and Cursor. Connect once, use anywhere in your workflow.",
                  icon: Globe,
                  color: "text-emerald-500 dark:text-primary",
                },
                {
                  title: "Build your own",
                  desc: "Need something custom? Describe it, and our builder creates it for you. We handle hosting, security, and scaling.",
                  icon: Code2,
                  color: "text-primary dark:text-primary-light",
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="group p-8 rounded-[2.5rem] transition-all duration-500 hover:-translate-y-2
                             bg-card border border-border/50 shadow-xl hover:border-primary/30
                             dark:bg-white/5 dark:border-white/10 dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)] dark:backdrop-blur-[16px] dark:hover:border-primary/40 dark:hover:shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_30px_rgba(20,184,166,0.1)]"
                >
                  <div
                    className={cn(
                      "size-14 rounded-2xl bg-muted dark:bg-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform",
                      feature.color,
                    )}
                  >
                    <feature.icon size={28} aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-black mb-4 tracking-tight">{feature.title}</h3>
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
                  title: "Hosted security posture",
                  desc: "Account flows, auth boundaries, and platform runtime concerns are already part of the product surface.",
                },
                {
                  icon: Globe,
                  title: "Portable by design",
                  desc: "The core value proposition stays legible whether someone arrives from open-source, app discovery, or enterprise deployment.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.75rem] border border-border/50 bg-card/70 p-6 shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <item.icon className="size-4" />
                    </div>
                    <h3 className="text-lg font-black tracking-tight">{item.title}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* CTA strip */}
            <div
              className="mt-20 p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-8
                            bg-primary/5 border border-primary/10
                            dark:bg-white/5 dark:border-white/10 dark:backdrop-blur-[16px] dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]"
            >
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground glow-primary">
                  <Zap size={20} fill="currentColor" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-black text-foreground">Ready to start building?</p>
                  <p className="text-sm text-muted-foreground font-medium">
                    Join 5,000+ developers building on the edge.
                  </p>
                </div>
              </div>
              <Link
                href="/apps/new"
                className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl
                           bg-foreground text-background
                           dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary-light glow-primary"
              >
                Create your first tool
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="updates-heading" className="py-20">
          <div className="max-w-7xl mx-auto px-6">
            <header className="mb-16 flex items-end justify-between border-b border-border/50 pb-8">
              <div className="space-y-2">
                <h2
                  id="updates-heading"
                  className="text-4xl sm:text-5xl font-black tracking-tighter text-foreground"
                >
                  {updatesHeading.text}
                </h2>
                <p className="text-lg text-muted-foreground font-medium">
                  {updatesBody.text}
                </p>
              </div>
              <Link
                href="/blog"
                className="hidden sm:flex items-center gap-2 text-sm font-black uppercase tracking-widest text-primary hover:gap-4 transition-all"
              >
                {archiveCopy.text}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </header>

            <BlogListView limit={3} showHeader={false} />

            <div className="mt-12 sm:hidden">
              <Link
                href="/blog"
                className="flex items-center justify-center gap-2 p-4 rounded-2xl font-black uppercase tracking-widest text-xs text-foreground
                           bg-muted dark:bg-white/10 dark:border dark:border-white/10 dark:backdrop-blur-[16px]"
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
