"use client";

import { Link } from "@/components/ui/link";
import { ArrowRight, Blocks, Layout, Sparkles, Terminal } from "lucide-react";
import { motion } from "framer-motion";

const pillars = [
  {
    title: "Deploy Anywhere",
    description:
      "Vibe code a full-stack app and deploy it in seconds. Managed infrastructure, zero config.",
    icon: Terminal,
    cta: "Start Deploying",
    href: "/create",
    accent: "cyan",
    gradient: "from-cyan-500/10 to-transparent hover:from-cyan-500/15",
    border: "border-white/[0.04] hover:border-cyan-500/40",
    iconBg:
      "bg-gradient-to-br from-cyan-400/20 to-cyan-600/30 backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.5)]",
    iconColor: "text-cyan-300",
    ctaColor: "text-cyan-400 group-hover:text-cyan-300",
    shadow: "hover:shadow-[0_8px_40px_-12px_rgba(6,182,212,0.4)]",
    pulseBg: "bg-cyan-400",
  },
  {
    title: "App Marketplace",
    description:
      "Hundreds of MCP tools, grouped into on-demand toolsets. spike-cli lazy-loads only what your agent needs — your context window carries signal, not noise.",
    icon: Blocks,
    cta: "Browse Toolsets",
    href: "/mcp",
    accent: "purple",
    gradient: "from-purple-500/10 to-transparent hover:from-purple-500/15",
    border: "border-white/[0.04] hover:border-purple-500/40",
    iconBg:
      "bg-gradient-to-br from-purple-400/20 to-purple-600/30 backdrop-blur-md shadow-[0_0_30px_rgba(168,85,247,0.5)]",
    iconColor: "text-purple-300",
    ctaColor: "text-purple-400 group-hover:text-purple-300",
    shadow: "hover:shadow-[0_8px_40px_-12px_rgba(168,85,247,0.4)]",
    pulseBg: "bg-purple-400",
  },
  {
    title: "Meet Spike",
    description:
      "Your AI assistant that writes its own tools. Understands your codebase and ships production code.",
    icon: Sparkles,
    cta: "Try Spike",
    href: "/chat",
    accent: "emerald",
    gradient: "from-emerald-500/10 to-transparent hover:from-emerald-500/15",
    border: "border-white/[0.04] hover:border-emerald-500/40",
    iconBg:
      "bg-gradient-to-br from-emerald-400/20 to-emerald-600/30 backdrop-blur-md shadow-[0_0_30px_rgba(16,185,129,0.5)]",
    iconColor: "text-emerald-300",
    ctaColor: "text-emerald-400 group-hover:text-emerald-300",
    shadow: "hover:shadow-[0_8px_40px_-12px_rgba(16,185,129,0.4)]",
    pulseBg: "bg-emerald-400",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, filter: "blur(10px)", y: 24 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

export function ThreePillarsSection() {
  return (
    <section className="relative py-32 overflow-hidden bg-background">
      {/* Abstract blurred background mesh for the section */}
      <div className="absolute inset-0 bg-background">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none mix-blend-multiply dark:mix-blend-screen" />
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
              whileHover={{ scale: 1.02 }}
              className="h-full"
              style={{ originY: 0.5 }}
            >
              <Link
                href={pillar.href}
                className="block h-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-[28px] relative"
              >
                {/* Animated Hover Gradient Border */}
                <div
                  className={`absolute -inset-0.5 bg-gradient-to-br ${
                    pillar.gradient.split(" ")[0]
                  } to-transparent rounded-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm z-0`}
                />

                <div
                  className={`relative h-full flex flex-col p-7 sm:p-8 rounded-[32px] bg-card/80 bg-gradient-to-b ${pillar.gradient} border border-border backdrop-blur-3xl transition-all duration-500 hover:-translate-y-3 group-hover:bg-card/60 ${pillar.shadow} z-10 overflow-hidden shadow-2xl`}
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
