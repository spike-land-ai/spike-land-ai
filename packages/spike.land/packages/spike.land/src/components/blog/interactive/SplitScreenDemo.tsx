"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CodeSnippet {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  rotation: number;
  scale: number;
}

interface StructuredItem {
  id: number;
  label: string;
  value: string;
  progress: number;
  color: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VIBE_SNIPPETS: readonly string[] = [
  "lgtm",
  "just ship it",
  "works on my machine",
  "TODO: fix later",
  "console.log('why')",
  "any as any",
  "// @ts-ignore",
  "git push -f main",
  "idk try this",
  "no tests needed",
  "revert everything",
  "YOLO deploy",
  "it compiled once",
  "trust the process",
  "pray it works",
];

const VIBE_COLORS: readonly string[] = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#ec4899",
  "#a855f7",
];

const STRUCTURED_ITEMS: readonly StructuredItem[] = [
  {
    id: 1,
    label: "System Prompt",
    value: "Role definition loaded",
    progress: 100,
    color: "#00E5FF",
  },
  { id: 2, label: "Memory State", value: "247 facts indexed", progress: 87, color: "#00E5FF" },
  {
    id: 3,
    label: "Task Context",
    value: "Acceptance criteria set",
    progress: 100,
    color: "#22c55e",
  },
  { id: 4, label: "Tool Schemas", value: "14 tools registered", progress: 100, color: "#22c55e" },
  { id: 5, label: "Output Format", value: "TypeScript strict", progress: 94, color: "#00E5FF" },
  {
    id: 6,
    label: "Constraints",
    value: "No any, no eslint-disable",
    progress: 100,
    color: "#22c55e",
  },
];

// ─── Animated Percentage Counter ──────────────────────────────────────────────

function useCountUp(target: number, duration: number): number {
  const [count, setCount] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startTime.current = null;

    const tick = (timestamp: number) => {
      if (startTime.current === null) {
        startTime.current = timestamp;
      }
      const elapsed = timestamp - startTime.current;
      const rawProgress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - rawProgress, 3);
      setCount(Math.round(eased * target));

      if (rawProgress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return count;
}

// ─── Vibe Coding Panel (Left 40%) ────────────────────────────────────────────

function VibeCodingPanel({ shouldReduceMotion }: { shouldReduceMotion: boolean; }) {
  const percentage = useCountUp(40, 1200);
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setSnippets(
        VIBE_SNIPPETS.slice(0, 6).map((text, i) => ({
          id: i,
          x: 10 + (i % 2) * 45,
          y: 15 + Math.floor(i / 2) * 25,
          text,
          color: VIBE_COLORS[i % VIBE_COLORS.length] ?? "#ef4444",
          rotation: 0,
          scale: 1,
        })),
      );
      return;
    }

    const spawn = () => {
      const id = nextId.current++;
      const snippet: CodeSnippet = {
        id,
        x: 5 + Math.random() * 85,
        y: 5 + Math.random() * 80,
        text: VIBE_SNIPPETS[Math.floor(Math.random() * VIBE_SNIPPETS.length)] ?? "??",
        color: VIBE_COLORS[Math.floor(Math.random() * VIBE_COLORS.length)] ?? "#ef4444",
        rotation: (Math.random() - 0.5) * 30,
        scale: 0.75 + Math.random() * 0.5,
      };
      setSnippets(prev => [...prev.slice(-14), snippet]);
    };

    spawn();
    const interval = setInterval(spawn, 600);
    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* Noisy red glow background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(239,68,68,0.18),transparent_65%)] pointer-events-none" />

      {/* CRT scanline */}
      {!shouldReduceMotion && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)",
          }}
        />
      )}

      {/* Animated snippets */}
      <div className="absolute inset-0">
        {snippets.map(snippet => (
          <motion.div
            key={snippet.id}
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.5, y: 10 }}
            animate={{ opacity: 0.85, scale: snippet.scale, y: 0 }}
            exit={{ opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute font-mono text-[11px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded"
            style={{
              left: `${snippet.x}%`,
              top: `${snippet.y}%`,
              color: snippet.color,
              rotate: snippet.rotation,
              border: `1px solid ${snippet.color}40`,
              background: `${snippet.color}12`,
              textShadow: `0 0 8px ${snippet.color}`,
            }}
          >
            {snippet.text}
          </motion.div>
        ))}
      </div>

      {/* Percentage label */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pt-10">
        <div className="flex items-end gap-1">
          <span
            className="text-red-400 font-black font-mono leading-none"
            style={{ fontSize: "clamp(28px, 5vw, 48px)" }}
          >
            {percentage}%
          </span>
          <span className="text-red-500/70 text-xs font-mono mb-1">effort</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-red-400 font-bold uppercase tracking-widest text-[10px] font-mono">
            Vibe Coding
          </span>
        </div>
        <p className="text-red-500/50 text-[10px] font-mono mt-1">
          Chaos. Intuition. &quot;Just try it.&quot;
        </p>
      </div>
    </div>
  );
}

// ─── Context Engineering Panel (Right 60%) ───────────────────────────────────

