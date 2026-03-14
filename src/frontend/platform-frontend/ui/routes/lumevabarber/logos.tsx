import { Link } from "@tanstack/react-router";
import {
  Award,
  ArrowRight,
  Banknote,
  BrainCircuit,
  CheckCircle2,
  Eye,
  Share2,
  Smartphone,
  Sparkles,
  Store,
} from "lucide-react";
import { cn } from "../../../styling/cn";
import { type PricingTier, SECTION_CLASSES, useIntersectionOnce } from "./shared";

// ── Data ──────────────────────────────────────────────────────────────

const WHY_POINTS = [
  {
    icon: Eye,
    title: "First Impressions",
    text: "Customers judge your shop in 50ms. Your logo sets the tone.",
  },
  {
    icon: BrainCircuit,
    title: "Recognition & Recall",
    text: "A distinctive logo is remembered 5x faster.",
  },
  {
    icon: Award,
    title: "Trust Signal",
    text: "Professional design = professional service in the client\u2019s mind.",
  },
  {
    icon: Banknote,
    title: "Premium Perception",
    text: "Premium logos justify premium prices. Clients expect to pay more.",
  },
  {
    icon: Store,
    title: "Storefront Impact",
    text: "Your sign is your #1 marketing asset. Make it count.",
  },
  {
    icon: Smartphone,
    title: "Digital First",
    text: "Social profiles, Google Maps, booking apps \u2014 your logo is everywhere.",
  },
  {
    icon: Share2,
    title: "Word of Mouth",
    text: "Memorable brands get shared. Generic ones get forgotten.",
  },
  {
    icon: Sparkles,
    title: "Willingness to Pay",
    text: "Studies show premium visual identity increases willingness to pay 20\u201330%.",
  },
] as const;

const PROCESS_STEPS = [
  {
    phase: "01",
    title: "Discovery & Research",
    text: "Competitive audit, target client psychology, market positioning analysis.",
  },
  {
    phase: "02",
    title: "Concept Development",
    text: "3 behaviorally-informed concepts, each with strategic rationale.",
  },
  {
    phase: "03",
    title: "Refinement & Delivery",
    text: "Chosen concept refined through feedback, delivered in all formats.",
  },
];

