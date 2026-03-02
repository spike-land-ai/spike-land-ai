"use client";

import { GlassCard } from "@/components/infographic/shared/GlassCard";
import { ScrollReveal } from "@/components/infographic/shared/ScrollReveal";
import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

interface EffortItem {
  label: string;
  percentage: number;
  color: string;
  gradientTo: string;
  glow: string;
  why: string;
}

const EFFORT_DATA: EffortItem[] = [
  {
    label: "Planning",
    percentage: 30,
    color: "#3B82F6",
    gradientTo: "#60A5FA",
    glow: "rgba(59,130,246,0.45)",
    why: "Understanding the problem, planning interview, verifying understanding",
  },
  {
    label: "Testing",
    percentage: 50,
    color: "#10B981",
    gradientTo: "#34D399",
    glow: "rgba(16,185,129,0.45)",
    why: "Writing tests, running agent-based tests, verifying everything works",
  },
  {
    label: "Quality",
    percentage: 20,
    color: "#F59E0B",
    gradientTo: "#FBBF24",
    glow: "rgba(245,158,11,0.45)",
    why: "Edge cases, maintainability, polish",
  },
  {
    label: "Coding",
    percentage: 0,
    color: "#6B7280",
    gradientTo: "#9CA3AF",
    glow: "rgba(107,114,128,0.2)",
    why: "AI writes the code; you make sure the code is right",
  },
];

const PIE_DATA = EFFORT_DATA.filter((d) => d.percentage > 0);

interface AnimatedCounterProps {
  target: number;
  color: string;
  inView: boolean;
  delay: number;
}

/**
 * Renders a numeric counter that animates from 0 to `target` when `inView` becomes true.
 * Uses a MotionValue + DOM ref for smooth updates without React re-renders.
 */
function AnimatedCounter({ target, color, inView, delay }: AnimatedCounterProps) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v));
  const displayRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(motionValue, target, {
      duration: 1.4,
      delay,
      ease: [0.25, 0.46, 0.45, 0.94],
    });
    return () => controls.stop();
  }, [inView, motionValue, target, delay]);

  useEffect(() => {
    const unsubscribe = rounded.on("change", (v) => {
      if (displayRef.current) {
        displayRef.current.textContent = `${v}%`;
      }
    });
    return unsubscribe;
  }, [rounded]);

  return (
    <span ref={displayRef} className="text-sm font-mono tabular-nums" style={{ color }}>
      0%
    </span>
  );
}

interface AnimatedBarProps {
  item: EffortItem;
  index: number;
}

function AnimatedBar({ item, index }: AnimatedBarProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <motion.div
      ref={ref}
      className="flex flex-col gap-3"
      initial={{ opacity: 0, x: 24 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.12 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <motion.div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: item.color }}
            animate={
              isInView
                ? {
                    boxShadow: [
                      `0 0 0px ${item.glow}`,
                      `0 0 14px ${item.glow}`,
                      `0 0 0px ${item.glow}`,
                    ],
                  }
                : {}
            }
            transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
          />
          <span className="font-semibold text-white tracking-wide text-sm">{item.label}</span>
        </div>
        <AnimatedCounter
          target={item.percentage}
          color={item.color}
          inView={isInView}
          delay={0.3 + index * 0.12}
        />
      </div>

      {/* Bar track */}
      <div className="h-3 w-full bg-zinc-800/80 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full relative overflow-hidden"
          style={{
            background: `linear-gradient(90deg, ${item.color}, ${item.gradientTo})`,
            boxShadow: `0 0 12px ${item.glow}`,
          }}
          initial={{ width: "0%" }}
          animate={isInView ? { width: `${item.percentage}%` } : { width: "0%" }}
          transition={{
            duration: 1.4,
            delay: 0.2 + index * 0.12,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          {/* Shimmer sweep on fill */}
          {item.percentage > 0 && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              initial={{ x: "-100%" }}
              animate={isInView ? { x: "220%" } : { x: "-100%" }}
              transition={{
                duration: 0.8,
                delay: 1.5 + index * 0.12,
                ease: "easeInOut",
              }}
            />
          )}
        </motion.div>
      </div>

      <p className="text-xs text-zinc-500 leading-relaxed pl-5">{item.why}</p>
    </motion.div>
  );
}

interface CenterLabelProps {
  inView: boolean;
}

function CenterLabel({ inView }: CenterLabelProps) {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.6, delay: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <motion.span
        className="text-4xl font-black text-white leading-none"
        animate={
          inView
            ? {
                textShadow: [
                  "0 0 0px rgba(255,255,255,0)",
                  "0 0 20px rgba(255,255,255,0.3)",
                  "0 0 0px rgba(255,255,255,0)",
                ],
              }
            : {}
        }
        transition={{
          duration: 2.2,
          delay: 1.5,
          repeat: Infinity,
          repeatDelay: 3,
        }}
      >
        0%
      </motion.span>
      <span className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Coding</span>
    </motion.div>
  );
}

export function EffortSplit() {
  const chartRef = useRef(null);
  const isChartInView = useInView(chartRef, { once: true, amount: 0.3 });

  return (
    <ScrollReveal>
      <GlassCard className="p-8 md:p-10">
        <div className="text-center mb-10">
          <motion.p
            className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500/80 mb-3"
            initial={{ opacity: 0, y: -10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Where your time actually goes
          </motion.p>
          <motion.h3
            className="text-3xl md:text-4xl font-black text-white tracking-tight"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            The Effort Split
          </motion.h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Donut chart */}
          <div ref={chartRef} className="relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.75, rotate: -90 }}
              animate={
                isChartInView
                  ? { opacity: 1, scale: 1, rotate: 0 }
                  : { opacity: 0, scale: 0.75, rotate: -90 }
              }
              transition={{ duration: 1.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={PIE_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={4}
                    dataKey="percentage"
                    stroke="none"
                    animationBegin={0}
                    animationDuration={1500}
                    animationEasing="ease-out"
                  >
                    {PIE_DATA.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </motion.div>

            <CenterLabel inView={isChartInView} />
          </div>

          {/* Animated bars */}
          <div className="flex flex-col gap-6">
            {EFFORT_DATA.map((item, i) => (
              <AnimatedBar key={item.label} item={item} index={i} />
            ))}
          </div>
        </div>

        {/* Quote */}
        <motion.div
          className="mt-10 p-5 bg-amber-500/5 border border-amber-500/15 rounded-xl text-center"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <p className="text-amber-400/90 text-sm italic leading-relaxed">
            &ldquo;Stop coding. Start orchestrating. Coding is the side effect of good
            requirements.&rdquo;
          </p>
        </motion.div>
      </GlassCard>
    </ScrollReveal>
  );
}
