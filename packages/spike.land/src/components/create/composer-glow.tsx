"use client";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface ComposerGlowProps {
  isFocused: boolean;
  children: ReactNode;
  className?: string;
}

export function ComposerGlow({ isFocused, children, className }: ComposerGlowProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={cn("relative rounded-2xl p-[1px]", className)}>
      {/* Ambient aura blur behind composer */}
      <motion.div
        className="absolute -inset-8 rounded-3xl pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(34,211,238,0.15) 0%, rgba(168,85,247,0.1) 40%, transparent 70%)",
          filter: "blur(60px)",
        }}
        animate={{ opacity: isFocused ? 0.3 : 0.15 }}
        transition={{ duration: 0.4 }}
      />

      {/* Rotating gradient border */}
      <div
        className={cn(
          "absolute inset-[-1px] rounded-2xl transition-opacity duration-400",
          prefersReducedMotion
            ? isFocused
              ? "border-glow-cyan"
              : "border border-white/10 bg-white/5"
            : isFocused
              ? "animate-border-rotate-fast"
              : "animate-border-rotate",
        )}
        style={
          prefersReducedMotion
            ? undefined
            : {
                background: isFocused
                  ? `conic-gradient(from var(--angle), #22d3ee, #a855f7, #d946ef, #22d3ee)`
                  : `conic-gradient(from var(--angle), rgba(255,255,255,0.08), rgba(255,255,255,0.02), rgba(255,255,255,0.08))`,
                opacity: isFocused ? 1 : 0.4,
                WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                padding: "1px",
                borderRadius: "1rem",
              }
        }
      />

      {/* Inner content container */}
      <div
        className={cn(
          "relative glass-2 rounded-2xl transition-shadow duration-400",
          isFocused && "shadow-magic",
          isFocused && !prefersReducedMotion && "shadow-glow-gradient",
        )}
      >
        {children}
      </div>
    </div>
  );
}
