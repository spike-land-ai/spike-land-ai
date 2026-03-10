import { useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  Code2,
  Image,
  BarChart3,
  Trophy,
  Globe,
  GitBranch,
  MessageSquare,
  ShieldCheck,
  Database,
  Wrench,
  Sparkles,
  ArrowRight,
  Zap,
  Layers,
  Server,
} from "lucide-react";
import { useDarkMode } from "../hooks/useDarkMode";
import { cn } from "../../styling/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Domain {
  id: string;
  icon: React.ElementType;
  name: string;
  toolCount: number;
  description: string;
  detail: string;
}

interface StatItem {
  value: number;
  suffix: string;
  label: string;
  icon: React.ElementType;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const DOMAINS: Domain[] = [
  {
    id: "code-intelligence",
    icon: Code2,
    name: "Code Intelligence",
    toolCount: 12,
    description: "Code review, linting, transpilation",
    detail:
      "AI-powered code review, static analysis, esbuild-wasm transpilation at the edge, and Monaco-based live editing.",
  },
  {
    id: "image-studio",
    icon: Image,
    name: "Image Studio",
    toolCount: 8,
    description: "AI generation, enhancement, albums",
    detail:
      "Generate, enhance, and organize images using AI pipelines. Batch processing, album management, and style transfer.",
  },
  {
    id: "data-analytics",
    icon: BarChart3,
    name: "Data & Analytics",
    toolCount: 7,
    description: "GA4, Stripe analytics, insights",
    detail:
      "Connect to Google Analytics 4, Stripe revenue dashboards, churn analysis, MRR tracking, and custom report generation.",
  },
  {
    id: "chess-engine",
    icon: Trophy,
    name: "Chess Engine",
    toolCount: 6,
    description: "ELO, challenges, game management",
    detail:
      "Full ELO rating system, player tracking, challenge management, game history, and tournament bracket tools.",
  },
  {
    id: "browser-automation",
    icon: Globe,
    name: "Browser Automation",
    toolCount: 5,
    description: "QA studio, Playwright",
    detail:
      "End-to-end test generation, Playwright script execution, screenshot capture, performance audits, and visual diffing.",
  },
  {
    id: "state-machines",
    icon: GitBranch,
    name: "State Machines",
    toolCount: 4,
    description: "Statecharts, guards, visualization",
    detail:
      "Design and run statecharts with guard-condition parsing, transition visualization, and serializable machine export.",
  },
  {
    id: "communication",
    icon: MessageSquare,
    name: "Communication",
    toolCount: 6,
    description: "HackerNews, messaging, notifications",
    detail:
      "Read and post HackerNews threads, send notifications, manage real-time messaging channels, and webhook dispatch.",
  },
  {
    id: "authentication",
    icon: ShieldCheck,
    name: "Authentication",
    toolCount: 8,
    description: "OAuth, sessions, organizations",
    detail:
      "Better Auth integration: OAuth providers, session management, organization RBAC, API key vault, and BYOK support.",
  },
  {
    id: "storage-cdn",
    icon: Database,
    name: "Storage & CDN",
    toolCount: 5,
    description: "R2, edge caching, assets",
    detail:
      "Cloudflare R2 object storage, edge-cached asset delivery, D1 SQL queries, and KV key-value operations.",
  },
  {
    id: "developer-tools",
    icon: Wrench,
    name: "Developer Tools",
    toolCount: 10,
    description: "CLI, Docker, deployment",
    detail:
      "Vibe-dev Docker workflows, Wrangler deploy automation, CLI multiplexer, dependency graph management, and CI tooling.",
  },
  {
    id: "ai-llm",
    icon: BrainCircuit,
    name: "AI & LLM",
    toolCount: 6,
    description: "Claude, Gemini, prompt engineering",
    detail:
      "Orchestrate Claude and Gemini models, chain prompts with structured output, manage context windows, and rate-limit safely.",
  },
];

const STATS: StatItem[] = [
  { value: 80, suffix: "+", label: "MCP Tools", icon: Zap },
  { value: 11, suffix: "", label: "Domains", icon: Layers },
  { value: 100, suffix: "%", label: "Edge-Deployed", icon: Server },
  { value: 0, suffix: "", label: "Lock-in", icon: Sparkles },
];

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fires the callback once when the referenced element enters the viewport.
 */
function useIntersectionOnce(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, threshold]);

  return { ref, visible };
}

/**
 * Animated counter that ticks up from 0 to `target` once `active` is true.
 */
function useCounter(target: number, active: boolean, duration = 1200) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (target === 0) {
      setCount(0);
      return;
    }
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);

  return count;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AnimatedCounter({ item, active }: { item: StatItem; active: boolean }) {
  const count = useCounter(item.value, active);
  const Icon = item.icon;
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <Icon className="h-5 w-5 text-primary mb-1" aria-hidden="true" />
      <span className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
        {count}
        {item.suffix}
      </span>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
        {item.label}
      </span>
    </div>
  );
}

