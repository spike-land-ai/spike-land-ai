"use client";

import { useEffect, useState } from "react";
import { useInViewProgress } from "./useInViewProgress";
import { AnimatePresence, motion } from "framer-motion";

export interface ScrollStoryCardProps {
  title: string;
  illustration: "restaurant" | "usb" | "embassy" | "brain";
  mappings?: Array<{ left: string; right: string }>;
}

interface TerminalData {
  command: string;
  args: Record<string, string>;
  toolName: string;
  serverName: string;
  responseFields: Array<{ label: string; value: string; icon: string }>;
  statusEmoji: string;
  statusText: string;
}

const ILLUSTRATION_DATA = {
  restaurant: {
    scene: "👨‍🍳",
    subScene: "🍴📋",
    description: "A chef standardizes how orders flow from table to kitchen.",
    color: "cyan",
    terminal: {
      command: "spike tools call",
      args: {
        server: "kitchen-mcp",
        tool: "place_order",
        table: "7",
        items: "pasta,tomato-soup",
      },
      toolName: "place_order",
      serverName: "kitchen-mcp",
      responseFields: [
        { label: "Order ID", value: "#4521", icon: "🧾" },
        { label: "Status", value: "Accepted", icon: "✅" },
        { label: "ETA", value: "12 min", icon: "⏱️" },
        { label: "Chef", value: "Station 3", icon: "👨‍🍳" },
      ],
      statusEmoji: "🍝",
      statusText: "Order placed successfully",
    } satisfies TerminalData,
    defaultMappings: [
      { left: "Customer", right: "MCP Client (AI)" },
      { left: "Order slip", right: "JSON-RPC message" },
      { left: "Menu", right: "tools/list response" },
      { left: "Placing order", right: "tools/call request" },
      { left: "Dish arrives", right: "Structured response" },
    ],
  },
  usb: {
    scene: "💻",
    subScene: "🔌🖱️",
    description: "One universal port connecting every possible peripheral.",
    color: "blue",
    terminal: {
      command: "spike tools list",
      args: { server: "peripheral-hub", transport: "stdio" },
      toolName: "tools/list",
      serverName: "peripheral-hub",
      responseFields: [
        { label: "print", value: "Send to printer", icon: "🖨️" },
        { label: "scan", value: "Scan document", icon: "📄" },
        { label: "charge", value: "Power delivery", icon: "🔋" },
        { label: "display", value: "External monitor", icon: "🖥️" },
      ],
      statusEmoji: "🔌",
      statusText: "4 tools discovered",
    } satisfies TerminalData,
    defaultMappings: [
      { left: "Laptop", right: "MCP Client" },
      { left: "USB-C spec", right: "MCP Protocol" },
      { left: "Peripheral", right: "MCP Server" },
      { left: "Capability", right: "Tool" },
      { left: "Enumeration", right: "Discovery" },
    ],
  },
  embassy: {
    scene: "🏛️",
    subScene: "📜🛂",
    description: "Diplomatic protocols enabling secure cross-border communication.",
    color: "violet",
    terminal: {
      command: "spike tools call",
      args: {
        server: "embassy-api",
        tool: "visa_check",
        passport: "GB-29481",
        type: "work",
      },
      toolName: "visa_check",
      serverName: "embassy-api",
      responseFields: [
        { label: "Eligible", value: "Yes", icon: "✅" },
        { label: "Visa Type", value: "Tier 2 Work", icon: "📋" },
        { label: "Processing", value: "5-7 days", icon: "📅" },
        { label: "Auth Level", value: "Verified", icon: "🔐" },
      ],
      statusEmoji: "🛂",
      statusText: "Visa check completed",
    } satisfies TerminalData,
    defaultMappings: [
      { left: "Citizen", right: "MCP Client" },
      { left: "Diplomatic protocol", right: "JSON-RPC format" },
      { left: "Embassy", right: "MCP Server" },
      { left: "Consular service", right: "Tool" },
      { left: "Passport", right: "Auth token" },
    ],
  },
  brain: {
    scene: "🧠",
    subScene: "⚡️🔗",
    description: "A single entity connected to a vast network of context.",
    color: "violet",
    terminal: {
      command: "spike tools call",
      args: {
        server: "cognitive-mcp",
        tool: "process_context",
        input: "memory_fragment",
        type: "associative",
      },
      toolName: "process_context",
      serverName: "cognitive-mcp",
      responseFields: [
        { label: "Matches", value: "142", icon: "🔗" },
        { label: "Confidence", value: "87%", icon: "📊" },
        { label: "Context", value: "Broad", icon: "🌌" },
        { label: "State", value: "Non-linear", icon: "🌪️" },
      ],
      statusEmoji: "⚡️",
      statusText: "Context processed",
    } satisfies TerminalData,
    defaultMappings: [
      { left: "Grandmother Neuron", right: "The API Endpoint" },
      {
        left: "Single specific concept",
        right: "Single responsibility principle",
      },
      {
        left: "Fails because world is complex",
        right: "Fails because context is chaotic",
      },
      { left: "Network activation", right: "Narrative context integration" },
    ],
  },
} as const;

