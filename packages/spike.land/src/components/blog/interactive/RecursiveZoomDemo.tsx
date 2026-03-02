"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useInViewProgress } from "./useInViewProgress";

type ZoomLevel = {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
};

const ZOOM_LEVELS: ZoomLevel[] = [
  {
    id: "plan",
    label: "Plan Mode",
    sublabel: "Claude analyses the task and writes a structured plan",
    color: "#c084fc",
    bgColor: "rgba(192,132,252,0.08)",
    borderColor: "rgba(192,132,252,0.35)",
    icon: "P",
  },
  {
    id: "agent",
    label: "Agent Design",
    sublabel: "Sub-agents are spawned with scoped context windows",
    color: "#38bdf8",
    bgColor: "rgba(56,189,248,0.08)",
    borderColor: "rgba(56,189,248,0.35)",
    icon: "A",
  },
  {
    id: "tools",
    label: "Tool Calls",
    sublabel: "Agents invoke Read, Edit, Bash and MCP tools",
    color: "#34d399",
    bgColor: "rgba(52,211,153,0.08)",
    borderColor: "rgba(52,211,153,0.35)",
    icon: "T",
  },
  {
    id: "results",
    label: "Results",
    sublabel: "Tool outputs are parsed and validated",
    color: "#fbbf24",
    bgColor: "rgba(251,191,36,0.08)",
    borderColor: "rgba(251,191,36,0.35)",
    icon: "R",
  },
  {
    id: "feedback",
    label: "Feedback Loop",
    sublabel: "Diff, tests and lint outcomes fed back to agent",
    color: "#f87171",
    bgColor: "rgba(248,113,113,0.08)",
    borderColor: "rgba(248,113,113,0.35)",
    icon: "F",
  },
];

const TOTAL = ZOOM_LEVELS.length;

type CardProps = {
  level: ZoomLevel;
  depth: number;
  currentDepth: number;
  autoPlaying: boolean;
};

