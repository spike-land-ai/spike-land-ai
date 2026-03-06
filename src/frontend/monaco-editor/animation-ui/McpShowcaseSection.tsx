"use client";

import { MCP_CATEGORIES } from "../core-logic/components/mcp/mcp-tool-registry";
import { Button } from "../lazy-imports/button";
import { Link } from "../lazy-imports/link";
import { ArrowRight, Check, Copy, Terminal } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

const toolCategories = MCP_CATEGORIES.filter((c) => c.toolCount > 0)
  .sort((a, b) => b.toolCount - a.toolCount)
  .slice(0, 8)
  .map((c) => ({ name: c.name, toolCount: c.toolCount }));

const MCP_JSON_CONTENT = `{
  "mcpServers": {
    "spike-land": { "url": "https://spike.land/api/mcp/sse" },
    "vitest": { "command": "npx", "args": ["@anthropic-ai/vitest-mcp"] }
  },
  "toolsets": {
    "chess": { "servers": ["spike-land"], "description": "Chess tools" },
    "testing": { "servers": ["vitest"] }
  },
  "lazyLoading": true
}`;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, filter: "blur(10px)", y: 16 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

function CopyButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(MCP_JSON_CONTENT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all duration-200 border border-transparent hover:border-zinc-700"
      aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export function McpShowcaseSection() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
          whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 mb-6"
        >
          <span className="p-2 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
            <Terminal className="w-5 h-5" />
          </span>
          <span className="text-sm font-semibold tracking-[0.2em] uppercase text-cyan-300">
            spike-cli · MCP Multiplexer
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
          whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-4xl md:text-6xl font-bold text-foreground mb-6 tracking-tight drop-shadow-xl"
        >
          Load only{" "}
          <span className="bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(56,189,248,0.4)]">
            what you need
          </span>
          <span className="animate-pulse text-cyan-400 ml-1 font-thin">|</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
          whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl text-muted-foreground mb-20 max-w-2xl font-light leading-relaxed"
        >
          spike-cli provides MCP tool definitions on-demand. One config connects all your
          servers — AI agents request only the tools they need, keeping context windows clean.
        </motion.p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl relative">
          {/* Subtle glow behind code block */}
          <div
            className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[140px] pointer-events-none mix-blend-multiply dark:mix-blend-screen animate-pulse"
            style={{ animationDuration: "6s" }}
          />

          {/* Code Snippet */}
          <motion.div
            initial={{ opacity: 0, filter: "blur(10px)", x: -30 }}
            whileInView={{ opacity: 1, filter: "blur(0px)", x: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.8,
              delay: 0.3,
              type: "spring",
              stiffness: 100,
            }}
            className="relative order-2 lg:order-1"
          >
            <div className="relative rounded-2xl bg-black border border-border overflow-hidden shadow-2xl backdrop-blur-3xl group min-w-0">
              {/* Animated subtle top highlight */}
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />

              <div className="relative flex items-center justify-between px-5 py-4 border-b border-border bg-black/50 z-10">
                <div className="flex gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-red-400/90 shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-400/90 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                </div>
                <span className="text-xs font-semibold text-zinc-400 font-mono tracking-widest uppercase">
                  .cursor/mcp.json
                </span>
                <CopyButton />
              </div>
              <pre className="relative p-8 text-sm md:text-[15px] font-mono leading-relaxed overflow-x-auto selection:bg-cyan-500/30 z-10">
                <code className="text-blue-100 drop-shadow-sm">
                  <span className="text-zinc-500">{"{"}</span>
                  <br />
                  {"  "}
                  <span className="text-pink-400 font-semibold">"mcpServers"</span>
                  <span className="text-zinc-500">: {"{"}</span>
                  <br />
                  {"    "}
                  <span className="text-cyan-300">"spike-land"</span>
                  <span className="text-zinc-500">: {"{"} </span>
                  <span className="text-pink-400">"url"</span>
                  <span className="text-zinc-500">: </span>
                  <span className="text-emerald-300">"https://spike.land/api/mcp/sse"</span>
                  <span className="text-zinc-500"> {"}"}</span>,<br />
                  {"    "}
                  <span className="text-cyan-300">"vitest"</span>
                  <span className="text-zinc-500">: {"{"} </span>
                  <span className="text-pink-400">"command"</span>
                  <span className="text-zinc-500">: </span>
                  <span className="text-emerald-300">"npx"</span>
                  <span className="text-zinc-500">, </span>
                  <span className="text-pink-400">"args"</span>
                  <span className="text-zinc-500">: [</span>
                  <span className="text-emerald-300">"@anthropic-ai/vitest-mcp"</span>
                  <span className="text-zinc-500">] {"}"}</span>
                  <br />
                  {"  "}
                  <span className="text-zinc-500">{"}"}</span>,<br />
                  {"  "}
                  <span className="text-pink-400 font-semibold">"toolsets"</span>
                  <span className="text-zinc-500">: {"{"}</span>
                  <br />
                  {"    "}
                  <span className="text-cyan-300">"chess"</span>
                  <span className="text-zinc-500">: {"{"} </span>
                  <span className="text-pink-400">"servers"</span>
                  <span className="text-zinc-500">: [</span>
                  <span className="text-emerald-300">"spike-land"</span>
                  <span className="text-zinc-500">], </span>
                  <span className="text-pink-400">"description"</span>
                  <span className="text-zinc-500">: </span>
                  <span className="text-emerald-300">"Chess tools"</span>
                  <span className="text-zinc-500"> {"}"}</span>,<br />
                  {"    "}
                  <span className="text-cyan-300">"testing"</span>
                  <span className="text-zinc-500">: {"{"} </span>
                  <span className="text-pink-400">"servers"</span>
                  <span className="text-zinc-500">: [</span>
                  <span className="text-emerald-300">"vitest"</span>
                  <span className="text-zinc-500">] {"}"}</span>
                  <br />
                  {"  "}
                  <span className="text-zinc-500">{"}"}</span>,<br />
                  {"  "}
                  <span className="text-pink-400 font-semibold">"lazyLoading"</span>
                  <span className="text-zinc-500">: </span>
                  <span className="text-purple-400">true</span>
                  <br />
                  <span className="text-zinc-500">{"}"}</span>
                </code>
              </pre>
            </div>
          </motion.div>

          {/* Tool Categories Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 gap-5 content-center order-1 lg:order-2"
          >
            {toolCategories.map((cat) => (
              <motion.div
                key={cat.name}
                variants={itemVariants}
                className="group relative flex items-center justify-between p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-zinc-900/80 hover:border-cyan-500/40 transition-all duration-500 cursor-default backdrop-blur-xl hover:-translate-y-1 overflow-hidden"
              >
                {/* Background glow on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <span className="relative z-10 text-sm font-semibold text-zinc-400 group-hover:text-white transition-colors tracking-widest uppercase">
                  {cat.name}
                </span>

                <div className="relative z-10 flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 group-hover:bg-cyan-400/20 group-hover:border-cyan-400/50 group-hover:shadow-[0_0_12px_rgba(34,211,238,0.5)] transition-all duration-300">
                  <span className="text-xs font-bold text-cyan-500/60 group-hover:text-cyan-300 transition-colors tabular-nums">
                    {cat.toolCount}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-24"
        >
          <Button
            asChild
            variant="ghost"
            className="text-muted-foreground hover:text-foreground gap-2 transition-all duration-300 group rounded-full px-8 py-6 bg-secondary/30 border border-border/50 hover:bg-secondary/50"
          >
            <Link href="/mcp">
              Explore All Tools
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
