"use client";

import { GlassCard } from "@/components/infographic/shared/GlassCard";
import { InteractiveChecklist } from "@/components/infographic/shared/InteractiveChecklist";
import { ScrollReveal } from "@/components/infographic/shared/ScrollReveal";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const CHECKPOINTS = [
  {
    title: "Pre-Code",
    phase: "1",
    description: "Run this BEFORE the AI writes any code.",
    variant: "high" as const,
    color: "#EAB308",
    glow: "rgba(234,179,8,0.3)",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    items: [
      {
        id: "pc1",
        label: "Can I explain the problem in my own words?",
        checked: false,
      },
      {
        id: "pc2",
        label: "Has the AI interviewed me about requirements?",
        checked: false,
      },
      {
        id: "pc3",
        label: "Do I understand why current code exists?",
        checked: false,
      },
      { id: "pc4", label: "Are my tests green and non-flaky?", checked: false },
    ],
  },
  {
    title: "Post-Code",
    phase: "2",
    description: "Run this AFTER the AI writes code, BEFORE creating a PR.",
    variant: "highlighted" as const,
    color: "#6366F1",
    glow: "rgba(99,102,241,0.3)",
    icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    items: [
      {
        id: "poc1",
        label: "Can I explain every line to a teammate?",
        checked: false,
      },
      {
        id: "poc2",
        label: "Verified assumptions against architecture?",
        checked: false,
      },
      {
        id: "poc3",
        label: "Agents tested it like a human would?",
        checked: false,
      },
      {
        id: "poc4",
        label: "MCP tool tests cover logic at 100%?",
        checked: false,
      },
    ],
  },
  {
    title: "Pre-PR",
    phase: "3",
    description: "Run this BEFORE submitting the pull request.",
    variant: "openClaw" as const,
    color: "#10B981",
    glow: "rgba(16,185,129,0.3)",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    items: [
      {
        id: "pr1",
        label: "Do unit tests prove the code works?",
        checked: false,
      },
      {
        id: "pr2",
        label: "Does TypeScript pass in strict mode?",
        checked: false,
      },
      {
        id: "pr3",
        label: "Can I answer 'why' for every decision?",
        checked: false,
      },
      {
        id: "pr4",
        label: "Comfortable debugging this at 3am?",
        checked: false,
      },
    ],
  },
];

function TimelineConnector({ index }: { index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  if (index >= CHECKPOINTS.length - 1) return null;

  return (
    <div
      ref={ref}
      className="hidden lg:flex items-center justify-center absolute -right-4 top-1/2 -translate-y-1/2 z-10"
    >
      <motion.div
        className="flex items-center"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.6 + index * 0.3 }}
      >
        <motion.div
          className="w-8 h-0.5 bg-gradient-to-r from-white/20 to-white/5"
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 0.6, delay: 0.8 + index * 0.3 }}
          style={{ transformOrigin: "left" }}
        />
        <motion.svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className="text-white/20"
          initial={{ opacity: 0, x: -5 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.3, delay: 1.2 + index * 0.3 }}
        >
          <path d="M2 1L10 6L2 11" fill="currentColor" />
        </motion.svg>
      </motion.div>
    </div>
  );
}

function CheckpointCard({
  checkpoint,
  index,
}: {
  checkpoint: (typeof CHECKPOINTS)[number];
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <div ref={ref} className="relative">
      <ScrollReveal delay={index * 0.2}>
        <GlassCard variant={checkpoint.variant} className="p-6 h-full flex flex-col">
          {/* Phase badge */}
          <motion.div
            className="flex items-center gap-3 mb-4"
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 + index * 0.15 }}
          >
            <motion.div
              className="w-10 h-10 rounded-xl flex items-center justify-center border"
              style={{
                backgroundColor: `${checkpoint.color}15`,
                borderColor: `${checkpoint.color}30`,
              }}
              animate={
                isInView
                  ? {
                      boxShadow: [
                        `0 0 0px ${checkpoint.glow}`,
                        `0 0 20px ${checkpoint.glow}`,
                        `0 0 0px ${checkpoint.glow}`,
                      ],
                    }
                  : {}
              }
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: index * 0.5,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={checkpoint.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={checkpoint.icon} />
              </svg>
            </motion.div>
            <div>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.15em]"
                style={{ color: checkpoint.color }}
              >
                Phase {checkpoint.phase}
              </span>
              <h3 className="text-lg font-bold text-white leading-tight">{checkpoint.title}</h3>
            </div>
          </motion.div>

          <motion.p
            className="text-xs text-zinc-500 mb-5 leading-relaxed"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.4 + index * 0.15 }}
          >
            {checkpoint.description}
          </motion.p>

          {/* Animated divider */}
          <motion.div
            className="h-px mb-5"
            style={{
              background: `linear-gradient(90deg, transparent, ${checkpoint.color}40, transparent)`,
            }}
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: 0.8, delay: 0.5 + index * 0.15 }}
          />

          <div className="mt-auto">
            <InteractiveChecklist
              items={checkpoint.items}
              className="bg-transparent border-none p-0 shadow-none"
            />
          </div>
        </GlassCard>
      </ScrollReveal>

      <TimelineConnector index={index} />
    </div>
  );
}

export function QualityCheckpoints() {
  return (
    <div className="flex flex-col gap-12">
      <div className="text-center max-w-2xl mx-auto">
        <motion.p
          className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400/80 mb-3"
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Mandatory at every stage
        </motion.p>
        <motion.h2
          className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Quality Gates
        </motion.h2>
        <motion.p
          className="text-zinc-400 leading-relaxed"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          The BAZDMEG method enforces discipline through mandatory checkpoints at every stage of
          development.
        </motion.p>
      </div>

      {/* Timeline dots for mobile */}
      <div className="flex lg:hidden justify-center gap-3 -mt-4">
        {CHECKPOINTS.map((cp, i) => (
          <motion.div
            key={cp.phase}
            className="flex items-center gap-2"
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cp.color }} />
            {i < CHECKPOINTS.length - 1 && <div className="w-8 h-px bg-white/10" />}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {CHECKPOINTS.map((checkpoint, i) => (
          <CheckpointCard key={checkpoint.title} checkpoint={checkpoint} index={i} />
        ))}
      </div>
    </div>
  );
}