function DomainCard({
  domain,
  index,
  visible,
}: {
  domain: Domain;
  index: number;
  visible: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = domain.icon;

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 cursor-default",
        "transition-all duration-300",
        "hover:border-primary/40 hover:bg-card/80",
        "hover:shadow-2xl hover:shadow-primary/5",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
      )}
      style={{
        transitionDelay: visible ? `${index * 60}ms` : "0ms",
        transitionProperty: "opacity, transform, box-shadow, border-color, background-color",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`${domain.name}: ${domain.toolCount} tools`}
    >
      {/* Glass shimmer overlay on hover */}
      <div
        className={cn(
          "absolute inset-0 rounded-2xl bg-primary/5 pointer-events-none transition-opacity duration-300",
          hovered ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            "bg-primary/10 transition-all duration-300",
            hovered && "bg-primary/20 scale-110",
          )}
        >
          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums",
            "border border-border bg-muted text-muted-foreground",
            "transition-colors duration-300",
            hovered && "border-primary/30 bg-primary/10 text-primary",
          )}
        >
          {domain.toolCount} tools
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-foreground leading-snug">{domain.name}</h3>
        <p className="text-xs text-muted-foreground">{domain.description}</p>
      </div>

      {/* Expanded detail on hover */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          hovered ? "max-h-24 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
          {domain.detail}
        </p>
      </div>

      {/* Arrow indicator */}
      <ArrowRight
        className={cn(
          "absolute bottom-4 right-4 h-4 w-4 text-primary transition-all duration-300",
          hovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2",
        )}
        aria-hidden="true"
      />
    </article>
  );
}

// Decorative floating orbs for the hero
function HeroOrbs({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Top-left orb */}
      <div
        className={cn(
          "absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl",
          isDarkMode ? "bg-primary/15" : "bg-primary/8",
          "animate-pulse",
        )}
        style={{ animationDuration: "4s" }}
      />
      {/* Top-right orb */}
      <div
        className={cn(
          "absolute -top-16 right-0 h-72 w-72 rounded-full blur-3xl",
          isDarkMode ? "bg-violet-500/10" : "bg-violet-300/15",
          "animate-pulse",
        )}
        style={{ animationDuration: "6s", animationDelay: "1s" }}
      />
      {/* Bottom-center orb */}
      <div
        className={cn(
          "absolute bottom-0 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full blur-3xl",
          isDarkMode ? "bg-cyan-500/8" : "bg-cyan-300/12",
          "animate-pulse",
        )}
        style={{ animationDuration: "5s", animationDelay: "2s" }}
      />
    </div>
  );
}