function ContextEngineeringPanel({ shouldReduceMotion }: { shouldReduceMotion: boolean; }) {
  const percentage = useCountUp(60, 1400);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      {/* Clean cyan glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(0,229,255,0.12),transparent_60%)] pointer-events-none" />

      {/* Structured content */}
      <div className="absolute inset-0 p-4 flex flex-col gap-2 justify-center">
        {STRUCTURED_ITEMS.map((item, i) => (
          <motion.div
            key={item.id}
            initial={shouldReduceMotion ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12, duration: 0.4, ease: "easeOut" }}
            className="flex items-center gap-2"
          >
            <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-md px-2.5 py-1.5 flex items-center gap-2 min-w-0">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background: item.color,
                  boxShadow: `0 0 6px ${item.color}`,
                }}
              />
              <span className="text-slate-400 text-[10px] font-mono uppercase tracking-wider flex-shrink-0 w-24 truncate">
                {item.label}
              </span>
              <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden mx-1">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: item.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.progress}%` }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.7, ease: "easeOut" }}
                />
              </div>
              <span className="text-slate-300 text-[10px] font-mono flex-shrink-0 truncate max-w-[100px]">
                {item.value}
              </span>
            </div>
          </motion.div>
        ))}

        {/* Attention focus metric */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="mt-1 bg-cyan-500/10 border border-cyan-500/30 rounded-md px-3 py-2 flex items-center justify-between"
        >
          <span className="text-cyan-400 text-[10px] font-mono uppercase tracking-widest">
            Attention signal
          </span>
          <span className="text-cyan-300 font-mono font-bold text-sm">100.0%</span>
        </motion.div>
      </div>

      {/* Percentage label */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pt-10">
        <div className="flex items-end justify-end gap-1">
          <span
            className="text-cyan-400 font-black font-mono leading-none"
            style={{ fontSize: "clamp(28px, 5vw, 48px)" }}
          >
            {percentage}%
          </span>
          <span className="text-cyan-500/70 text-xs font-mono mb-1">effort</span>
        </div>
        <div className="flex items-center justify-end gap-2 mt-1">
          <span className="text-cyan-400 font-bold uppercase tracking-widest text-[10px] font-mono">
            Context Engineering
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,229,255,1)]" />
        </div>
        <p className="text-cyan-500/50 text-[10px] font-mono mt-1 text-right">
          Structure. Memory. Signal clarity.
        </p>
      </div>
    </div>
  );
}

// ─── Split Divider ────────────────────────────────────────────────────────────

function SplitDivider({ shouldReduceMotion }: { shouldReduceMotion: boolean; }) {
  return (
    <div className="absolute inset-y-0 flex flex-col items-center z-10" style={{ left: "40%" }}>
      <div
        className="w-[2px] flex-1"
        style={{
          background:
            "linear-gradient(to bottom, transparent, #00E5FF 15%, #00E5FF 85%, transparent)",
          boxShadow: "0 0 12px rgba(0,229,255,0.7), 0 0 30px rgba(0,229,255,0.3)",
        }}
      />
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2"
        animate={shouldReduceMotion ? {} : { scale: [1, 1.06, 1] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="bg-slate-950 border border-cyan-400/80 rounded-sm px-2 py-0.5 text-[9px] font-black font-mono text-cyan-400 whitespace-nowrap shadow-[0_0_16px_rgba(0,229,255,0.4)]"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            transform: "rotate(180deg)",
            letterSpacing: "0.15em",
          }}
        >
          40 / 60
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SplitScreenDemo() {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <div className="my-8 rounded-xl overflow-hidden shadow-2xl shadow-cyan-900/20 border border-slate-800 relative">
      {/* Header */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-5 py-3 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-slate-400 text-xs font-mono uppercase tracking-widest">
          effort-allocation.viz
        </span>
        <div className="ml-auto flex items-center gap-2 text-[10px] font-mono text-slate-500">
          <span className="text-red-400/80">vibe coding</span>
          <span className="text-slate-600">vs</span>
          <span className="text-cyan-400/80">context engineering</span>
        </div>
      </div>

      {/* Main split view - fixed 40/60 ratio */}
      <div className="aspect-video relative flex">
        {/* Left: Vibe Coding — 40% */}
        <div className="relative overflow-hidden" style={{ width: "40%" }}>
          <VibeCodingPanel shouldReduceMotion={shouldReduceMotion} />
        </div>

        {/* Divider at the 40% mark */}
        <SplitDivider shouldReduceMotion={shouldReduceMotion} />

        {/* Right: Context Engineering — 60% */}
        <div className="relative overflow-hidden" style={{ width: "60%" }}>
          <ContextEngineeringPanel shouldReduceMotion={shouldReduceMotion} />
        </div>
      </div>

      {/* Footer insight bar */}
      <div className="bg-slate-900/90 border-t border-slate-800 px-5 py-2.5 flex items-center justify-between">
        <p className="text-[11px] font-mono text-slate-500">
          <span className="text-white">Key insight:</span>{" "}
          the 60% spent on context engineering determines the quality of the remaining 40%.
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-widest">
            live
          </span>
        </div>
      </div>
    </div>
  );
}
