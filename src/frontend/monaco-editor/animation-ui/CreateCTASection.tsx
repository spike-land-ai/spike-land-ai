"use client";

import { Button } from "../lazy-imports/button";
import { Link } from "../lazy-imports/link";
import { ArrowRight, BookOpen, ExternalLink, Rocket } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const METRICS = [
  { value: "30s", label: "Deploy time" },
  { value: "Zero Config", label: "Infrastructure" },
  { value: "100%", label: "AI-generated" },
] as const;

export function CreateCTASection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative py-48 overflow-hidden bg-background/20">
      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:60px_60px] opacity-40 pointer-events-none" />

      {/* Decorative gradient background */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(var(--accent)/0.15)_0%,transparent_70%)] animate-pulse"
        style={{ animationDuration: shouldReduceMotion ? "0s" : "4s" }}
      />

      <div className="container relative mx-auto px-4 text-center">
        <motion.div
          initial={{
            opacity: 0,
            scale: shouldReduceMotion ? 1 : 0.95,
            y: shouldReduceMotion ? 0 : 30,
          }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: shouldReduceMotion ? 0.2 : 1.0, ease: "easeOut" }}
          className="max-w-5xl mx-auto relative"
        >
          {/* Subtle background glow behind text */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-gradient-hero rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

          <motion.h2
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-6xl md:text-8xl lg:text-9xl font-bold text-foreground mb-10 tracking-tighter drop-shadow-2xl z-10 relative leading-[1.05]"
          >
            Ready to ship <br />
            <span className="text-gradient-primary">faster?</span>
          </motion.h2>

          <motion.p
            initial={{
              opacity: 0,
              y: shouldReduceMotion ? 0 : 20,
              filter: shouldReduceMotion ? "none" : "blur(5px)",
            }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-2xl md:text-3xl text-muted-foreground mb-12 max-w-3xl mx-auto font-light leading-relaxed drop-shadow-md z-10 relative"
          >
            Describe what you want. Spike builds it. Deploy in seconds.
            <span className="font-medium text-foreground block mt-2">
              It really is that simple.
            </span>
          </motion.p>

          {/* Key metrics row */}
          <div className="flex items-center justify-center gap-0 mb-20 z-10 relative">
            {METRICS.map((metric, index) => (
              <motion.div
                key={metric.value}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: shouldReduceMotion ? 0 : 0.35 + index * 0.1 }}
                className="flex items-center"
              >
                <div className="flex flex-col items-center px-8 py-4">
                  <span className="text-2xl md:text-3xl font-bold text-gradient-primary leading-tight">
                    {metric.value}
                  </span>
                  <span className="text-sm text-muted-foreground mt-1 tracking-wide">
                    {metric.label}
                  </span>
                </div>
                {index < METRICS.length - 1 && (
                  <div className="h-10 w-px bg-white/10 flex-shrink-0" />
                )}
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-8 z-10 relative"
          >
            <Button
              asChild
              size="lg"
              className="relative bg-background border border-accent/50 text-foreground gap-3 text-base px-14 h-16 rounded-full font-bold shadow-glow-cyan hover:shadow-[0_0_80px_rgba(6,182,212,0.8)] transition-all duration-300 hover:scale-[1.05] active:scale-[0.95] w-full sm:w-auto overflow-hidden group"
            >
              <Link
                href="/create"
                className="relative z-10 flex items-center justify-center w-full"
              >
                {/* Animated hover gradient background */}
                <div className="absolute inset-0 bg-gradient-accent opacity-80 group-hover:opacity-100 transition-opacity duration-300 z-0" />
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 group-hover:animate-gradient-x transition-opacity duration-300 z-0" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent z-10" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />

                <div className="relative z-10 flex items-center gap-4">
                  <Rocket className="w-5 h-5 group-hover:animate-bounce drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  <span className="tracking-wide drop-shadow-md">Start Building</span>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/10 bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-2xl text-muted-foreground hover:text-foreground gap-3 transition-all duration-300 text-base px-12 h-16 rounded-full font-medium shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:scale-[1.05] hover:border-white/30 active:scale-[0.95] group relative w-full sm:w-auto"
            >
              <Link href="/docs">
                <BookOpen className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:text-accent transition-colors drop-shadow-sm" />
                <span className="tracking-wide drop-shadow-sm">Read the Docs</span>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-all duration-300 group-hover:translate-x-2" />
              </Link>
            </Button>

            <Button
              asChild
              variant="ghost"
              size="lg"
              className="text-muted-foreground hover:text-foreground gap-3 transition-all duration-300 text-base px-10 h-16 rounded-full font-medium hover:scale-[1.05] active:scale-[0.95] group relative hover:bg-white/[0.05] w-full sm:w-auto"
            >
              <Link href="/apps/store">
                <ExternalLink className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:text-primary transition-colors" />
                <span className="tracking-wide">View Examples</span>
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
