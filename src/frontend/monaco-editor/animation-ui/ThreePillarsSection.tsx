"use client";

import { Link } from "../lazy-imports/link";
import { ArrowRight, Blocks, Layout, Sparkles, Terminal } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const pillars = [
  {
    title: "Deploy Anywhere",
    description:
      "Vibe code a full-stack app and deploy it in seconds. Managed infrastructure, zero config.",
    icon: Terminal,
    cta: "Start Deploying",
    href: "/create",
    gradient: "from-accent/10 to-transparent hover:from-accent/15",
    border: "border-white/[0.04] hover:border-accent/40",
    iconBg: "bg-gradient-to-br from-accent/20 to-accent/30 backdrop-blur-md shadow-glow-cyan",
    iconColor: "text-accent",
    ctaColor: "text-accent/80 group-hover:text-accent",
    shadow: "hover:shadow-[0_8px_40px_-12px_rgba(6,182,212,0.4)]",
    pulseBg: "bg-accent",
  },
  {
    title: "App Marketplace",
    description:
      "Hundreds of MCP tools, grouped into on-demand toolsets. Your AI sees only what it needs — your context window carries signal, not noise.",
    icon: Blocks,
    cta: "Browse Toolsets",
    href: "/mcp",
    gradient: "from-primary/10 to-transparent hover:from-primary/15",
    border: "border-white/[0.04] hover:border-primary/40",
    iconBg: "bg-gradient-to-br from-primary/20 to-primary/30 backdrop-blur-md shadow-glow-primary",
    iconColor: "text-primary",
    ctaColor: "text-primary/80 group-hover:text-primary",
    shadow: "hover:shadow-[0_8px_40px_-12px_rgba(168,85,247,0.4)]",
    pulseBg: "bg-primary",
  },
  {
    title: "Meet Spike",
    description:
      "Your AI assistant that writes its own tools. Understands your codebase and ships production code.",
    icon: Sparkles,
    cta: "Try Spike",
    href: "/chat",
    gradient: "from-aurora-green/10 to-transparent hover:from-aurora-green/15",
    border: "border-white/[0.04] hover:border-aurora-green/40",
    iconBg:
      "bg-gradient-to-br from-aurora-green/20 to-aurora-green/30 backdrop-blur-md shadow-[0_0_30px_rgba(16,185,129,0.5)]",
    iconColor: "text-aurora-green",
    ctaColor: "text-aurora-green/80 group-hover:text-aurora-green",
    shadow: "hover:shadow-[0_8px_40px_-12px_rgba(16,185,129,0.4)]",
    pulseBg: "bg-aurora-green",
  },
];

export function ThreePillarsSection() {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.15 },
    },
  };

  const itemVariants = {
    hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(10px)", y: 24 },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: { duration: shouldReduceMotion ? 0.2 : 0.6, ease: "easeOut" as const },
    },
  };

  const headerVariants = {
    hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: shouldReduceMotion ? 0.2 : 0.6, ease: "easeOut" as const },
    },
  };

  return (
    <section className="relative py-32 overflow-hidden bg-background">
      {/* Abstract blurred background mesh for the section */}
      <div className="absolute inset-0 bg-background">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-accent/10 blur-[130px] rounded-full pointer-events-none mix-blend-screen" />
      </div>

      <div className="container relative mx-auto px-4 z-10">
        {/* Section header */}
        <motion.div
          variants={headerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-card/60 backdrop-blur-sm text-sm text-muted-foreground mb-6">
            <Layout className="w-4 h-4" />
            <span>Platform</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight mb-4">
            Everything you need to build
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Deploy apps, connect tools, and build with AI — all from one platform.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 max-w-7xl mx-auto"
        >
          {pillars.map((pillar) => (
            <motion.div
              key={pillar.title}
              variants={itemVariants}
              {...(shouldReduceMotion ? {} : { whileHover: { scale: 1.02 } })}
              className="h-full"
              style={{ originY: 0.5 }}
            >
              <Link
                href={pillar.href}
                className="block h-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[28px] relative"
              >
                {/* Animated Hover Gradient Border */}
                <div
                  className={`absolute -inset-0.5 bg-gradient-to-br ${
                    pillar.gradient.split(" ")[0]
                  } to-transparent rounded-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm z-0`}
                />

                <div
                  className={`relative h-full flex flex-col p-7 sm:p-8 rounded-[32px] glass-card bg-gradient-to-b ${pillar.gradient} border border-border transition-all duration-500 hover:-translate-y-3 group-hover:bg-card/60 ${pillar.shadow} z-10 overflow-hidden shadow-2xl`}
                >
                  <div className="absolute inset-0 rounded-[28px] bg-card/60 -z-10" />

                  {/* Subtle noise texture */}
                  <div className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none bg-noise bg-[url('/noise.png')] z-0 rounded-[32px]" />

                  {/* Subtle top glare */}
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-10 opacity-50 group-hover:opacity-100 transition-opacity" />

                  <div
                    className={`relative inline-flex items-center justify-center w-16 h-16 rounded-[24px] ${pillar.iconBg} mb-8 border border-white/20 transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6 group-hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] z-10 overflow-hidden`}
                  >
                    {/* Pulse effect on icon background */}
                    <div className="absolute inset-0 bg-white/20 animate-pulse mix-blend-overlay" />
                    <pillar.icon
                      className={`relative w-7 h-7 ${pillar.iconColor} filter drop-shadow-md z-10`}
                    />
                    {/* Accent pulse dot badge */}
                    <span
                      className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${pillar.pulseBg} z-20 shadow-md`}
                    >
                      <span
                        className={`absolute inset-0 rounded-full ${pillar.pulseBg} animate-ping opacity-75`}
                      />
                    </span>
                  </div>

                  <h3 className="relative text-3xl font-bold text-foreground mb-4 tracking-tight z-10 group-hover:text-primary transition-colors drop-shadow-sm">
                    {pillar.title}
                  </h3>

                  <p className="relative text-muted-foreground group-hover:text-foreground transition-colors text-lg leading-relaxed mb-10 flex-1 z-10 font-light drop-shadow-sm">
                    {pillar.description}
                  </p>

                  <span
                    className={`relative inline-flex items-center gap-2 text-sm font-bold tracking-widest uppercase ${pillar.ctaColor} transition-colors z-10`}
                  >
                    {pillar.cta}
                    <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-2" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
