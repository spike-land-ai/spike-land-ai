"use client";

import { useRef } from "react";
import { TOTAL_TOOL_COUNT } from "@/components/mcp/mcp-tool-registry";
import { useInViewProgress } from "./useInViewProgress";
import { AnimatePresence, motion } from "framer-motion";

interface ServerNode {
  label: string;
  sublabel: string;
  tools: number;
  color: string;
  glowColor: string;
}

const SERVERS: ServerNode[] = [
  {
    label: "spike-land",
    sublabel: "HTTP",
    tools: TOTAL_TOOL_COUNT,
    color: "bg-cyan-500",
    glowColor: "rgba(6,182,212,0.4)",
  },
  {
    label: "vitest",
    sublabel: "stdio",
    tools: 12,
    color: "bg-green-500",
    glowColor: "rgba(34,197,94,0.4)",
  },
  {
    label: "filesystem",
    sublabel: "stdio",
    tools: 8,
    color: "bg-yellow-500",
    glowColor: "rgba(234,179,8,0.4)",
  },
];

function AppBox({ active }: { active: boolean }) {
  return (
    <motion.div layout className="flex flex-col items-center gap-2">
      <motion.div
        animate={{
          scale: active ? 1.05 : 1,
          backgroundColor: active ? "rgba(6, 182, 212, 0.1)" : "rgba(30, 41, 59, 0.5)",
          borderColor: active ? "rgb(6, 182, 212)" : "rgb(51, 65, 85)",
          boxShadow: active ? "0 0 24px rgba(6, 182, 212, 0.3)" : "none",
          opacity: active ? 1 : 0.4,
        }}
        transition={{ duration: 0.5, ease: "circOut" }}
        className="w-28 h-20 md:w-32 md:h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 bg-slate-800/50"
      >
        <span className="text-3xl md:text-4xl leading-none">💻</span>
      </motion.div>
      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
        React SPA
      </span>
      <p className="text-xs font-semibold text-slate-300">Your App</p>
    </motion.div>
  );
}

function HubBox({ active }: { active: boolean }) {
  return (
    <motion.div layout className="flex flex-col items-center gap-2">
      <motion.div
        animate={{
          scale: active ? 1.05 : 1,
          backgroundColor: active ? "rgba(139, 92, 246, 0.1)" : "rgba(30, 41, 59, 0.5)",
          borderColor: active ? "rgb(167, 139, 250)" : "rgb(51, 65, 85)",
          boxShadow: active ? "0 0 30px rgba(139, 92, 246, 0.35)" : "none",
          opacity: active ? 1 : 0.4,
        }}
        transition={{ duration: 0.5, ease: "circOut" }}
        className="w-32 h-20 md:w-40 md:h-28 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 bg-slate-800/50"
      >
        <span className="text-3xl md:text-4xl leading-none">🔀</span>
      </motion.div>
      <span className="text-[10px] font-mono text-violet-300 font-bold uppercase tracking-widest">
        spike-cli
      </span>
      <p className="text-xs font-mono text-slate-400 opacity-60">Multiplexer</p>
    </motion.div>
  );
}