/* ── Typing animation hook ─────────────────────────── */
function useTypingAnimation(text: string, active: boolean, speed = 40) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setDisplayed("");
      setDone(false);
      return;
    }
    let i = 0;
    setDisplayed("");
    setDone(false);
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, active, speed]);

  return { displayed, done };
}

/* ── Terminal + Tool Call Widget ──────────────────── */
function TerminalToolCall({
  terminal,
  active,
  color,
}: {
  terminal: TerminalData;
  active: boolean;
  color: string;
}) {
  const args = terminal.args;
  const serverArg = args.server ?? "";
  const extraArgs = Object.entries(args)
    .filter(([k]) => k !== "server" && k !== "tool" && k !== "transport")
    .map(([k, v]) => `--${k} ${v}`)
    .join(" ");
  const fullCommand = `${terminal.command} --server ${serverArg} ${extraArgs}`;

  const { displayed, done: typingDone } = useTypingAnimation(fullCommand, active, 30);
  const [enterPressed, setEnterPressed] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  useEffect(() => {
    if (!typingDone) {
      setEnterPressed(false);
      setShowResponse(false);
      return;
    }
    const enterTimer = setTimeout(() => setEnterPressed(true), 300);
    const responseTimer = setTimeout(() => setShowResponse(true), 800);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(responseTimer);
    };
  }, [typingDone]);

  const accentMap: Record<string, string> = {
    cyan: "text-cyan-400 border-cyan-500/30 bg-cyan-500/5",
    blue: "text-blue-400 border-blue-500/30 bg-blue-500/5",
    violet: "text-violet-400 border-violet-500/30 bg-violet-500/5",
  };
  const accent = accentMap[color] ?? accentMap.cyan;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-slate-700/40 bg-slate-950/90 shadow-2xl backdrop-blur-md">
      {/* Terminal chrome */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/90 border-b border-slate-700/40">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
        </div>
        <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-widest">
          spike-cli
        </span>
      </div>

      {/* Terminal body */}
      <div className="p-5 font-mono text-sm space-y-3">
        {/* Command line */}
        <div className="flex items-start gap-2">
          <span className="text-green-400 select-none shrink-0">❯</span>
          <div className="flex-1 min-w-0">
            <span className="text-slate-200 break-all">{displayed}</span>
            {!typingDone && (
              <motion.span
                initial={{ opacity: 1 }}
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.6 }}
                className="inline-block w-2 h-4 bg-slate-300 ml-0.5 align-text-bottom"
              />
            )}
          </div>
        </div>

        {/* Enter key indicator */}
        <AnimatePresence>
          {typingDone && !enterPressed && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 pl-6"
            >
              <motion.kbd
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="px-2 py-0.5 text-[10px] rounded bg-slate-700 text-slate-400 border border-slate-600 font-sans"
              >
                ↵ Enter
              </motion.kbd>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Executing indicator */}
        <AnimatePresence>
          {enterPressed && !showResponse && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 pl-6 text-slate-500 text-xs"
            >
              <motion.span
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                className="inline-block"
              >
                ⟳
              </motion.span>
              <span>
                Calling <span className="text-slate-300">{terminal.toolName}</span> on{" "}
                <span className="text-slate-300">{terminal.serverName}</span>…
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tool call response widget */}
      <AnimatePresence>
        {showResponse && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-700/40 bg-slate-900/60 px-5 py-4">
              {/* Response header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{terminal.statusEmoji}</span>
                  <span className="text-xs font-mono text-green-400 font-bold">
                    {terminal.statusText}
                  </span>
                </div>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${accent}`}>
                  {terminal.toolName}
                </span>
              </div>

              {/* Response fields grid */}
              <div className="grid grid-cols-2 gap-2">
                {terminal.responseFields.map((field, i) => (
                  <motion.div
                    key={field.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/30"
                  >
                    <span className="text-base shrink-0">{field.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider leading-none mb-0.5">
                        {field.label}
                      </p>
                      <p className="text-sm text-slate-200 font-semibold truncate">{field.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main Component ──────────────────────────────── */
export function ScrollStoryCard({ title, illustration, mappings }: ScrollStoryCardProps) {
  const { ref, progress } = useInViewProgress();

  const data = ILLUSTRATION_DATA[illustration];
  const resolvedMappings = Array.isArray(mappings) ? mappings : data.defaultMappings;

  const isTerminalMode = progress > 0.55;

  return (
    <div ref={ref} className="min-h-[70vh] flex items-center py-16 px-4">
      <div className="w-full max-w-2xl mx-auto bg-slate-900/60 border border-slate-800 rounded-[2.5rem] p-8 md:p-12 backdrop-blur-xl relative overflow-hidden ring-1 ring-white/5">
        {/* Decorative Glow */}
        <div
          className={`absolute -top-24 -right-24 w-64 h-64 bg-${data.color}-500/10 blur-[100px] rounded-full`}
        />
        <div
          className={`absolute -bottom-24 -left-24 w-64 h-64 bg-${data.color}-500/5 blur-[80px] rounded-full`}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em]">
              The Analogy
            </span>
            <h3 className="text-2xl font-bold text-slate-100 tracking-tight">{title}</h3>
          </div>
          <motion.div
            animate={{ rotate: isTerminalMode ? 180 : 0 }}
            className={`w-10 h-10 rounded-full bg-${data.color}-500/10 flex items-center justify-center border border-${data.color}-500/20`}
          >
            <span className="text-xl">{isTerminalMode ? "⚙️" : data.scene}</span>
          </motion.div>
        </div>

        {/* Main Area */}
        <div className="relative mb-12 min-h-[180px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            {!isTerminalMode ? (
              <motion.div
                key="analogy"
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="relative">
                  <span className="text-7xl md:text-8xl leading-none drop-shadow-2xl grayscale-[0.2]">
                    {data.scene}
                  </span>
                  <motion.span
                    initial={{ y: 0 }}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="absolute -top-2 -right-4 text-3xl"
                  >
                    {data.subScene.substring(0, 2)}
                  </motion.span>
                </div>
                <p className="text-slate-300 text-lg font-medium text-center max-w-sm leading-relaxed">
                  {data.description}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="terminal"
                initial={{ opacity: 0, scale: 1.05, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="w-full"
              >
                <TerminalToolCall
                  terminal={data.terminal}
                  active={isTerminalMode}
                  color={data.color}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mapping Section */}
        <div className="pt-8 relative border-t border-slate-800/80">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em]">
              Translation Map
            </span>
            <div
              className={`h-px flex-grow bg-gradient-to-r from-slate-800 via-${data.color}-500/20 to-transparent`}
            />
          </div>

          <div className="space-y-2">
            {resolvedMappings.map((row, i) => {
              const active = progress > (i / resolvedMappings.length) * 0.8 + 0.1;
              return (
                <motion.div
                  key={i}
                  animate={{
                    opacity: active ? 1 : 0.2,
                    x: active ? 0 : -8,
                    backgroundColor: active ? "rgba(30, 41, 59, 0.4)" : "rgba(30, 41, 59, 0)",
                  }}
                  className={`grid grid-cols-2 items-center gap-4 px-4 py-3 rounded-xl border border-transparent transition-colors duration-500 ${
                    active ? "border-slate-700/50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        active ? `bg-${data.color}-400` : "bg-slate-700"
                      } transition-colors shadow-[0_0_8px_rgba(34,211,238,0.4)]`}
                    />
                    <span className="text-sm text-slate-200 font-medium tracking-tight truncate">
                      {row.left}
                    </span>
                  </div>
                  <div className="flex items-center justify-end md:justify-start">
                    <motion.span
                      initial={{ scale: 1, color: "#e2e8f0" }}
                      animate={
                        active
                          ? {
                              scale: [1, 1.05, 1],
                              color:
                                data.color === "cyan"
                                  ? "#22d3ee"
                                  : data.color === "blue"
                                    ? "#60a5fa"
                                    : "#a78bfa",
                            }
                          : {}
                      }
                      className="text-sm font-mono font-bold tracking-tight opacity-90 truncate"
                    >
                      {row.right}
                    </motion.span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Footer progress bar */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-30">
          <motion.div
            animate={{ scaleX: progress }}
            className={`h-0.5 w-full bg-${data.color}-500/30 origin-left`}
          />
        </div>
      </div>
    </div>
  );
}