const LOGO_TIERS: PricingTier[] = [
  {
    id: "essential",
    name: "Essential",
    price: "$290",
    description: "Clean, professional logo mark for barbershops just starting out.",
    features: [
      "1 logo concept",
      "2 revision rounds",
      "Primary logo + icon mark",
      "Print & digital files (PNG, SVG, PDF)",
      "Basic brand color palette",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: "$790",
    description: "Complete logo identity with strategic positioning.",
    features: [
      "3 logo concepts",
      "Unlimited revisions",
      "Primary + secondary logo variations",
      "Full file package (all formats)",
      "Brand color palette + typography guide",
      "Social media profile kit",
      "Storefront signage mockup",
    ],
    highlighted: true,
    badge: "Most Popular",
  },
  {
    id: "behavioral",
    name: "Behavioral Branding",
    price: "$1,990",
    description: "Research-driven logo with competitive analysis and psychological optimization.",
    features: [
      "Everything in Professional",
      "Competitive audit (5 local competitors)",
      "Target client psychology profile",
      "A/B perception testing",
      "Brand positioning document",
      "Brand guidelines (20+ pages)",
      "Business card design",
      "1-hour strategy session",
    ],
    badge: "Premium",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "Full brand transformation for multi-location barbershops.",
    features: [
      "Everything in Behavioral Branding",
      "Multi-location brand system",
      "Environmental design concepts",
      "Staff uniform/merch design",
      "Ongoing brand consultation",
      "Priority support",
    ],
  },
];

const PORTFOLIO_PLACEHOLDERS = [
  "bg-gradient-to-br from-amber-900/60 to-neutral-900",
  "bg-gradient-to-br from-orange-900/50 to-neutral-950",
  "bg-gradient-to-br from-neutral-800 to-amber-950/40",
  "bg-gradient-to-br from-amber-800/40 to-neutral-900",
  "bg-gradient-to-br from-orange-950/60 to-neutral-800",
  "bg-gradient-to-br from-neutral-900 to-amber-900/30",
];

// ── Component ─────────────────────────────────────────────────────────

export function LumevaLogos() {
  const hero = useIntersectionOnce(0.1);
  const why = useIntersectionOnce();
  const process = useIntersectionOnce();
  const portfolio = useIntersectionOnce();
  const pricing = useIntersectionOnce();
  const cta = useIntersectionOnce();

  return (
    <div className={SECTION_CLASSES.dark}>
      {/* ── 1. Hero ───────────────────────────────────────────────── */}
      <section
        ref={hero.ref}
        className={cn(
          "min-h-[70vh] flex items-center justify-center text-center px-4",
          SECTION_CLASSES.darker,
          "transition-all duration-700",
          hero.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        <div className="max-w-3xl">
          <span className="inline-block text-xs font-bold tracking-[0.3em] text-amber-400 uppercase mb-4">
            Logo Design
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
            A Logo That Makes Clients Choose You Before They Walk In
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto mb-8">
            Your logo is your silent salesperson. We design logos that leverage psychology to build
            trust and premium perception.
          </p>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
          >
            See Pricing <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* ── 2. Why Logos Matter ────────────────────────────────────── */}
      <section ref={why.ref} className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2
          className={cn(
            "text-3xl md:text-4xl font-bold text-white text-center mb-16 transition-all duration-700",
            why.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          )}
        >
          Why Your Logo Is Your Most Important Business Asset
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {WHY_POINTS.map((point, i) => (
            <div
              key={point.title}
              className={cn(
                SECTION_CLASSES.card,
                SECTION_CLASSES.cardHover,
                "p-6 transition-all duration-500",
                why.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
              )}
              style={{ transitionDelay: why.visible ? `${i * 80}ms` : "0ms" }}
            >
              <point.icon className="h-8 w-8 text-amber-400 mb-4" />
              <h3 className="text-white font-semibold mb-2">{point.title}</h3>
              <p className="text-sm text-neutral-400">{point.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. Our Process ────────────────────────────────────────── */}
      <section
        ref={process.ref}
        className={cn("py-24 px-4 sm:px-6 lg:px-8", SECTION_CLASSES.darker)}
      >
        <div className="max-w-5xl mx-auto">
          <h2
            className={cn(
              "text-3xl md:text-4xl font-bold text-white text-center mb-16 transition-all duration-700",
              process.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
            )}
          >
            How We Design Your Logo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PROCESS_STEPS.map((step, i) => (
              <div
                key={step.phase}
                className={cn(
                  "relative transition-all duration-600",
                  process.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
                )}
                style={{ transitionDelay: process.visible ? `${i * 150}ms` : "0ms" }}
              >
                <span className="text-5xl font-black text-amber-500/20 mb-2 block">
                  {step.phase}
                </span>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-neutral-400">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Portfolio ──────────────────────────────────────────── */}
      <section ref={portfolio.ref} className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2
          className={cn(
            "text-3xl md:text-4xl font-bold text-white text-center mb-16 transition-all duration-700",
            portfolio.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          )}
        >
          Our Work
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PORTFOLIO_PLACEHOLDERS.map((gradient, i) => (
            <div
              key={i}
              className={cn(
                gradient,
                "aspect-square rounded-2xl flex items-center justify-center border border-neutral-800/30 transition-all duration-500",
                portfolio.visible ? "opacity-100 scale-100" : "opacity-0 scale-95",
              )}
              style={{ transitionDelay: portfolio.visible ? `${i * 100}ms` : "0ms" }}
            >
              <span className="text-neutral-500 font-medium text-sm tracking-wide">
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. Pricing ────────────────────────────────────────────── */}
      <section
        ref={pricing.ref}
        id="pricing"
        className={cn("py-24 px-4 sm:px-6 lg:px-8", SECTION_CLASSES.darker)}
      >
        <div className="max-w-7xl mx-auto">
          <h2
            className={cn(
              "text-3xl md:text-4xl font-bold text-white text-center mb-16 transition-all duration-700",
              pricing.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
            )}
          >
            Investment
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {LOGO_TIERS.map((tier, i) => (
              <div
                key={tier.id}
                className={cn(
                  SECTION_CLASSES.card,
                  SECTION_CLASSES.cardHover,
                  "p-6 flex flex-col transition-all duration-500",
                  tier.highlighted && "border-amber-500/60",
                  pricing.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
                )}
                style={{ transitionDelay: pricing.visible ? `${i * 100}ms` : "0ms" }}
              >
                {tier.badge && (
                  <span className="inline-block self-start text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full mb-3">
                    {tier.badge}
                  </span>
                )}
                <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                <p className="text-3xl font-black text-white mt-2 mb-3">{tier.price}</p>
                <p className="text-sm text-neutral-400 mb-6">{tier.description}</p>
                <ul className="space-y-2 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-neutral-300">
                      <CheckCircle2 className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/lumevabarber"
                  hash="contact"
                  className={cn(
                    "w-full text-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                    tier.highlighted
                      ? "bg-amber-500 text-black hover:bg-amber-400"
                      : "border border-neutral-700 text-white hover:border-amber-500/50 hover:text-amber-400",
                  )}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. CTA ────────────────────────────────────────────────── */}
      <section ref={cta.ref} className="py-24 px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "max-w-2xl mx-auto text-center transition-all duration-700",
            cta.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Stand Out?</h2>
          <p className="text-neutral-400 mb-8">
            Your competitors all look the same. Let us create a logo that makes your barbershop the
            obvious choice.
          </p>
          <Link
            to="/lumevabarber"
            hash="contact"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-8 py-3 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
          >
            Book a Free Consultation <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
