"use client";

import { ScrollReveal } from "@/components/infographic/shared/ScrollReveal";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

function AnimatedHourglassSvg() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.8 }}
      className="absolute inset-0 pointer-events-none"
      aria-hidden
    >
      <svg
        viewBox="0 0 400 600"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hg-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(99,102,241,0.15)" />
            <stop offset="100%" stopColor="rgba(99,102,241,0.02)" />
          </linearGradient>
          <linearGradient id="hg-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(245,158,11,0.12)" />
            <stop offset="100%" stopColor="rgba(245,158,11,0.04)" />
          </linearGradient>
          <linearGradient id="hg-bot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(16,185,129,0.02)" />
            <stop offset="100%" stopColor="rgba(16,185,129,0.15)" />
          </linearGradient>
          <linearGradient id="hg-flow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(99,102,241,0.6)">
              <animate
                attributeName="stopColor"
                values="rgba(99,102,241,0.6);rgba(245,158,11,0.6);rgba(16,185,129,0.6);rgba(99,102,241,0.6)"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="rgba(16,185,129,0.6)">
              <animate
                attributeName="stopColor"
                values="rgba(16,185,129,0.6);rgba(99,102,241,0.6);rgba(245,158,11,0.6);rgba(16,185,129,0.6)"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>

        {/* Hourglass outline shape */}
        <motion.path
          d="M 60 40 L 340 40 Q 340 40 340 50 L 220 260 Q 200 290 200 300 Q 200 310 220 340 L 340 550 Q 340 560 340 560 L 60 560 Q 60 560 60 550 L 180 340 Q 200 310 200 300 Q 200 290 180 260 L 60 50 Q 60 40 60 40 Z"
          stroke="url(#hg-flow)"
          strokeWidth="1.5"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={isInView ? { pathLength: 1, opacity: 0.4 } : {}}
          transition={{ duration: 2.5, ease: "easeInOut" }}
        />

        {/* Fill zones */}
        <motion.path
          d="M 70 50 L 330 50 L 215 255 Q 200 280 185 255 L 70 50 Z"
          fill="url(#hg-top)"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 1, duration: 1 }}
        />
        <motion.ellipse
          cx="200"
          cy="300"
          rx="25"
          ry="35"
          fill="url(#hg-mid)"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 1.5, duration: 0.8 }}
        />
        <motion.path
          d="M 70 550 L 330 550 L 215 345 Q 200 320 185 345 L 70 550 Z"
          fill="url(#hg-bot)"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 1.2, duration: 1 }}
        />

        {/* Animated falling particles */}
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} r="2" fill="rgba(245,158,11,0.7)">
            <animateMotion
              dur={`${2.5 + i * 0.4}s`}
              repeatCount="indefinite"
              begin={`${i * 0.5}s`}
              path="M 200 120 Q 200 200 200 280 Q 200 320 200 380 Q 200 440 200 500"
            />
            <animate
              attributeName="opacity"
              values="0;0.8;0.8;0"
              dur={`${2.5 + i * 0.4}s`}
              repeatCount="indefinite"
              begin={`${i * 0.5}s`}
            />
            <animate
              attributeName="r"
              values="1.5;2.5;1"
              dur={`${2.5 + i * 0.4}s`}
              repeatCount="indefinite"
              begin={`${i * 0.5}s`}
            />
          </circle>
        ))}
      </svg>
    </motion.div>
  );
}

