"use client";

import { TOTAL_TOOL_COUNT } from "../core-logic/components/mcp/mcp-tool-registry";
import { Button } from "../lazy-imports/button";
import { Link } from "../lazy-imports/link";
import { ChevronDown, Rocket, Sparkles, Terminal } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export function LandingHero() {
  const containerRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.9]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 100]);

  // Reduced motion variants: skip blur/translate animations
  const fadeIn = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, filter: "blur(10px)", y: -20 },
        animate: { opacity: 1, filter: "blur(0px)", y: 0 },
      };

  const heroTextAnim = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, filter: "blur(15px)", y: 30 },
        animate: { opacity: 1, filter: "blur(0px)", y: 0 },
      };

  const subtitleAnim = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, filter: "blur(10px)", y: 20 },
        animate: { opacity: 1, filter: "blur(0px)", y: 0 },
      };

  const ctaAnim = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, scale: 0.9, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0 },
      };

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center py-24 sm:py-32"
    >
      <motion.div
        style={shouldReduceMotion ? {} : { opacity, scale, y }}
        className="container relative mx-auto px-4 text-center z-10"
      >
        {/* Badge */}
        <motion.div
          {...fadeIn}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="relative inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.03] border border-white/10 text-sm mb-10 backdrop-blur-3xl overflow-hidden shadow-glow-cyan group hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          {/* Animated border gradient */}
          <div className="absolute inset-0 z-0 bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
          <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/20 to-accent/0 pointer-events-none" />
          <Sparkles className="w-4 h-4 relative text-accent z-10" />
          <span className="font-bold tracking-[0.25em] uppercase text-xs sm:text-[11px] relative text-foreground z-10 drop-shadow-md">
            Open AI App Ecosystem · Instant Deploys
          </span>
        </motion.div>

        <div className="relative inline-block py-4">
          <div className="absolute -inset-20 bg-gradient-to-r from-accent/40 via-primary/40 to-secondary/40 blur-[140px] rounded-[100%] pointer-events-none mix-blend-screen opacity-80" />
          <motion.h1
            {...heroTextAnim}
            transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
            className="relative text-6xl sm:text-8xl md:text-[10rem] text-foreground max-w-6xl mx-auto leading-[0.95] mb-10 tracking-tighter py-2 drop-shadow-2xl"
          >
            <span className="font-light">Less context.</span> <br />
            <span className="text-gradient-primary font-black drop-shadow-[0_0_80px_rgba(168,85,247,0.8)] mix-blend-lighten">
              Better AI.
              <div className="absolute -inset-4 bg-gradient-hero blur-2xl -z-10 mix-blend-screen" />
            </span>
          </motion.h1>
        </div>

        {/* Subtitle */}
        <motion.p
          {...subtitleAnim}
          transition={{ duration: 1.0, delay: 0.6, ease: "easeOut" }}
          className="text-xl sm:text-3xl text-muted-foreground max-w-4xl mx-auto mb-16 font-light leading-relaxed drop-shadow-md"
        >
          Connect your AI agent to the tools it needs, on-demand. Only give your AI the context it
          requires—saving tokens and getting better responses.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          {...ctaAnim}
          transition={{ duration: 1.0, delay: 0.8, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 max-w-xl mx-auto relative z-20"
        >
          <Button
            asChild
            size="lg"
            className="relative bg-primary text-primary-foreground gap-2 text-base px-10 h-16 rounded-full font-bold shadow-glow-cyan hover:shadow-[0_0_80px_rgba(6,182,212,0.8)] transition-all duration-300 hover:scale-[1.05] active:scale-[0.95] w-full sm:w-auto overflow-hidden group border-0"
          >
            <Link href="/create" className="relative z-10 flex items-center justify-center w-full">
              {/* Animated hover gradient background */}
              <div className="absolute inset-0 bg-gradient-accent opacity-80 group-hover:opacity-100 transition-opacity duration-300 z-0" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 group-hover:animate-gradient-x transition-opacity duration-300 z-0" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent z-10" />

              <div className="relative z-10 flex items-center gap-3">
                <Rocket className="w-5 h-5 group-hover:animate-bounce" />
                <span className="tracking-wide text-lg drop-shadow-md">Start Building</span>
              </div>
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-border bg-background/50 backdrop-blur-xl text-muted-foreground hover:text-foreground gap-3 text-base px-10 h-16 rounded-full font-medium w-full sm:w-auto transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.05] hover:border-border/80 active:scale-[0.95] relative group"
          >
            <Link href="/mcp">
              <Terminal className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:text-accent transition-colors" />
              <span className="tracking-wide">Explore MCP Tools</span>
            </Link>
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, filter: shouldReduceMotion ? "none" : "blur(10px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.0, delay: 1.0, ease: "easeOut" }}
          className="mt-20 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground bg-secondary/30 py-4 px-8 rounded-full border border-border/50 backdrop-blur-sm max-w-fit mx-auto"
        >
          <div className="flex items-center gap-2">
            <span className="text-foreground font-bold text-lg">{TOTAL_TOOL_COUNT}+</span>
            <span>Tools</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-foreground font-bold text-lg">Save Context</span>
            <span>/ Token Efficient</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-foreground font-bold text-lg">One Config</span>
            <span>/ All Servers</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-foreground font-bold text-lg">Free</span>
            <span>to start</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground z-20 cursor-pointer p-2 rounded-full hover:bg-secondary/50 hover:text-foreground transition-colors"
        onClick={() =>
          window.scrollTo({
            top: window.innerHeight,
            behavior: shouldReduceMotion ? "instant" : "smooth",
          })
        }
      >
        <div className="flex flex-col items-center gap-2">
          <ChevronDown className="w-6 h-6 opacity-60" />
          <span className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground/50">
            Scroll
          </span>
        </div>
      </motion.div>

      {/* Decorative elements */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden mix-blend-screen" />
    </section>
  );
}
