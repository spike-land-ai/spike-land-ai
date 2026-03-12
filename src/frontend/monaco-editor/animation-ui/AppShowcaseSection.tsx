"use client";

import { AppCard } from "../ui/@/components/create/app-card";
import { Button } from "../lazy-imports/button";
import { Link } from "../lazy-imports/link";
import { Marquee } from "../ui/@/components/ui/marquee";
import type { ShowcaseApp } from "../core-logic/lib/landing/showcase-feed";
import { ArrowRight, Blocks } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

interface AppShowcaseSectionProps {
  apps: ShowcaseApp[];
}

export function AppShowcaseSection({ apps }: AppShowcaseSectionProps) {
  const shouldReduceMotion = useReducedMotion();

  if (apps.length === 0) return null;

  return (
    <section className="relative py-32 overflow-hidden">
      {/* Animated Subtle Background Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] bg-[radial-gradient(ellipse_at_center,hsl(var(--accent)/0.08)_0%,transparent_60%)] pointer-events-none mix-blend-screen"
        style={shouldReduceMotion ? {} : { animation: "pulse 6s ease-in-out infinite" }}
      />

      <div className="container relative mx-auto px-4 z-10">
        <motion.div
          initial={{
            opacity: 0,
            filter: shouldReduceMotion ? "none" : "blur(10px)",
            x: shouldReduceMotion ? 0 : -20,
          }}
          whileInView={{ opacity: 1, filter: "blur(0px)", x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 mb-6"
        >
          <span className="p-2 rounded-xl bg-accent/10 border border-accent/30 text-accent backdrop-blur-md shadow-glow-cyan-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-accent/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <Blocks className="w-5 h-5 relative z-10" />
          </span>
          <span className="text-sm font-semibold tracking-[0.2em] uppercase text-accent">
            App Ecosystem
          </span>
        </motion.div>

        <motion.h2
          initial={{
            opacity: 0,
            filter: shouldReduceMotion ? "none" : "blur(15px)",
            y: shouldReduceMotion ? 0 : 20,
          }}
          whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold text-foreground mb-8 tracking-tight drop-shadow-lg"
        >
          Built on{" "}
          <span className="text-gradient-primary drop-shadow-[0_0_40px_rgba(168,85,247,0.5)]">
            Spike Land
          </span>
        </motion.h2>

        <motion.p
          initial={{
            opacity: 0,
            filter: shouldReduceMotion ? "none" : "blur(10px)",
            y: shouldReduceMotion ? 0 : 20,
          }}
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
                {...(shouldReduceMotion ? {} : { whileHover: { y: -12, scale: 1.015 } })}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="relative shrink-0 w-[300px] sm:w-[340px] mx-6 drop-shadow-[0_30px_50px_rgba(0,0,0,0.8)] cursor-pointer group"
              >
                {/* Glow behind the card on hover */}
                <div className="absolute -inset-4 bg-gradient-to-r from-accent/0 via-accent/20 to-primary/0 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500 z-0" />

                {/* Glass Border Container */}
                <div className="absolute inset-0 rounded-[24px] border border-white/10 pointer-events-none z-20 group-hover:border-accent/40 transition-colors duration-500 shadow-[inset_0_0_30px_rgba(255,255,255,0.02)]" />

                {/* Top highlight */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-20 opacity-30 group-hover:opacity-100 transition-opacity duration-500" />

                {index < 3 && (
                  <div className="absolute -top-4 -right-4 z-30 bg-gradient-accent text-primary-foreground text-[10px] uppercase tracking-widest font-bold px-5 py-2 rounded-full shadow-glow-cyan border border-white/30 backdrop-blur-xl group-hover:scale-110 transition-transform duration-300">
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
          initial={{ opacity: 0, filter: shouldReduceMotion ? "none" : "blur(10px)" }}
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