function ServerBox({ server, active }: { server: ServerNode; active: boolean }) {
  return (
    <motion.div layout className="flex flex-col items-center gap-1.5">
      <motion.div
        animate={{
          scale: active ? 1.05 : 0.95,
          opacity: active ? 1 : 0.2,
          borderColor: active ? "rgb(100, 116, 139)" : "rgb(51, 65, 85)",
          boxShadow: active ? `0 0 20px ${server.glowColor}` : "none",
        }}
        transition={{ duration: 0.5, ease: "circOut" }}
        className="w-28 h-16 md:w-32 md:h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 bg-slate-800/80"
      >
        <span className="text-xs font-mono text-slate-200 font-bold tracking-tight">
          {server.label}
        </span>
        <span className="text-[9px] font-mono text-slate-500 uppercase">{server.sublabel}</span>
      </motion.div>
      <AnimatePresence>
        {active && (
          <motion.span
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${server.color}/20 text-slate-200 border border-slate-600/50`}
          >
            {server.tools} tools
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MobileConnectors({ progress }: { progress: number }) {
  const leftLine = Math.min(Math.max((progress - 0) / 0.25, 0), 1);
  const fanLine = Math.min(Math.max((progress - 0.4) / 0.25, 0), 1);

  const HEIGHT = 24;

  return (
    <div className="flex md:hidden flex-col items-center w-full">
      <div style={{ height: HEIGHT }} className="relative w-full flex justify-center">
        <svg width={2} height={HEIGHT} className="overflow-visible">
          <line x1={0} y1={0} x2={0} y2={HEIGHT} stroke="rgb(51 65 85)" strokeWidth={1} />
          <motion.line
            x1={0}
            y1={0}
            x2={0}
            y2={HEIGHT}
            stroke="rgb(6 182 212)"
            strokeWidth={2}
            strokeDasharray={HEIGHT}
            strokeDashoffset={HEIGHT * (1 - leftLine)}
          />
        </svg>
      </div>
      <div className="h-[2px]" />
      <div style={{ height: HEIGHT }} className="relative w-full flex justify-center">
        <svg width={2} height={HEIGHT} className="overflow-visible">
          <line x1={0} y1={0} x2={0} y2={HEIGHT} stroke="rgb(51 65 85)" strokeWidth={1} />
          <motion.line
            x1={0}
            y1={0}
            x2={0}
            y2={HEIGHT}
            stroke="rgb(139 92 246)"
            strokeWidth={2}
            strokeDasharray={HEIGHT}
            strokeDashoffset={HEIGHT * (1 - fanLine)}
          />
        </svg>
      </div>
    </div>
  );
}

export function SpikeCliDemo() {
  const { ref, progress } = useInViewProgress();

  const appActive = progress > 0.05;
  const hubActive = progress > 0.25;
  const serverActive = SERVERS.map((_, i) => progress > 0.45 + i * 0.12);

  const desktopRef = useRef<HTMLDivElement>(null);

  // Use percentage layout with fixed inner spacing instead of raw fixed bounds

  return (
    <div ref={ref} className="my-16">
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2rem] p-8 md:p-12 backdrop-blur-md relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

        {/* Desktop: horizontal three-column layout */}
        <div
          ref={desktopRef}
          className="hidden md:flex relative h-[320px] w-full items-center justify-between px-4"
        >
          {/* Left: App */}
          <div className="w-[140px] shrink-0 flex flex-col items-center z-20">
            <AppBox active={appActive} />
          </div>

          {/* Connector 1 */}
          <div className="flex-1 h-[2px] relative z-10 mx-2">
            <div className="absolute inset-0 bg-slate-800" />
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-violet-500"
              initial={{ width: "0%" }}
              animate={{
                width: `${Math.min(Math.max((progress - 0.1) / 0.15, 0), 1) * 100}%`,
              }}
              transition={{ duration: 0, ease: "linear" }}
            />
          </div>

          {/* Center: Hub */}
          <div className="w-[180px] shrink-0 flex flex-col items-center z-20">
            <HubBox active={hubActive} />
          </div>

          {/* Connector 2 (branching) */}
          <div className="flex-1 h-[240px] relative z-10 mx-2">
            <svg
              className="absolute inset-0 w-full h-full overflow-visible"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <defs>
                <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgb(139, 92, 246)" />
                  <stop offset="100%" stopColor="rgb(6, 182, 212)" />
                </linearGradient>
                <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgb(139, 92, 246)" />
                  <stop offset="100%" stopColor="rgb(34, 197, 94)" />
                </linearGradient>
                <linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgb(139, 92, 246)" />
                  <stop offset="100%" stopColor="rgb(234, 179, 8)" />
                </linearGradient>
              </defs>

              {/* Background paths */}
              <path
                d="M 0 50 C 50 50, 50 16.67, 100 16.67"
                stroke="rgb(30, 41, 59)"
                strokeWidth="3"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M 0 50 C 50 50, 50 50, 100 50"
                stroke="rgb(30, 41, 59)"
                strokeWidth="3"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M 0 50 C 50 50, 50 83.33, 100 83.33"
                stroke="rgb(30, 41, 59)"
                strokeWidth="3"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />

              {/* Animated paths */}
              {[0, 1, 2].map((i) => {
                const delays = [0.3, 0.4, 0.5];
                const delay = delays[i] || 0;
                const p = Math.min(Math.max((progress - delay) / 0.2, 0), 1);
                const yPositions = [16.67, 50, 83.33];
                const yPos = yPositions[i] || 50;
                const colors = ["url(#g1)", "url(#g2)", "url(#g3)"];
                const color = colors[i] || "url(#g1)";

                return (
                  <motion.path
                    key={i}
                    d={`M 0 50 C 50 50, 50 ${yPos}, 100 ${yPos}`}
                    stroke={color}
                    strokeWidth="3"
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: p }}
                    transition={{ duration: 0, ease: "linear" }}
                  />
                );
              })}
            </svg>
          </div>

          {/* Right: Servers stacked */}
          <div className="w-[140px] h-[240px] shrink-0 flex flex-col justify-between items-center z-20 relative">
            {SERVERS.map((s, i) => (
              <div key={s.label} className="flex flex-col items-center">
                <ServerBox server={s} active={serverActive[i] ?? false} />
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: simplified vertical stack */}
        <div className="flex md:hidden flex-col items-center gap-0">
          <AppBox active={appActive} />
          <MobileConnectors progress={progress} />
          <HubBox active={hubActive} />

          <div className="h-4" />

          <div className="w-full flex flex-col gap-4">
            {SERVERS.map((s, i) => (
              <div key={s.label} className="flex flex-col items-center">
                <div style={{ height: 12 }} className="w-full flex justify-center">
                  <svg width={2} height={12} className="overflow-visible">
                    <line x1={0} y1={0} x2={0} y2={12} stroke="rgb(51 65 85)" strokeWidth={1} />
                    <motion.line
                      x1={0}
                      y1={0}
                      x2={0}
                      y2={12}
                      stroke={s.glowColor.replace("0.4", "1")}
                      strokeWidth={2}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: serverActive[i] ? 1 : 0 }}
                    />
                  </svg>
                </div>
                <ServerBox server={s} active={serverActive[i]!} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 mt-12">
          <p className="text-center text-[10px] font-mono text-slate-500 tracking-[0.3em] uppercase opacity-70">
            One frontend • One multiplexer • All your tools
          </p>
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        </div>
      </div>
    </div>
  );
}
