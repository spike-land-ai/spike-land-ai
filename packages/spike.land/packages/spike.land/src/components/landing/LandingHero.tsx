"use client";

import { TOTAL_TOOL_COUNT } from "@/components/mcp/mcp-tool-registry";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { ChevronDown, Rocket, Sparkles, Terminal } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export function LandingHero() {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.9]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 100]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center py-24 sm:py-32 overflow-hidden"
    >
      <motion.div
        style={{ opacity, scale, y }}
        className="container relative mx-auto px-4 text-center z-10"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, filter: "blur(10px)", y: -20 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="relative inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.03] border border-white/10 text-sm mb-10 backdrop-blur-3xl overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.2)] group hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          {/* Animated border gradient */}
          <div className="absolute inset-0 z-0 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/0 via-cyan-400/20 to-cyan-400/0 pointer-events-none" />
          <Sparkles className="w-4 h-4 relative text-cyan-500 dark:text-cyan-300 z-10" />
          <span className="font-bold tracking-[0.25em] uppercase text-xs sm:text-[11px] relative text-cyan-950 dark:text-cyan-50 z-10 drop-shadow-md">
            MCP Multiplexer · Lazy Tool Loading
          </span>
        </motion.div>

        <div className="relative inline-block py-4">
          <div className="absolute -inset-20 bg-gradient-to-r from-cyan-500/40 via-purple-500/40 to-pink-500/40 blur-[140px] rounded-[100%] pointer-events-none mix-blend-screen opacity-80" />
          <motion.h1
            initial={{ opacity: 0, filter: "blur(15px)", y: 30 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
            className="relative text-6xl sm:text-8xl md:text-[10rem] text-foreground max-w-6xl mx-auto leading-[0.95] mb-10 tracking-tighter py-2 drop-shadow-2xl"
          >
            <span className="font-light">Less context.</span> <br />
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent font-black drop-shadow-[0_0_80px_rgba(168,85,247,0.8)] mix-blend-lighten">
              Better AI.
              <div className="absolute -inset-4 bg-gradient-to-r from-cyan-400/30 via-fuchsia-500/30 to-purple-600/30 blur-2xl -z-10 mix-blend-screen" />
            </span>
          </motion.h1>
        </div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ duration: 1.0, delay: 0.6, ease: "easeOut" }}
          className="text-xl sm:text-3xl text-muted-foreground max-w-4xl mx-auto mb-16 font-light leading-relaxed drop-shadow-md"
        >
          spike-cli lazy-loads MCP tools into on-demand toolsets. Your AI sees only what it needs —
          less context waste, better responses.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.0, delay: 0.8, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 max-w-xl mx-auto relative z-20"
        >
          <Button
            asChild
            size="lg"
            className="relative bg-primary text-primary-foreground gap-2 text-base px-10 h-16 rounded-full font-bold shadow-[0_0_50px_rgba(6,182,212,0.4)] hover:shadow-[0_0_80px_rgba(6,182,212,0.8)] transition-all duration-300 hover:scale-[1.05] active:scale-[0.95] w-full sm:w-auto overflow-hidden group border-0"
          >
            <Link href="/create" className="relative z-10 flex items-center justify-center w-full">
              {/* Animated hover gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 opacity-80 group-hover:opacity-100 transition-opacity duration-300 z-0" />
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 opacity-0 group-hover:opacity-100 group-hover:animate-gradient-x transition-opacity duration-300 z-0" />
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
              <Terminal className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:text-cyan-300 transition-colors" />
              <span className="tracking-wide">Explore MCP Tools</span>
            </Link>
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.0, delay: 1.0, ease: "easeOut" }}
          className="mt-20 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground bg-secondary/30 py-4 px-8 rounded-full border border-border/50 backdrop-blur-sm max-w-fit mx-auto"
        >
          <div className="flex items-center gap-2">
            <span className="text-foreground font-bold text-lg">
              {TOTAL_TOOL_COUNT}+
            </span>
            <span>Tools</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-foreground font-bold text-lg">Lazy Load</span>
            <span>/ Save Context</span>
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
        onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
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
