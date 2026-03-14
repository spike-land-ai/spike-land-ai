import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Globe,
  Monitor,
  ShieldCheck,
  Smartphone,
  Zap,
} from "lucide-react";

import { cn } from "../../../styling/cn";
import { type PricingTier, SECTION_CLASSES, useIntersectionOnce } from "./shared";

// ── Data ──────────────────────────────────────────────────────────────

const WHY_POINTS = [
  {
    icon: ShieldCheck,
    title: "Trust & Credibility",
    body: "75% of consumers judge credibility from website design alone.",
  },
  {
    icon: Globe,
    title: "24/7 Availability",
    body: "Your website books appointments while you sleep, eat, and cut.",
  },
  {
    icon: Smartphone,
    title: "Mobile-First Clients",
    body: "68% of barbershop searches happen on phones. Your site must be fast.",
  },
  {
    icon: Zap,
    title: "Conversion Machine",
    body: "Every element strategically placed to turn visitors into bookings.",
  },
  {
    icon: CreditCard,
    title: "Premium Positioning",
    body: "A polished website justifies your pricing before clients even call.",
  },
];

const PROCESS_PHASES = [
  {
    step: 1,
    title: "Strategy & Wireframes",
    body: "Map your client journey, plan conversion points, design page flow.",
  },
  {
    step: 2,
    title: "Design & Development",
    body: "Build a fast, mobile-first site with behavioral design principles.",
  },
  {
    step: 3,
    title: "Launch & Optimize",
    body: "Go live, track conversions, optimize based on real visitor data.",
  },
];

const WEBSITE_TIERS: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$890",
    description: "A clean, fast one-page site that gets you online and booking.",
    features: [
      "Single-page responsive design",
      "Mobile-optimized layout",
      "Service menu & pricing display",
      "Google Maps integration",
      "Contact form",
      "Basic SEO setup",
      "1 round of revisions",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: "$1,490",
    description: "Multi-page site with behavioral design and conversion optimization.",
    features: [
      "Up to 5 pages",
      "Behavioral conversion optimization",
      "Online booking integration",
      "Service showcase with pricing",
      "Team/barber profiles",
      "Google Business integration",
      "Social media links",
      "Advanced SEO",
      "Speed optimization (sub-2s load)",
      "3 months of support",
    ],
    highlighted: true,
    badge: "Most Popular",
  },
  {
    id: "booking",
    name: "Booking Pro",
    price: "$2,490",
    description: "Full conversion system with booking, reviews, and client management.",
    features: [
      "Everything in Professional",
      "Custom booking system",
      "Client review showcase",
      "Before/after gallery",
      "Blog/news section",
      "Email capture & newsletter",
      "Analytics dashboard",
      "Priority support (12 months)",
      "Quarterly performance reviews",
    ],
    badge: "Premium",
  },
];

const MOCKUPS = [
  { name: "Classic Cuts Studio", gradient: "from-amber-900/40 to-neutral-900" },
  { name: "The Gentleman's Chair", gradient: "from-neutral-800 to-amber-950/30" },
  { name: "Fade & Shave Co.", gradient: "from-amber-950/40 to-neutral-950" },
];

// ── Section wrapper ───────────────────────────────────────────────────

