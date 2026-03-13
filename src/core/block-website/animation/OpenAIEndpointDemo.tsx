"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── data ─── */

const EXAMPLE_QUERIES: string[] = [
  "How do I deploy a Cloudflare Worker with spike.land?",
  "What MCP tools are available for image generation?",
  "Fix my authentication flow — tokens expire too fast",
  "Build a chess bot using the spike.land platform",
];

interface PipelineStage {
  id: string;
  agent: string;
  label: string;
  color: string;
  icon: string;
  description: string;
}

const STAGES: PipelineStage[] = [
  {
    id: "parse",
    agent: "endpoint",
    label: "Parse Request",
    color: "#64748b",
    icon: "{ }",
    description: "Validate OpenAI-compatible JSON body — messages, model, stream flag",
  },
  {
    id: "router",
    agent: "router-agent",
    label: "Infer Intent",
    color: "#f59e0b",
    icon: "R",
    description:
      "Classify the user query: implementation, debugging, deployment, or platform-capability",
  },
  {
    id: "docs",
    agent: "docs-agent",
    label: "Score Local Docs",
    color: "#06b6d4",
    icon: "D",
    description: "Token-match the query against the docs manifest, select top 3 relevant entries",
  },
  {
    id: "capability",
    agent: "capability-agent",
    label: "Match MCP Tools",
    color: "#8b5cf6",
    icon: "C",
    description: "Search the MCP tool catalog for the 6 most relevant capabilities",
  },
  {
    id: "synthesis",
    agent: "synthesis-agent",
    label: "Build Prompt",
    color: "#10b981",
    icon: "S",
    description: "Compose the knowledge prompt — intent + docs + tools + caller instructions",
  },
  {
    id: "provider",
    agent: "provider",
    label: "Resolve Provider",
    color: "#ec4899",
    icon: "P",
    description:
      "BYOK priority: OpenAI → Anthropic → Google. Platform fallback: xAI → Anthropic → Google → OpenAI",
  },
  {
    id: "upstream",
    agent: "upstream",
    label: "Upstream Call",
    color: "#3b82f6",
    icon: "↑",
    description: "Send enriched messages to the resolved LLM provider",
  },
  {
    id: "response",
    agent: "endpoint",
    label: "Return Response",
    color: "#22c55e",
    icon: "✓",
    description:
      "Wrap the result in OpenAI chat.completion shape — same contract the caller expects",
  },
];

function intentFromQuery(q: string): string {
  const lower = q.toLowerCase();
  if (/(build|create|implement|ship|prototype)/.test(lower)) return "implementation";
  if (/(fix|debug|broken|error|failing)/.test(lower)) return "debugging";
  if (/(deploy|worker|cloudflare|wrangler|production)/.test(lower)) return "deployment";
  if (/(mcp|tool|agent|api|auth|oauth)/.test(lower)) return "platform-capability";
  return "general";
}

const MOCK_DOCS: Record<string, string[]> = {
  deployment: ["Cloudflare Workers Deploy Guide", "Wrangler CLI Reference", "Custom Domains Setup"],
  "platform-capability": ["MCP Tool Registry", "OAuth2 Authentication", "Agent SDK Overview"],
  implementation: ["Getting Started", "Architecture Overview", "Code Examples"],
  debugging: ["Debugging Workers", "Error Handling", "Logging & Monitoring"],
  general: ["Platform Overview", "FAQ", "API Reference"],
};

const MOCK_TOOLS: Record<string, string[]> = {
  deployment: ["deploy_worker", "check_deployment_status", "configure_routes"],
  "platform-capability": ["list_mcp_tools", "invoke_tool", "register_tool"],
  implementation: ["scaffold_project", "generate_code", "run_tests"],
  debugging: ["tail_logs", "inspect_worker", "replay_request"],
  general: ["search_docs", "ask_spike", "list_models"],
};

const PROVIDERS = [
  { name: "xAI", model: "grok-3", color: "#1a1a2e" },
  { name: "Anthropic", model: "claude-sonnet-4-6", color: "#d97706" },
  { name: "Google", model: "gemini-2.5-flash", color: "#4285f4" },
  { name: "OpenAI", model: "gpt-4.1", color: "#10a37f" },
];

/* ─── sub-components ─── */

