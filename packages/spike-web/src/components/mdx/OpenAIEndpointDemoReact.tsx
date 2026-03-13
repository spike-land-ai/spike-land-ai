import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
      "BYOK priority: OpenAI > Anthropic > Google. Platform fallback: xAI > Anthropic > Google > OpenAI",
  },
  {
    id: "upstream",
    agent: "upstream",
    label: "Upstream Call",
    color: "#3b82f6",
    icon: "\u2191",
    description: "Send enriched messages to the resolved LLM provider",
  },
  {
    id: "response",
    agent: "endpoint",
    label: "Return Response",
    color: "#22c55e",
    icon: "\u2713",
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
  { name: "xAI", model: "grok-3" },
  { name: "Anthropic", model: "claude-sonnet-4-6" },
  { name: "Google", model: "gemini-2.5-flash" },
  { name: "OpenAI", model: "gpt-4.1" },
];

function StageNode({
  stage,
  state,
  index,
}: {
  stage: PipelineStage;
  state: "idle" | "active" | "done";
  index: number;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="flex items-start gap-3 relative"
    >
      {index < STAGES.length - 1 && (
        <div
          className="absolute left-[17px] top-[38px] w-[2px]"
          style={{
            height: "calc(100% + 4px)",
            background:
              state === "done"
                ? `linear-gradient(to bottom, ${stage.color}80, ${STAGES[index + 1]!.color}40)`
                : "hsl(var(--border, 220 13% 91%))",
          }}
        />
      )}

      <motion.div
        animate={{
          scale: state === "active" ? 1.15 : 1,
          boxShadow:
            state === "active"
              ? `0 0 16px ${stage.color}60`
              : state === "done"
                ? `0 0 8px ${stage.color}30`
                : "none",
          borderColor: state === "idle" ? "hsl(var(--border, 220 13% 91%))" : stage.color,
          backgroundColor:
            state === "done"
              ? `${stage.color}20`
              : state === "active"
                ? `${stage.color}10`
                : "transparent",
        }}
        transition={{ duration: 0.3 }}
        className="w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold"
        style={{
          color: state === "idle" ? "hsl(var(--muted-foreground, 220 9% 46%))" : stage.color,
        }}
      >
        {state === "done" ? "\u2713" : stage.icon}
      </motion.div>

      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold"
            style={{
              color:
                state === "idle"
                  ? "hsl(var(--muted-foreground, 220 9% 46%))"
                  : "hsl(var(--foreground, 224 71% 4%))",
            }}
          >
            {stage.label}
          </span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-md border"
            style={{
              color: stage.color,
              borderColor:
                state === "idle" ? "hsl(var(--border, 220 13% 91%))" : `${stage.color}60`,
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
              className="text-xs mt-1 leading-relaxed"
              style={{ color: "hsl(var(--muted-foreground, 220 9% 46%))" }}
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
  const docs = MOCK_DOCS[intent] ?? MOCK_DOCS["general"]!;
  const tools = MOCK_TOOLS[intent] ?? MOCK_TOOLS["general"]!;
  const shortQ = query.length > 40 ? query.slice(0, 40) + "\u2026" : query;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeIndex}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.25 }}
        className="rounded-xl border bg-[hsl(var(--muted,220_14%_96%)/0.3)] p-4 font-mono text-xs overflow-hidden"
        style={{ borderColor: "hsl(var(--border, 220 13% 91%) / 0.6)" }}
      >
        {activeIndex === 0 && (
          <div>
            <div className="opacity-50 mb-2">// incoming request</div>
            <pre className="whitespace-pre-wrap break-all">
              {`POST /v1/chat/completions
Content-Type: application/json

{
  "model": "spike-agent-v1",
  "messages": [
    {
      "role": "user",
      "content": "${query.length > 50 ? query.slice(0, 50) + "\u2026" : query}"
    }
  ],
  "stream": false
}`}
            </pre>
          </div>
        )}

        {activeIndex === 1 && (
          <div>
            <div className="opacity-50 mb-2">// router-agent output</div>
            <pre className="whitespace-pre-wrap">
              {`query: "${shortQ}"
inferred_intent: "${intent}"

// regex-based classifier:
${intent === "implementation" ? "\u2713 /(build|create|implement|ship)/" : intent === "debugging" ? "\u2713 /(fix|debug|broken|error|failing)/" : intent === "deployment" ? "\u2713 /(deploy|worker|cloudflare|wrangler)/" : intent === "platform-capability" ? "\u2713 /(mcp|tool|agent|api|auth)/" : '\u2192 no match \u2192 "general"'}`}
            </pre>
          </div>
        )}

        {activeIndex === 2 && (
          <div>
            <div className="opacity-50 mb-2">// docs-agent: top 3 scored</div>
            {docs.map((doc, i) => (
              <div key={doc} className="flex items-center gap-2 py-1">
                <span style={{ color: "#06b6d4" }}>#{i + 1}</span>
                <span>{doc}</span>
                <span className="opacity-50 ml-auto">score: {12 - i * 3}</span>
              </div>
            ))}
            <div
              className="opacity-50 mt-2 border-t pt-2"
              style={{ borderColor: "hsl(var(--border, 220 13% 91%) / 0.4)" }}
            >
              DOCS_MANIFEST scanned &middot; MAX_SELECTED_DOCS = 3
            </div>
          </div>
        )}

        {activeIndex === 3 && (
          <div>
            <div className="opacity-50 mb-2">// capability-agent: matched tools</div>
            {tools.map((tool, i) => (
              <div key={tool} className="flex items-center gap-2 py-1">
                <span style={{ color: "#8b5cf6" }}>{"\u2699"}</span>
                <span>{tool}</span>
                <span className="opacity-50 ml-auto">relevance: {(0.9 - i * 0.15).toFixed(2)}</span>
              </div>
            ))}
            <div
              className="opacity-50 mt-2 border-t pt-2"
              style={{ borderColor: "hsl(var(--border, 220 13% 91%) / 0.4)" }}
            >
              MCP catalog searched &middot; MAX_SELECTED_TOOLS = 6
            </div>
          </div>
        )}

        {activeIndex === 4 && (
          <div>
            <div className="opacity-50 mb-2">// synthesis-agent: composed system prompt</div>
            <pre className="whitespace-pre-wrap break-all">
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
            <div className="opacity-50 mb-2">// provider resolution order</div>
            <div className="space-y-1">
              <div className="opacity-50 text-[10px] uppercase tracking-wider mb-2">
                BYOK: OpenAI &rarr; Anthropic &rarr; Google
              </div>
              <div className="opacity-50 text-[10px] uppercase tracking-wider mb-3">
                Platform: xAI &rarr; Anthropic &rarr; Google &rarr; OpenAI
              </div>
              {PROVIDERS.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2 py-0.5">
                  <span
                    style={{ color: i === 0 ? "#22c55e" : undefined, opacity: i === 0 ? 1 : 0.5 }}
                  >
                    {i === 0 ? "\u2192" : " "}
                  </span>
                  <span style={{ fontWeight: i === 0 ? 700 : 400, opacity: i === 0 ? 1 : 0.6 }}>
                    {p.name}
                  </span>
                  <span className="opacity-40 ml-auto">{p.model}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeIndex === 6 && (
          <div>
            <div className="opacity-50 mb-2">// upstream LLM call</div>
            <pre className="whitespace-pre-wrap">
              {`provider: xAI (grok-3)
messages: [
  { role: "system", content: "\u2026knowledge prompt\u2026" },
  { role: "user",   content: "${query.length > 35 ? query.slice(0, 35) + "\u2026" : query}" }
]
temperature: default
max_tokens: default`}
            </pre>
            <div className="mt-2 flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-3 h-3 border-2 rounded-full"
                style={{ borderColor: "#3b82f6", borderTopColor: "transparent" }}
              />
              <span style={{ color: "#60a5fa" }}>Waiting for response&hellip;</span>
            </div>
          </div>
        )}

        {activeIndex === 7 && (
          <div>
            <div className="opacity-50 mb-2">// OpenAI-compatible response</div>
            <pre className="whitespace-pre-wrap break-all">
              {`{
  "id": "chatcmpl_abc123\u2026",
  "object": "chat.completion",
  "model": "spike-agent-v1",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Based on the spike.land
        docs and available MCP tools\u2026"
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

export default function OpenAIEndpointDemoReact() {
  const [query, setQuery] = useState(EXAMPLE_QUERIES[0]!);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const intent = intentFromQuery(query);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const runPipeline = useCallback(() => {
    cleanup();
    setIsRunning(true);
    setActiveIndex(0);

    let step = 0;
    const advance = () => {
      step += 1;
      if (step < STAGES.length) {
        setActiveIndex(step);
        timerRef.current = setTimeout(advance, 1200 + Math.random() * 600);
      } else {
        timerRef.current = setTimeout(() => setIsRunning(false), 1500);
      }
    };

    timerRef.current = setTimeout(advance, 1200);
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setActiveIndex(-1);
    setIsRunning(false);
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
        <h3 className="text-lg font-semibold mb-1">Request Pipeline — Live Visualization</h3>
        <p className="text-sm opacity-60">
          Watch how a{" "}
          <code
            className="font-mono text-xs px-1 py-0.5 rounded"
            style={{ color: "#06b6d4", background: "hsl(var(--muted, 220 14% 96%))" }}
          >
            spike-agent-v1
          </code>{" "}
          request flows through 4 local agents before reaching any upstream model.
        </p>
      </div>

      {/* query input */}
      <div className="mb-6 space-y-3">
        <label className="text-xs font-mono opacity-50 uppercase tracking-wider">
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
            className="flex-1 px-3 py-2 text-sm font-mono border rounded-lg focus:outline-none disabled:opacity-50"
            style={{
              background: "hsl(var(--background, 0 0% 100%))",
              borderColor: "hsl(var(--border, 220 13% 91%))",
              color: "hsl(var(--foreground, 224 71% 4%))",
            }}
            placeholder="Type a question\u2026"
          />
          <button
            onClick={isRunning ? reset : runPipeline}
            disabled={!query.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-lg border transition-colors flex-shrink-0 disabled:opacity-40 cursor-pointer"
            style={{
              backgroundColor: isRunning ? "rgba(239,68,68,0.1)" : "rgba(6,182,212,0.1)",
              borderColor: isRunning ? "rgba(239,68,68,0.4)" : "rgba(6,182,212,0.4)",
              color: isRunning ? "#ef4444" : "#06b6d4",
            }}
          >
            {isRunning ? "Reset" : "Run Pipeline"}
          </button>
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
              className="text-[11px] px-2 py-1 rounded-md border opacity-60 hover:opacity-100 transition-opacity disabled:opacity-30 cursor-pointer truncate max-w-[200px]"
              style={{ borderColor: "hsl(var(--border, 220 13% 91%) / 0.6)" }}
            >
              {eq}
            </button>
          ))}
        </div>
      </div>

      {/* pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-0">
          {STAGES.map((stage, i) => (
            <StageNode key={stage.id} stage={stage} state={stageState(i)} index={i} />
          ))}
        </div>

        <div className="flex flex-col">
          {activeIndex >= 0 ? (
            <>
              <div className="text-xs font-mono opacity-50 mb-2 uppercase tracking-wider">
                Stage {activeIndex + 1} / {STAGES.length} — {STAGES[activeIndex]!.agent}
              </div>
              <DetailPanel activeIndex={activeIndex} query={query} intent={intent} />
            </>
          ) : (
            <div
              className="flex-1 flex items-center justify-center rounded-xl border border-dashed min-h-[200px]"
              style={{
                borderColor: "hsl(var(--border, 220 13% 91%) / 0.6)",
                background: "hsl(var(--muted, 220 14% 96%) / 0.2)",
              }}
            >
              <div className="text-center">
                <div className="text-3xl mb-2 opacity-40">{"\u25b6"}</div>
                <p className="text-sm opacity-50">
                  Click <strong>Run Pipeline</strong> to trace the request
                </p>
              </div>
            </div>
          )}

          {activeIndex >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 text-xs flex-wrap"
            >
              <span className="font-mono opacity-50">intent:</span>
              <span
                className="font-mono font-semibold px-2 py-0.5 rounded-md border"
                style={{ color: "#f59e0b", borderColor: "#f59e0b40", backgroundColor: "#f59e0b08" }}
              >
                {intent}
              </span>
              {activeIndex >= 5 && (
                <>
                  <span className="font-mono opacity-50 ml-2">provider:</span>
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

      {/* footer */}
      <div
        className="mt-6 pt-4 border-t"
        style={{ borderColor: "hsl(var(--border, 220 13% 91%) / 0.4)" }}
      >
        <p className="text-[11px] opacity-50 leading-relaxed">
          This visualization mirrors the actual code in{" "}
          <code
            className="font-mono text-[10px] px-1 py-0.5 rounded"
            style={{ background: "hsl(var(--muted, 220 14% 96%))" }}
          >
            src/edge-api/main/api/routes/openai-compatible.ts
          </code>
          . The caller sends a standard OpenAI request body — the endpoint enriches it with platform
          context before any upstream model sees it.
        </p>
      </div>
    </div>
  );
}