function Section({
  children,
  id,
  className,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  const { ref, visible } = useIntersectionOnce();
  return (
    <section
      id={id}
      ref={ref}
      className={cn(
        "px-6 py-24 transition-all duration-700",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        className,
      )}
    >
      {children}
    </section>
  );
}

// ── Component ─────────────────────────────────────────────────────────

export function LumevaWebsites() {
  return (
    <div className={cn(SECTION_CLASSES.dark, "min-h-screen")}>
      {/* 1 ── Hero */}
      <section className="min-h-[70vh] flex items-center justify-center px-6 bg-gradient-to-b from-black to-neutral-950">
        <div className="max-w-3xl text-center space-y-6">
          <span className="inline-block text-amber-400 text-sm font-semibold tracking-[0.2em] uppercase">
            Website Design
          </span>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            A Website That Books Appointments While You Cut Hair
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Your website is your 24/7 receptionist. We build sites that convert visitors into booked
            clients using behavioral design principles.
          </p>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-8 py-3 rounded-full transition-colors"
          >
            See Pricing <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* 2 ── Why Websites Matter */}
      <Section className={SECTION_CLASSES.darker}>
        <div className="max-w-5xl mx-auto space-y-12">
          <h2 className="text-3xl md:text-4xl font-bold text-center">
            Why Your Website Is Your Best Employee
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_POINTS.map((p) => (
              <div
                key={p.title}
                className={cn(SECTION_CLASSES.card, SECTION_CLASSES.cardHover, "p-6 space-y-3")}
              >
                <p.icon className="w-8 h-8 text-amber-400" />
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 3 ── Our Process */}
      <Section>
        <div className="max-w-4xl mx-auto space-y-12">
          <h2 className="text-3xl md:text-4xl font-bold text-center">How We Build Your Website</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {PROCESS_PHASES.map((phase) => (
              <div key={phase.step} className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg">
                  {phase.step}
                </div>
                <h3 className="text-xl font-semibold">{phase.title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{phase.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 4 ── Examples (placeholder mockups) */}
      <Section className={SECTION_CLASSES.darker}>
        <div className="max-w-5xl mx-auto space-y-12">
          <h2 className="text-3xl md:text-4xl font-bold text-center">
            What Your Website Could Look Like
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {MOCKUPS.map((m) => (
              <div key={m.name} className="rounded-xl overflow-hidden border border-neutral-800">
                {/* Browser chrome */}
                <div className="bg-neutral-800 px-4 py-2.5 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500/70" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <span className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                {/* Page content placeholder */}
                <div
                  className={cn(
                    "bg-gradient-to-br p-8 min-h-[220px] flex flex-col items-center justify-center gap-4",
                    m.gradient,
                  )}
                >
                  <Monitor className="w-8 h-8 text-amber-400/60" />
                  <p className="text-white/90 font-semibold text-lg text-center">{m.name}</p>
                  <span className="px-5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium">
                    Book Now
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 5 ── Pricing */}
      <Section id="pricing">
        <div className="max-w-5xl mx-auto space-y-12">
          <h2 className="text-3xl md:text-4xl font-bold text-center">Investment</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {WEBSITE_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={cn(
                  SECTION_CLASSES.card,
                  SECTION_CLASSES.cardHover,
                  "p-6 flex flex-col",
                  tier.highlighted && "border-amber-500/50 shadow-amber-500/10 shadow-lg",
                )}
              >
                {tier.badge && (
                  <span className="self-start text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 mb-4">
                    {tier.badge}
                  </span>
                )}
                <h3 className="text-xl font-bold">{tier.name}</h3>
                <p className="text-4xl font-extrabold mt-2 mb-1">{tier.price}</p>
                <p className="text-neutral-400 text-sm mb-6">{tier.description}</p>
                <ul className="space-y-2 flex-1 mb-8">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-neutral-300">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/lumevabarber"
                  hash="contact"
                  className={cn(
                    "text-center py-3 rounded-full font-semibold transition-colors text-sm",
                    tier.highlighted
                      ? "bg-amber-500 hover:bg-amber-400 text-black"
                      : "border border-neutral-700 hover:border-amber-500/50 text-white",
                  )}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 6 ── CTA */}
      <Section className={SECTION_CLASSES.darker}>
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">Let's Build Your Digital Storefront</h2>
          <p className="text-neutral-400 text-lg">
            Your next client is searching for a barber right now. Make sure they find you with a
            website that converts.
          </p>
          <Link
            to="/lumevabarber"
            hash="contact"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-8 py-3 rounded-full transition-colors"
          >
            Start Your Project <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Section>
    </div>
  );
}