function StageNode({
  stage,
  state,
  index,
  onClick,
}: {
  stage: PipelineStage;
  state: "idle" | "active" | "done";
  index: number;
  onClick?: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="flex items-start gap-3 relative cursor-pointer group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
    >
      {/* connector line */}
      {index < STAGES.length - 1 && (
        <div
          className="absolute left-[17px] top-[38px] w-[2px] h-[calc(100%+4px)]"
          style={{
            background:
              state === "done"
                ? `linear-gradient(to bottom, ${stage.color}80, ${STAGES[index + 1]?.color ?? stage.color}40)`
                : "hsl(var(--border))",
          }}
        />
      )}

      {/* icon circle */}
      <motion.div
        animate={{
          scale: state === "active" ? 1.15 : 1,
          boxShadow:
            state === "active"
              ? `0 0 16px ${stage.color}60`
              : state === "done"
                ? `0 0 8px ${stage.color}30`
                : "none",
          borderColor: state === "idle" ? "hsl(var(--border))" : stage.color,
          backgroundColor:
            state === "done"
              ? `${stage.color}20`
              : state === "active"
                ? `${stage.color}10`
                : "transparent",
        }}
        transition={{ duration: 0.3 }}
        className="w-[36px] h-[36px] rounded-full border-2 flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold group-hover:scale-110 transition-transform"
        style={{ color: state === "idle" ? "hsl(var(--muted-foreground))" : stage.color }}
      >
        {state === "done" ? "✓" : stage.icon}
      </motion.div>

      {/* text */}
      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold"
            style={{
              color: state === "idle" ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))",
            }}
          >
            {stage.label}
          </span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-md border"
            style={{
              color: stage.color,
              borderColor: state === "idle" ? "hsl(var(--border))" : `${stage.color}60`,
              backgroundColor: state === "idle" ? "transparent" : `${stage.color}08`,
            }}
          >
            {stage.agent}
          </span>
        </div>
        <AnimatePresence>
          {state === "active" && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-muted-foreground mt-1 leading-relaxed"
            >
              {stage.description}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function DetailPanel({
  activeIndex,
  query,
  intent,
}: {
  activeIndex: number;
  query: string;
  intent: string;
}) {
  const docs = MOCK_DOCS[intent] ?? (MOCK_DOCS["general"] as string[]);
  const tools = MOCK_TOOLS[intent] ?? (MOCK_TOOLS["general"] as string[]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeIndex}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.25 }}
        className="rounded-xl border border-border/60 bg-muted/30 p-4 font-mono text-xs overflow-hidden"
      >
        {activeIndex === 0 && (
          <div>
            <div className="text-muted-foreground mb-2">// incoming request</div>
            <pre className="text-foreground whitespace-pre-wrap break-all">
              {`POST /v1/chat/completions
Content-Type: application/json

{
  "model": "spike-agent-v1",
  "messages": [
    {
      "role": "user",
      "content": "${query.length > 50 ? query.slice(0, 50) + "…" : query}"
    }
  ],
  "stream": false
}`}
            </pre>
          </div>
        )}

        {activeIndex === 1 && (
          <div>
            <div className="text-muted-foreground mb-2">// router-agent output</div>
            <pre className="text-foreground whitespace-pre-wrap">
              {`query: "${query.length > 40 ? query.slice(0, 40) + "…" : query}"
inferred_intent: "${intent}"

// regex-based classifier:
${intent === "implementation" ? "✓ /(build|create|implement|ship)/" : intent === "debugging" ? "✓ /(fix|debug|broken|error|failing)/" : intent === "deployment" ? "✓ /(deploy|worker|cloudflare|wrangler)/" : intent === "platform-capability" ? "✓ /(mcp|tool|agent|api|auth)/" : '→ no match → "general"'}`}
            </pre>
          </div>
        )}

        {activeIndex === 2 && (
          <div>
            <div className="text-muted-foreground mb-2">// docs-agent: top 3 scored</div>
            {docs.map((doc, i) => (
              <div key={doc} className="flex items-center gap-2 py-1">
                <span style={{ color: "#06b6d4" }}>#{i + 1}</span>
                <span className="text-foreground">{doc}</span>
                <span className="text-muted-foreground ml-auto">score: {12 - i * 3}</span>
              </div>
            ))}
            <div className="text-muted-foreground mt-2 border-t border-border/40 pt-2">
              DOCS_MANIFEST scanned • MAX_SELECTED_DOCS = 3
            </div>
          </div>
        )}

        {activeIndex === 3 && (
          <div>
            <div className="text-muted-foreground mb-2">// capability-agent: matched tools</div>
            {tools.map((tool, i) => (
              <div key={tool} className="flex items-center gap-2 py-1">
                <span style={{ color: "#8b5cf6" }}>⚙</span>
                <span className="text-foreground">{tool}</span>
                <span className="text-muted-foreground ml-auto">
                  relevance: {(0.9 - i * 0.15).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="text-muted-foreground mt-2 border-t border-border/40 pt-2">
              MCP catalog searched • MAX_SELECTED_TOOLS = 6
            </div>
          </div>
        )}

        {activeIndex === 4 && (
          <div>
            <div className="text-muted-foreground mb-2">
              // synthesis-agent: composed system prompt
            </div>
            <pre className="text-foreground whitespace-pre-wrap break-all">
              {`You are Spike's ChatGPT-compatible API.

Local agents:
- router-agent: intent = ${intent}
- docs-agent: ${docs.length} docs selected
- capability-agent: ${tools.length} tools matched

Relevant docs:
${docs.map((d) => `  - ${d}`).join("\n")}

Relevant MCP tools:
${tools.map((t) => `  - ${t}`).join("\n")}`}
            </pre>
          </div>
        )}

        {activeIndex === 5 && (
          <div>
            <div className="text-muted-foreground mb-2">// provider resolution order</div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-2">
                BYOK: OpenAI → Anthropic → Google
              </div>
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-3">
                Platform: xAI → Anthropic → Google → OpenAI
              </div>
              {PROVIDERS.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2 py-0.5">
                  <span className={i === 0 ? "text-green-500" : "text-muted-foreground"}>
                    {i === 0 ? "→" : " "}
                  </span>
                  <span
                    className={i === 0 ? "text-foreground font-semibold" : "text-muted-foreground"}
                  >
                    {p.name}
                  </span>
                  <span className="text-muted-foreground/60 ml-auto">{p.model}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeIndex === 6 && (
          <div>
            <div className="text-muted-foreground mb-2">// upstream LLM call</div>
            <pre className="text-foreground whitespace-pre-wrap">
              {`provider: xAI (grok-3)
messages: [
  { role: "system", content: "…knowledge prompt…" },
  { role: "user",   content: "${query.length > 35 ? query.slice(0, 35) + "…" : query}" }
]
temperature: default
max_tokens: default`}
            </pre>
            <div className="mt-2 flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full"
              />
              <span className="text-blue-400">Waiting for response…</span>
            </div>
          </div>
        )}

        {activeIndex === 7 && (
          <div>
            <div className="text-muted-foreground mb-2">// OpenAI-compatible response</div>
            <pre className="text-foreground whitespace-pre-wrap break-all">
              {`{
  "id": "chatcmpl_abc123…",
  "object": "chat.completion",
  "model": "spike-agent-v1",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Based on the spike.land
        docs and available MCP tools…"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 847,
    "completion_tokens": 312,
    "total_tokens": 1159
  }
}`}
            </pre>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── main component ─── */

export function OpenAIEndpointDemo() {
  const [query, setQuery] = useState(EXAMPLE_QUERIES[0] ?? "");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef(0);

  const intent = intentFromQuery(query);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const scheduleNext = useCallback(() => {
    timerRef.current = setTimeout(
      () => {
        stepRef.current += 1;
        if (stepRef.current < STAGES.length) {
          setActiveIndex(stepRef.current);
          scheduleNext();
        } else {
          timerRef.current = setTimeout(() => {
            setIsRunning(false);
            setIsPaused(false);
          }, 1500);
        }
      },
      1200 + Math.random() * 600,
    );
  }, []);

  const runPipeline = useCallback(() => {
    cleanup();
    setIsRunning(true);
    setIsPaused(false);
    stepRef.current = 0;
    setActiveIndex(0);
    scheduleNext();
  }, [cleanup, scheduleNext]);

  const togglePause = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
      scheduleNext();
    } else {
      cleanup();
      setIsPaused(true);
    }
  }, [isPaused, cleanup, scheduleNext]);

  const jumpToStep = useCallback(
    (index: number) => {
      cleanup();
      stepRef.current = index;
      setActiveIndex(index);
      setIsRunning(true);
      setIsPaused(true);
    },
    [cleanup],
  );

  const reset = useCallback(() => {
    cleanup();
    setActiveIndex(-1);
    setIsRunning(false);
    setIsPaused(false);
    stepRef.current = 0;
  }, [cleanup]);

  const stageState = (index: number): "idle" | "active" | "done" => {
    if (activeIndex < 0) return "idle";
    if (index < activeIndex) return "done";
    if (index === activeIndex) return "active";
    return "idle";
  };

  return (
    <div className="p-6 md:p-8">
      {/* header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Request Pipeline — Live Visualization
        </h3>
        <p className="text-sm text-muted-foreground">
          Watch how a{" "}
          <code className="text-cyan-500 font-mono text-xs px-1 py-0.5 bg-muted rounded">
            spike-agent-v1
          </code>{" "}
          request flows through 4 local agents before reaching any upstream model.
        </p>
      </div>

      {/* query selector */}
      <div className="mb-6 space-y-3">
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          User message
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isRunning) setActiveIndex(-1);
            }}
            disabled={isRunning}
            className="flex-1 px-3 py-2 text-sm font-mono bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:opacity-50"
            placeholder="Type a question…"
          />
          <div className="flex gap-2 flex-shrink-0">
            {isRunning && (
              <button
                onClick={togglePause}
                className="px-3 py-2 text-sm font-semibold rounded-lg border transition-colors"
                style={{
                  backgroundColor: isPaused
                    ? "hsl(var(--primary) / 0.1)"
                    : "hsl(var(--muted) / 0.5)",
                  borderColor: isPaused ? "hsl(var(--primary) / 0.4)" : "hsl(var(--border))",
                  color: isPaused ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                }}
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
            )}
            <button
              onClick={isRunning ? reset : runPipeline}
              disabled={!query.trim()}
              className="px-4 py-2 text-sm font-semibold rounded-lg border transition-colors disabled:opacity-40"
              style={{
                backgroundColor: isRunning
                  ? "hsl(var(--destructive) / 0.1)"
                  : "hsl(var(--primary) / 0.1)",
                borderColor: isRunning
                  ? "hsl(var(--destructive) / 0.4)"
                  : "hsl(var(--primary) / 0.4)",
                color: isRunning ? "hsl(var(--destructive))" : "hsl(var(--primary))",
              }}
            >
              {isRunning ? "Reset" : "Run Pipeline"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_QUERIES.map((eq) => (
            <button
              key={eq}
              onClick={() => {
                setQuery(eq);
                if (!isRunning) setActiveIndex(-1);
              }}
              disabled={isRunning}
              className="text-[11px] px-2 py-1 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-40 truncate max-w-[200px]"
            >
              {eq}
            </button>
          ))}
        </div>
      </div>

      {/* pipeline visualization */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* left: stage list */}
        <div className="space-y-0">
          {STAGES.map((stage, i) => (
            <StageNode
              key={stage.id}
              stage={stage}
              state={stageState(i)}
              index={i}
              onClick={() => jumpToStep(i)}
            />
          ))}
        </div>

        {/* right: detail panel */}
        <div className="flex flex-col">
          {activeIndex >= 0 ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Stage {activeIndex + 1} / {STAGES.length} — {STAGES[activeIndex]?.agent}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => jumpToStep(Math.max(0, activeIndex - 1))}
                    disabled={activeIndex <= 0}
                    className="px-2 py-0.5 text-xs font-mono rounded border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30"
                  >
                    ← prev
                  </button>
                  <button
                    onClick={() => jumpToStep(Math.min(STAGES.length - 1, activeIndex + 1))}
                    disabled={activeIndex >= STAGES.length - 1}
                    className="px-2 py-0.5 text-xs font-mono rounded border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30"
                  >
                    next →
                  </button>
                </div>
              </div>
              <DetailPanel activeIndex={activeIndex} query={query} intent={intent} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 min-h-[200px]">
              <div className="text-center">
                <div className="text-3xl mb-2 opacity-40">▶</div>
                <p className="text-sm text-muted-foreground">
                  Click <strong>Run Pipeline</strong> to trace the request
                </p>
              </div>
            </div>
          )}

          {/* intent badge — always visible once running */}
          {activeIndex >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 text-xs"
            >
              <span className="font-mono text-muted-foreground">intent:</span>
              <span
                className="font-mono font-semibold px-2 py-0.5 rounded-md border"
                style={{ color: "#f59e0b", borderColor: "#f59e0b40", backgroundColor: "#f59e0b08" }}
              >
                {intent}
              </span>
              {activeIndex >= 5 && (
                <>
                  <span className="font-mono text-muted-foreground ml-2">provider:</span>
                  <span
                    className="font-mono font-semibold px-2 py-0.5 rounded-md border"
                    style={{
                      color: "#ec4899",
                      borderColor: "#ec489940",
                      backgroundColor: "#ec489908",
                    }}
                  >
                    xAI / grok-3
                  </span>
                </>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* footer note */}
      <div className="mt-6 pt-4 border-t border-border/40">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          This visualization mirrors the actual code in{" "}
          <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">
            src/edge-api/main/api/routes/openai-compatible.ts
          </code>
          . The caller sends a standard OpenAI request body — the endpoint enriches it with platform
          context before any upstream model sees it.
        </p>
      </div>
    </div>
  );
}
