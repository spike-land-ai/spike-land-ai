"use client";

import { useInViewProgress } from "./useInViewProgress";
import { motion } from "framer-motion";

const NODES = [
  { emoji: "🤖", label: "Client", sublabel: "AI Agent" },
  { emoji: "📡", label: "Protocol", sublabel: "JSON-RPC" },
  { emoji: "🖥️", label: "Server", sublabel: "Resources" },
  { emoji: "🔧", label: "Tool", sublabel: "Execution" },
  { emoji: "✅", label: "Response", sublabel: "Structured" },
] as const;

const NODE_COUNT = NODES.length;
const SEGMENT = 1 / NODE_COUNT;

function NodeBox({
  emoji,
  label,
  sublabel,
  active,
}: {
  emoji: string;
  label: string;
  sublabel: string;
  active: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        animate={{
          scale: active ? 1.05 : 1,
          backgroundColor: active ? "rgba(6, 182, 212, 0.1)" : "rgba(30, 41, 59, 0.5)",
          borderColor: active ? "rgb(6, 182, 212)" : "rgb(51, 65, 85)",
          boxShadow: active ? "0 0 20px rgba(6, 182, 212, 0.2)" : "none",
          opacity: active ? 1 : 0.4,
        }}
        className="w-20 h-20 md:w-24 md:h-24 rounded-[1.5rem] border-2 flex flex-col items-center justify-center gap-1 backdrop-blur-sm"
      >
        <span className="text-3xl md:text-4xl leading-none">{emoji}</span>
      </motion.div>
      <div className="text-center">
        <p
          className={`text-xs font-bold font-mono tracking-tight transition-colors duration-500 ${
            active ? "text-slate-100" : "text-slate-500"
          }`}
        >
          {label}
        </p>
        <p
          className={`text-[10px] font-mono uppercase tracking-widest transition-colors duration-500 ${
            active ? "text-cyan-500" : "text-slate-600"
          }`}
        >
          {sublabel}
        </p>
      </div>
    </div>
  );
}

function Connector({ vertical, progress }: { vertical?: boolean; progress: number }) {
  const size = vertical ? 32 : 64;
  return (
    <div
      className={`${
        vertical ? "flex md:hidden" : "hidden md:flex"
      } items-center justify-center flex-shrink-0 ${vertical ? "h-8" : "w-16 pt-[-2.5rem]"}`}
    >
      <svg width={vertical ? 12 : size} height={vertical ? size : 12} className="overflow-visible">
        <line
          x1={0}
          y1={vertical ? 0 : 6}
          x2={vertical ? 6 : size}
          y2={vertical ? size : 6}
          className="stroke-slate-800"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <motion.line
          x1={0}
          y1={vertical ? 0 : 6}
          x2={vertical ? 6 : size}
          y2={vertical ? size : 6}
          className="stroke-cyan-500"
          strokeWidth={3}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: progress }}
          transition={{ duration: 0.2, ease: "linear" }}
        />
        {progress > 0 && (
          <motion.circle
            r={3}
            fill="rgb(6, 182, 212)"
            initial={{
              cx: vertical ? 6 : 0,
              cy: vertical ? 0 : 6,
              opacity: 0,
            }}
            animate={{
              cx: vertical ? 6 : [0, size],
              cy: vertical ? [0, size] : 6,
              opacity: [0, 1, 0],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: "linear",
            }}
            className="shadow-[0_0_8px_rgb(6,182,212)]"
          />
        )}
      </svg>
    </div>
  );
}

export function MCPFlowDiagram() {
  const { ref, progress } = useInViewProgress();

  return (
    <div
      ref={ref}
      className="bg-slate-900/40 border border-slate-800/80 rounded-[2.5rem] p-10 md:p-16 my-20 backdrop-blur-md relative overflow-hidden group"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

      <div className="relative flex flex-col md:flex-row items-center justify-center gap-0">
        {NODES.map((node, i) => {
          const active = progress >= i * SEGMENT;
          const lineP = Math.min(Math.max((progress - i * SEGMENT) / SEGMENT, 0), 1);

          return (
            <div key={node.label} className="flex flex-col md:flex-row items-center">
              <NodeBox
                emoji={node.emoji}
                label={node.label}
                sublabel={node.sublabel}
                active={active}
              />
              {i < NODE_COUNT - 1 && (
                <>
                  <Connector progress={lineP} />
                  <Connector vertical progress={lineP} />
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3 mt-12">
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        <p className="text-center text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase max-w-md leading-relaxed">
          The MCP request lifecycle: standardizing every step of the agent-tool dialogue
        </p>
      </div>
    </div>
  );
}
