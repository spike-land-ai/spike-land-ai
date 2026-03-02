"use client";

import { motion, type Variants } from "framer-motion";
import { useEffect, useState } from "react";

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.4, 0.25, 1] },
  },
};

const letterVariants: Variants = {
  hidden: { opacity: 0, y: 40, rotateX: -40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      duration: 0.6,
      delay: i * 0.06,
      ease: [0.25, 0.4, 0.25, 1],
    },
  }),
};

const titleText = "BAZDMEG";

export function BazdmegHero() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Animated gradient background orbs */}
      <motion.div
        initial={{ opacity: 0.4 }}
        animate={{
          opacity: [0.4, 0.8, 0.4],
          scale: [1, 1.05, 1],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-amber-500/8 blur-[160px] rounded-full pointer-events-none"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="absolute top-[10%] right-[-10%] w-[400px] h-[400px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 2, delay: 0.8 }}
        className="absolute bottom-[10%] left-[-5%] w-[350px] h-[350px] bg-rose-500/8 blur-[100px] rounded-full pointer-events-none"
      />

      {/* Interactive cursor glow */}
      {mounted && (
        <div
          className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
          style={{
            background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(245, 158, 11, 0.04), transparent 40%)`,
          }}
        />
      )}

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Noise grain overlay */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjgiIG51bU9jdGF2ZXM9IjQiIHN0aXRjaFRpbGVzPSJzdGl0Y2giLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWx0ZXI9InVybCgjbikiIG9wYWNpdHk9IjEiLz48L3N2Zz4=')]" />

      {/* Content */}
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center"
        >
          {/* Badge */}
          <motion.div
            variants={fadeUpVariants}
            className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-[11px] font-semibold uppercase tracking-[0.2em] mb-8 backdrop-blur-sm"
          >
            The Quality First Manifesto
          </motion.div>

          {/* Title with per-letter animation */}
          <motion.h1 variants={fadeUpVariants} className="mb-6">
            <span className="sr-only">{titleText}</span>
            <span
              aria-hidden="true"
              className="flex items-center justify-center text-7xl sm:text-8xl md:text-9xl lg:text-[10rem] font-black tracking-tighter leading-none"
            >
              {titleText.split("").map((letter, i) => (
                <motion.span
                  key={`${letter}-${i}`}
                  custom={i}
                  variants={letterVariants}
                  initial="hidden"
                  animate="visible"
                  className={
                    i >= 4
                      ? "text-amber-500 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]"
                      : "text-white"
                  }
                >
                  {letter}
                </motion.span>
              ))}
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUpVariants}
            className="text-lg sm:text-xl md:text-2xl text-zinc-400 max-w-2xl leading-relaxed mb-4 font-light"
          >
            Seven principles for AI-assisted development.
          </motion.p>

          <motion.p
            variants={fadeUpVariants}
            className="text-base sm:text-lg text-zinc-500 max-w-xl leading-relaxed mb-12"
          >
            Born from pain. <span className="text-zinc-200 font-medium">Tested in production.</span>
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeUpVariants}
            className="flex flex-col sm:flex-row items-center gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="group relative px-8 py-4 bg-white text-zinc-950 font-bold rounded-xl overflow-hidden transition-shadow duration-300 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)]"
              onClick={() =>
                document.getElementById("principles")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              <span className="relative z-10">Learn the Principles</span>
              <div className="absolute inset-0 bg-gradient-to-r from-amber-200 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </motion.button>

            <motion.a
              href="https://github.com/spike-land-ai/spike.land"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="group relative px-8 py-4 bg-transparent text-white font-bold rounded-xl border border-white/10 overflow-hidden transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]"
            >
              <span className="relative z-10 flex items-center gap-2">
                View on GitHub
                <svg
                  className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </span>
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </motion.a>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 1 }}
            className="mt-16"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5"
            >
              <motion.div className="w-1.5 h-1.5 rounded-full bg-white/40" />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
    </div>
  );
}
