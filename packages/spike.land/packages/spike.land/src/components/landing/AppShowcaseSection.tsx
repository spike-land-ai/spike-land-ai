"use client";

import { AppCard } from "@/components/create/app-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { Marquee } from "@/components/ui/marquee";
import type { ShowcaseApp } from "@/lib/landing/showcase-feed";
import { ArrowRight, Blocks } from "lucide-react";
import { motion } from "framer-motion";

interface AppShowcaseSectionProps {
  apps: ShowcaseApp[];
}

export function AppShowcaseSection({ apps }: AppShowcaseSectionProps) {
  if (apps.length === 0) return null;

  return (
    <section className="relative py-32 overflow-hidden">
      {/* Animated Subtle Background Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.08)_0%,transparent_60%)] animate-pulse pointer-events-none mix-blend-screen"
        style={{ animationDuration: "6s" }}
      />

      <div className="container relative mx-auto px-4 z-10">
        <motion.div
          initial={{ opacity: 0, filter: "blur(10px)", x: -20 }}
          whileInView={{ opacity: 1, filter: "blur(0px)", x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 mb-6"
        >
          <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 backdrop-blur-md shadow-[0_0_20px_rgba(34,211,238,0.25)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-cyan-400/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <Blocks className="w-5 h-5 relative z-10" />
          </span>
          <span className="text-sm font-semibold tracking-[0.2em] uppercase text-cyan-300">
            App Ecosystem
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, filter: "blur(15px)", y: 20 }}
          whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold text-foreground mb-8 tracking-tight drop-shadow-lg"
        >
          Built on{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(168,85,247,0.5)]">
            Spike Land
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
          whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl md:text-2xl text-muted-foreground mb-20 max-w-3xl font-light leading-relaxed"
        >
          Full-stack apps deployed from prompts. See what developers are shipping on the platform.
        </motion.p>

        <div className="relative">
          {/* Gradient fade edges */}
          <div
            className="absolute left-0 top-0 bottom-0 w-32 md:w-64 z-10 pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, hsl(var(--background)) 0%, hsl(var(--background) / 0.9) 30%, transparent 100%)",
            }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-32 md:w-64 z-10 pointer-events-none"
            style={{
              background:
                "linear-gradient(to left, hsl(var(--background)) 0%, hsl(var(--background) / 0.9) 30%, transparent 100%)",
            }}
          />

          <Marquee pauseOnHover className="[--duration:50s] py-12">
            {apps.map((app, index) => (
              <motion.div
                key={app.id}
                whileHover={{ y: -12, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="relative shrink-0 w-[300px] sm:w-[340px] mx-6 drop-shadow-[0_30px_50px_rgba(0,0,0,0.8)] cursor-pointer group"
              >
                {/* Glow behind the card on hover */}
                <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-purple-500/0 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500 z-0" />

                {/* Glass Border Container */}
                <div className="absolute inset-0 rounded-[24px] border border-white/10 pointer-events-none z-20 group-hover:border-cyan-500/40 transition-colors duration-500 shadow-[inset_0_0_30px_rgba(255,255,255,0.02)]" />

                {/* Top highlight */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-20 opacity-30 group-hover:opacity-100 transition-opacity duration-500" />

                {index < 3 && (
                  <div className="absolute -top-4 -right-4 z-30 bg-gradient-to-br from-cyan-400 to-blue-600 text-primary-foreground text-[10px] uppercase tracking-widest font-bold px-5 py-2 rounded-full shadow-[0_0_30px_rgba(6,182,212,0.8)] border border-white/30 backdrop-blur-xl group-hover:scale-110 transition-transform duration-300">
                    Featured
                  </div>
                )}

                <AppCard
                  title={app.title}
                  description={app.description}
                  slug={app.slug}
                  viewCount={app.viewCount}
                />
              </motion.div>
            ))}
          </Marquee>
        </div>

        <motion.div
          initial={{ opacity: 0, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-24 text-center"
        >
          <Button
            asChild
            variant="ghost"
            className="text-muted-foreground hover:text-foreground gap-2 transition-all duration-300 group rounded-full px-8 py-6 bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05]"
          >
            <Link href="/apps/store">
              Browse the Store
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