function GlowOrb({ color, className }: { color: string; className: string }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      style={{ background: color }}
      animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function HourglassModel() {
  return (
    <div className="flex flex-col gap-12 items-center">
      <div className="text-center max-w-2xl">
        <h2 className="text-3xl font-bold text-white mb-4">Hourglass Testing Model</h2>
        <p className="text-zinc-400">
          Reverse the traditional pyramid. Focus on what matters: the requirements and the business
          logic.
        </p>
      </div>

      <div className="relative w-full max-w-xl flex flex-col items-center gap-4">
        {/* Background SVG hourglass */}
        <AnimatedHourglassSvg />

        {/* Ambient glow orbs */}
        <GlowOrb color="rgba(99,102,241,0.15)" className="w-48 h-48 -top-12 -left-12" />
        <GlowOrb color="rgba(16,185,129,0.12)" className="w-56 h-56 -bottom-16 -right-12" />

        {/* E2E Specs */}
        <ScrollReveal
          variants={{
            initial: { opacity: 0, y: -20, scale: 0.95 },
            animate: { opacity: 1, y: 0, scale: 1 },
          }}
          className="w-full relative z-10"
        >
          <motion.div
            whileHover={{
              scale: 1.02,
              boxShadow: "0 0 60px rgba(99,102,241,0.2)",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-6 text-center shadow-[0_0_40px_rgba(99,102,241,0.1)] backdrop-blur-sm"
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-indigo-400 px-2 py-1 bg-indigo-500/10 rounded uppercase tracking-wide">
                20% Share
              </span>
              <span className="text-xs font-mono text-zinc-500 italic">Humans write these</span>
            </div>
            <h4 className="text-xl font-bold text-white mb-2">E2E Specs (Heavy)</h4>
            <p className="text-sm text-zinc-400">
              User flows as Given/When/Then. Wiring verification only.
            </p>
          </motion.div>
        </ScrollReveal>

        {/* Animated connector */}
        <div className="relative z-10 flex flex-col items-center">
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            whileInView={{ height: 48, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-0.5 bg-gradient-to-b from-indigo-500/60 to-amber-500/60 relative overflow-hidden rounded-full"
          >
            <motion.div
              className="absolute w-full h-3 bg-gradient-to-b from-white/40 to-transparent rounded-full"
              animate={{ y: [-12, 48] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="w-2 h-2 rounded-full bg-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
          />
        </div>

        {/* UI Code (The Narrow Part) */}
        <ScrollReveal
          delay={0.2}
          variants={{
            initial: { opacity: 0, width: "20%", scale: 0.9 },
            animate: { opacity: 1, width: "60%", scale: 1 },
          }}
          className="mx-auto relative z-10"
        >
          <motion.div
            whileHover={{
              scale: 1.03,
              boxShadow: "0 0 40px rgba(245,158,11,0.15)",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center backdrop-blur-sm"
          >
            <motion.div
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-[10px] font-bold text-amber-500 px-2 py-0.5 bg-amber-500/10 rounded uppercase inline-block mb-2"
            >
              Disposable
            </motion.div>
            <h4 className="text-lg font-bold text-white mb-1">UI Code</h4>
            <p className="text-xs text-zinc-400">AI generates this. Regenerate, don&apos;t fix.</p>
          </motion.div>
        </ScrollReveal>

        {/* Animated connector */}
        <div className="relative z-10 flex flex-col items-center">
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-2 h-2 rounded-full bg-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
          />
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            whileInView={{ height: 48, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            className="w-0.5 bg-gradient-to-b from-amber-500/60 to-emerald-500/60 relative overflow-hidden rounded-full"
          >
            <motion.div
              className="absolute w-full h-3 bg-gradient-to-b from-white/40 to-transparent rounded-full"
              animate={{ y: [-12, 48] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "linear",
                delay: 0.5,
              }}
            />
          </motion.div>
        </div>

        {/* Business Logic */}
        <ScrollReveal
          delay={0.4}
          variants={{
            initial: { opacity: 0, y: 20, scale: 0.95 },
            animate: { opacity: 1, y: 0, scale: 1 },
          }}
          className="w-full relative z-10"
        >
          <motion.div
            whileHover={{
              scale: 1.02,
              boxShadow: "0 0 80px rgba(16,185,129,0.2)",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center shadow-[0_0_50px_rgba(16,185,129,0.1)] backdrop-blur-sm relative overflow-hidden"
          >
            {/* Animated shimmer */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
                repeatDelay: 2,
              }}
            />
            <div className="relative">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-emerald-400 px-2 py-1 bg-emerald-500/10 rounded uppercase tracking-wide">
                  70% Share
                </span>
                <span className="text-xs font-mono text-zinc-500 italic">Bulletproof Core</span>
              </div>
              <h4 className="text-2xl font-black text-white mb-3 uppercase tracking-wider">
                Business Logic Tests (HEAVY)
              </h4>
              <p className="text-sm text-zinc-400">
                MCP tools + Unit tests. Validation, contracts, state transitions, edge cases. Never
                skip.
              </p>
            </div>
          </motion.div>
        </ScrollReveal>
      </div>
    </div>
  );
}