// Dot-grid texture overlay
function DotGrid() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        opacity: 0.04,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function WhatWeDoPage() {
  const { isDarkMode } = useDarkMode();

  // Hero text reveal
  const [heroRevealed, setHeroRevealed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setHeroRevealed(true), 80);
    return () => clearTimeout(id);
  }, []);

  // Stats counter trigger
  const { ref: statsRef, visible: statsVisible } = useIntersectionOnce(0.3);

  // Domain cards trigger
  const { ref: cardsRef, visible: cardsVisible } = useIntersectionOnce(0.1);

  // CTA trigger
  const { ref: ctaRef, visible: ctaVisible } = useIntersectionOnce(0.2);

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* HERO                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="relative flex min-h-[92vh] flex-col items-center justify-center px-4 pt-16 pb-20 text-center"
        aria-labelledby="hero-heading"
      >
        <HeroOrbs isDarkMode={isDarkMode} />
        <DotGrid />

        {/* Eyebrow tag */}
        <div
          className={cn(
            "relative mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-4 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm",
            "transition-all duration-700",
            heroRevealed ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
          MCP-First Platform
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
            style={{ animationDelay: "0.5s" }}
            aria-hidden="true"
          />
        </div>

        {/* Main headline */}
        <h1
          id="hero-heading"
          className={cn(
            "relative max-w-4xl text-4xl font-display font-black tracking-tight sm:text-5xl md:text-6xl lg:text-7xl",
            "transition-all duration-700 delay-100",
            heroRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          )}
        >
          <span className="block text-foreground">The AI Development</span>
          <span className="block text-primary">Platform That Does</span>
          <span className="block text-foreground">Everything.</span>
        </h1>

        {/* Sub-headline */}
        <p
          className={cn(
            "relative mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed sm:text-xl",
            "transition-all duration-700 delay-200",
            heroRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          )}
        >
          80+ production-ready MCP tools across 11 domains — deployed globally on Cloudflare Workers
          with zero cold starts and full TypeScript safety.
        </p>

        {/* Hero CTA buttons */}
        <div
          className={cn(
            "relative mt-10 flex flex-col items-center gap-3 sm:flex-row",
            "transition-all duration-700 delay-300",
            heroRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          )}
        >
          <a
            href="/apps"
            className={cn(
              "inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-bold text-primary-foreground",
              "hover:bg-primary/90 active:scale-[0.97] transition-all duration-200 shadow-lg",
              isDarkMode && "shadow-primary/30",
            )}
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            Explore All Apps
          </a>
        </div>

        {/* Scroll hint */}
        <div
          className={cn(
            "absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1",
            "transition-all duration-700 delay-500",
            heroRevealed ? "opacity-60" : "opacity-0",
          )}
          aria-hidden="true"
        >
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Scroll
          </span>
          <div className="h-6 w-px bg-gradient-to-b from-muted-foreground to-transparent animate-pulse" />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* STATS BAR                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section
        ref={statsRef}
        aria-label="Platform statistics"
        className={cn(
          "relative mx-4 mb-16 rounded-2xl border border-border bg-card/60 backdrop-blur-sm",
          "transition-all duration-700",
          statsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        )}
      >
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex items-center justify-center py-7 px-4">
              <AnimatedCounter item={stat} active={statsVisible} />
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* DOMAIN CARDS                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative px-4 pb-24" aria-labelledby="domains-heading">
        <div className="mx-auto max-w-6xl">
          {/* Section header */}
          <div
            ref={cardsRef}
            className={cn(
              "mb-12 text-center",
              "transition-all duration-700",
              cardsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
            )}
          >
            <h2
              id="domains-heading"
              className="text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl"
            >
              11 Domains. <span className="text-primary">Endless Possibilities.</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Each domain is a fully-equipped toolkit. Hover a card to see what the tools actually
              do.
            </p>
          </div>

          {/* Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {DOMAINS.map((domain, i) => (
              <DomainCard key={domain.id} domain={domain} index={i} visible={cardsVisible} />
            ))}
          </div>

          {/* Tool count summary row */}
          <div
            className={cn(
              "mt-8 flex flex-wrap items-center justify-center gap-2",
              "transition-all duration-700 delay-700",
              cardsVisible ? "opacity-100" : "opacity-0",
            )}
          >
            {DOMAINS.map((d) => {
              const Icon = d.icon;
              return (
                <span
                  key={d.id}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground",
                    "hover:border-primary/40 hover:text-foreground transition-colors duration-200",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {d.name}
                  <span className="font-bold text-primary">{d.toolCount}</span>
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FEATURE HIGHLIGHTS                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section
        className={cn(
          "relative mx-4 mb-24 overflow-hidden rounded-2xl border border-border bg-card",
        )}
        aria-label="Platform highlights"
      >
        <DotGrid />
        <div className="relative grid gap-px sm:grid-cols-3">
          {[
            {
              icon: Zap,
              title: "Zero Cold Starts",
              body: "Every tool runs on Cloudflare Workers — globally distributed with sub-millisecond startup times.",
            },
            {
              icon: Code2,
              title: "TypeScript Native",
              body: "Strict types end-to-end. Zod validation at every boundary. No `any`, no surprises.",
            },
            {
              icon: Layers,
              title: "Composable by Design",
              body: "Mix and match tools across domains. Chain them in workflows. Build your own orchestration layer.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group flex flex-col gap-3 p-8 hover:bg-primary/5 transition-colors duration-300"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CTA                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section ref={ctaRef} className="relative px-4 pb-24" aria-labelledby="cta-heading">
        <div
          className={cn(
            "mx-auto max-w-3xl rounded-2xl border border-border bg-card px-8 py-14 text-center",
            "transition-all duration-700",
            ctaVisible ? "opacity-100 scale-100" : "opacity-0 scale-95",
          )}
        >
          <h2
            id="cta-heading"
            className="relative text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Ready to build with <span className="text-primary">80+ tools</span>?
          </h2>
          <p className="relative mt-4 text-muted-foreground max-w-lg mx-auto">
            Browse every tool in the registry and start building AI-assisted apps in seconds.
          </p>

          <div className="relative mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/apps"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground",
                "hover:bg-primary/90 active:scale-[0.97] transition-all duration-200 shadow-lg",
                isDarkMode && "shadow-primary/30",
              )}
            >
              <Layers className="h-4 w-4" aria-hidden="true" />
              Browse All Apps
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          {/* Micro-trust signals */}
          <p className="relative mt-6 text-xs text-muted-foreground">
            No credit card required &nbsp;&middot;&nbsp; Free plan available &nbsp;&middot;&nbsp;
            Edge-deployed globally
          </p>
        </div>
      </section>
    </div>
  );
}