function LevelCard({ level, depth, currentDepth, autoPlaying }: CardProps) {
  const isActive = depth === currentDepth;
  const isPast = depth < currentDepth;
  const scale = 1 - (currentDepth - depth) * 0.06;
  const translateY = (currentDepth - depth) * -10;
  const nextLevel = ZOOM_LEVELS[(depth + 1) % TOTAL];
  const firstLevel = ZOOM_LEVELS[0];

  return (
    <motion.div
      className="absolute inset-0 rounded-xl border flex flex-col p-5 sm:p-7 overflow-hidden"
      style={{
        background: level.bgColor,
        borderColor: level.borderColor,
      }}
      animate={{
        scale: scale,
        y: translateY,
        opacity: isPast ? 0.35 : 1,
        filter: isPast ? "blur(1px)" : "blur(0px)",
      }}
      transition={{ type: "spring", stiffness: 200, damping: 28 }}
    >
      {isActive && autoPlaying && (
        <motion.div
          className="absolute left-0 right-0 h-px opacity-30"
          style={{ background: level.color }}
          animate={{ top: ["0%", "100%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      )}

      <div
        className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono"
        style={{
          background: level.bgColor,
          border: `1px solid ${level.borderColor}`,
          color: level.color,
        }}
      >
        {level.icon}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background: level.color,
            boxShadow: isActive ? `0 0 8px ${level.color}` : "none",
          }}
        />
        <span
          className="text-xs font-mono uppercase tracking-widest"
          style={{ color: level.color }}
        >
          Depth {depth + 1} / {TOTAL}
        </span>
      </div>

      <h3 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: level.color }}>
        {level.label}
      </h3>

      <p className="text-sm text-slate-400 font-mono leading-relaxed flex-1">{level.sublabel}</p>

      {depth < TOTAL - 1 && nextLevel !== undefined && (
        <div
          className="mt-4 rounded-lg border p-3 flex items-center gap-2"
          style={{
            borderColor: nextLevel.borderColor,
            background: nextLevel.bgColor,
          }}
        >
          <span className="text-xs font-mono text-slate-500">zooming into</span>
          <span className="text-xs font-mono font-bold" style={{ color: nextLevel.color }}>
            {nextLevel.label}
          </span>
          <motion.span
            className="ml-auto text-slate-600 text-xs"
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            {"->"}
          </motion.span>
        </div>
      )}

      {depth === TOTAL - 1 && firstLevel !== undefined && (
        <div
          className="mt-4 rounded-lg border p-3 flex items-center gap-2"
          style={{
            borderColor: firstLevel.borderColor,
            background: firstLevel.bgColor,
          }}
        >
          <span className="text-xs font-mono text-slate-500">loops back to</span>
          <span className="text-xs font-mono font-bold" style={{ color: firstLevel.color }}>
            {firstLevel.label}
          </span>
          <motion.span
            className="ml-auto text-slate-600 text-xs"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            o
          </motion.span>
        </div>
      )}
    </motion.div>
  );
}

export function RecursiveZoomDemo() {
  const { ref, progress } = useInViewProgress();
  const [currentDepth, setCurrentDepth] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAuto = useCallback(() => {
    if (autoIntervalRef.current !== null) {
      clearInterval(autoIntervalRef.current);
      autoIntervalRef.current = null;
    }
    setAutoPlaying(false);
  }, []);

  const startAuto = useCallback(() => {
    stopAuto();
    setAutoPlaying(true);
    autoIntervalRef.current = setInterval(() => {
      setCurrentDepth((d) => (d + 1) % TOTAL);
    }, 1800);
  }, [stopAuto]);

  useEffect(() => {
    return () => {
      stopAuto();
    };
  }, [stopAuto]);

  useEffect(() => {
    if (progress > 0.4 && !autoPlaying) {
      startAuto();
    }
  }, [progress, autoPlaying, startAuto]);

  const goToDepth = useCallback(
    (d: number) => {
      stopAuto();
      setCurrentDepth(d);
    },
    [stopAuto],
  );

  const visibleLevels = ZOOM_LEVELS.slice(0, currentDepth + 1);

  return (
    <div ref={ref} className="my-8 flex flex-col gap-6 group">
      <div className="rounded-xl overflow-hidden border border-slate-800 shadow-2xl shadow-cyan-900/10 aspect-[16/10] sm:aspect-video bg-slate-950 relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl pointer-events-none z-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 blur-3xl pointer-events-none z-10" />

        <div className="relative w-full h-full p-4 sm:p-8 flex flex-col">
          <div className="flex items-center gap-1 mb-4 flex-wrap z-20 relative">
            {ZOOM_LEVELS.map((lvl, idx) => (
              <span key={lvl.id} className="flex items-center gap-1">
                <button
                  onClick={() => goToDepth(idx)}
                  className="text-xs font-mono px-2 py-0.5 rounded transition-all"
                  style={{
                    color: idx <= currentDepth ? lvl.color : "#4b5563",
                    background: idx === currentDepth ? lvl.bgColor : "transparent",
                    border: `1px solid ${idx <= currentDepth ? lvl.borderColor : "transparent"}`,
                  }}
                >
                  {lvl.label}
                </button>
                {idx < ZOOM_LEVELS.length - 1 && <span className="text-slate-700 text-xs">/</span>}
              </span>
            ))}
          </div>

          <div className="relative flex-1">
            <AnimatePresence>
              {visibleLevels.map((lvl, idx) => (
                <LevelCard
                  key={lvl.id}
                  level={lvl}
                  depth={idx}
                  currentDepth={currentDepth}
                  autoPlaying={autoPlaying}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 p-6 sm:p-8 rounded-xl bg-slate-950/80 backdrop-blur-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <svg width="40" height="40" viewBox="0 0 100 100" className="stroke-cyan-500">
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="2" strokeDasharray="4 8" />
            <circle cx="50" cy="50" r="20" fill="none" strokeWidth="2" />
          </svg>
        </div>

        <div className="flex-1 space-y-4 z-10 w-full">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-bold text-cyan-500 uppercase tracking-[0.15em] font-mono flex items-center gap-3">
              <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              Recursive Planning Loop
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full flex-wrap">
            {ZOOM_LEVELS.map((lvl, idx) => (
              <button
                key={lvl.id}
                onClick={() => goToDepth(idx)}
                className="flex-1 min-w-[100px] py-2 px-3 text-xs font-mono rounded-md border transition-all"
                style={
                  currentDepth === idx && !autoPlaying
                    ? {
                        background: lvl.bgColor,
                        color: lvl.color,
                        borderColor: lvl.borderColor,
                        boxShadow: `0 0 12px ${lvl.color}33`,
                      }
                    : {
                        background: "transparent",
                        color: "#6b7280",
                        borderColor: "#1e293b",
                      }
                }
              >
                {lvl.label}
              </button>
            ))}
          </div>

          <p className="text-sm text-slate-400 font-mono leading-relaxed border-l-2 border-slate-800 pl-4 mt-4">
            Claude Code plan mode feeds directly into agent design. Each agent issues tool calls
            whose results loop back into a new planning phase. The recursion terminates when
            acceptance criteria are met.
          </p>
        </div>

        <div className="flex items-center justify-center sm:pl-6 sm:border-l border-slate-800 z-10 w-full sm:w-auto mt-4 sm:mt-0 gap-3 sm:flex-col">
          <button
            onClick={autoPlaying ? stopAuto : startAuto}
            className="flex items-center justify-center gap-2 px-4 w-full sm:w-28 py-3 bg-cyan-900/20 hover:bg-cyan-900/40 border border-cyan-900 hover:border-cyan-700 rounded-lg font-mono text-xs uppercase tracking-widest transition-all text-cyan-400"
          >
            {autoPlaying ? "Pause" : "Auto"}
          </button>
          <button
            onClick={() => goToDepth(0)}
            className="flex items-center justify-center gap-2 px-4 w-full sm:w-28 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-lg font-mono text-xs uppercase tracking-widest transition-all text-slate-400"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
