import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  BookOpen,
  Cable,
  Copy,
  Globe,
  KeyRound,
  Layers3,
  Play,
  Server,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Button } from "../../shared/ui/button";
import { cn } from "../../../styling/cn";
import {
  buildPlaygroundPlan,
  parseOpenAiCompatibleStream,
  resolveDefaultBaseUrl,
  resolveDefaultPathFlavor,
  type PlaygroundAuthMode,
  type PlaygroundConfig,
  type PlaygroundPathFlavor,
  type PlaygroundProvider,
  type PlaygroundTargetPreset,
} from "../../../core-logic/openai-compatible-playground";

const STORAGE_KEY = "ai-gateway-openai-compatible-playground:v1";
const BLOG_SLUG = "openai-compatible-endpoint-local-playground";

const TARGET_OPTIONS: Array<{
  value: PlaygroundTargetPreset;
  label: string;
  description: string;
}> = [
  {
    value: "browser-proxy",
    label: "Browser Proxy",
    description: "Hit /api/v1 through the local web app so Vite proxies into spike-edge.",
  },
  {
    value: "local-worker",
    label: "Local Worker",
    description: "Call the worker directly on port 8787 for curl and integration checks.",
  },
  {
    value: "production",
    label: "Production",
    description: "Point the playground at api.spike.land without changing the request shape.",
  },
];

const AUTH_OPTIONS: Array<{
  value: PlaygroundAuthMode;
  label: string;
  description: string;
}> = [
  {
    value: "bearer",
    label: "Internal Bearer",
    description: "Use INTERNAL_SERVICE_SECRET plus X-User-Id for fast local developer testing.",
  },
  {
    value: "session",
    label: "Session Cookie",
    description: "Reuse your signed-in browser session and let the normal auth middleware run.",
  },
];

const PROVIDER_OPTIONS: Array<{
  value: PlaygroundProvider;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "xai", label: "xAI" },
];

const MODEL_SUGGESTIONS = [
  "spike-agent-v1",
  "openai/gpt-4.1",
  "anthropic/claude-sonnet-4-20250514",
  "google/gemini-2.5-flash",
  "grok-4-1",
];

const ROUTE_CARDS = [
  {
    method: "GET",
    path: "/v1/models",
    body: "Lists the public selectors exposed by the compatibility surface today.",
  },
  {
    method: "POST",
    path: "/v1/chat/completions",
    body: "Runs the local agent pipeline, then synthesizes through the resolved upstream provider.",
  },
  {
    method: "GET",
    path: "/api/v1/models",
    body: "Alias for local proxy flows where /api already points at spike-edge.",
  },
  {
    method: "POST",
    path: "/api/v1/chat/completions",
    body: "Same handler, same body, just easier to hit from the site itself in dev.",
  },
];

const AGENT_STAGES = [
  {
    name: "router-agent",
    body: "Infers whether the user is building, debugging, deploying, or asking about platform capability.",
  },
  {
    name: "docs-agent",
    body: "Selects the most relevant internal docs from the local docs manifest.",
  },
  {
    name: "capability-agent",
    body: "Pulls in relevant MCP tools so the synthesis prompt names the real platform surface.",
  },
  {
    name: "synthesis-agent",
    body: "Writes the final answer through the provider selected by BYOK or platform fallback.",
  },
];

const PROVIDER_NOTES = [
  "spike-agent-v1 means auto-select a provider after local docs and tool context have been assembled.",
  "Auto mode prefers BYOK in this order: OpenAI, Anthropic, Google.",
  "If no BYOK key exists, platform fallback order is xAI, Anthropic, Google, OpenAI.",
  "Explicit provider models such as openai/gpt-4.1 skip auto selection and pin the upstream target.",
];

interface RequestResult {
  kind: "models" | "chat";
  status: "idle" | "running" | "success" | "error";
  endpoint: string;
  statusCode?: number;
  contentType?: string;
  durationMs?: number;
  body: string;
}

function createDefaultConfig(): PlaygroundConfig {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const targetPreset: PlaygroundTargetPreset = "browser-proxy";

  return {
    targetPreset,
    pathFlavor: resolveDefaultPathFlavor(targetPreset),
    authMode: "bearer",
    baseUrl: resolveDefaultBaseUrl(targetPreset, origin),
    bearerToken: "",
    userId: "local-dev-user",
    model: "spike-agent-v1",
    provider: "auto",
    systemPrompt: "",
    prompt: "How does spike.land resolve spike-agent-v1 and which provider will answer me?",
    temperature: 0.2,
    maxTokens: 768,
    stream: false,
  };
}

function readStoredConfig(): PlaygroundConfig {
  const fallback = createDefaultConfig();

  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PlaygroundConfig>;
    return {
      ...fallback,
      ...parsed,
    };
  } catch {
    return fallback;
  }
}

function ControlButton({
  selected,
  onClick,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[22px] border px-4 py-4 text-left transition-all duration-200",
        selected
          ? "border-primary/40 bg-primary/10 shadow-[0_16px_40px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
          : "border-border bg-background/80 hover:border-primary/22 hover:bg-card",
      )}
    >
      <div className="text-sm font-semibold tracking-[-0.02em] text-foreground">{label}</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </button>
  );
}

function CodeBlock({
  title,
  body,
  copied,
  onCopy,
}: {
  title: string;
  body: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <section className="rubik-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Copyable local snippet
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onCopy}>
          <Copy className="size-4" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto bg-[color:color-mix(in_srgb,var(--card)_86%,black_14%)] px-5 py-5 text-xs leading-6 text-[color:var(--secondary)]">
        <code>{body}</code>
      </pre>
    </section>
  );
}

export function AiGatewayPage() {
  const [config, setConfig] = useState<PlaygroundConfig>(() => readStoredConfig());
  const [result, setResult] = useState<RequestResult>({
    kind: "chat",
    status: "idle",
    endpoint: "",
    body: "Run a request to inspect the live response payload here.",
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyResetRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current);
      }
    };
  }, []);

  const plan = useMemo(() => buildPlaygroundPlan(config), [config]);

  async function copyToClipboard(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);

      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current);
      }

      copyResetRef.current = window.setTimeout(() => {
        setCopiedKey(null);
      }, 1600);
    } catch {
      setCopiedKey(null);
    }
  }

  function updateConfig(patch: Partial<PlaygroundConfig>) {
    setConfig((current) => ({ ...current, ...patch }));
  }

  function handleTargetChange(nextPreset: PlaygroundTargetPreset) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
    updateConfig({
      targetPreset: nextPreset,
      baseUrl: resolveDefaultBaseUrl(nextPreset, origin),
      pathFlavor: resolveDefaultPathFlavor(nextPreset),
    });
  }

  async function runRequest(kind: "models" | "chat") {
    if (!plan.normalizedBaseUrl) {
      setResult({
        kind,
        status: "error",
        endpoint: "",
        body: "Enter a base URL before running a request.",
      });
      return;
    }

    if (config.authMode === "bearer" && !config.bearerToken.trim()) {
      setResult({
        kind,
        status: "error",
        endpoint: kind === "models" ? plan.modelsUrl : plan.chatUrl,
        body: "Internal bearer mode needs INTERNAL_SERVICE_SECRET in the token field.",
      });
      return;
    }

    if (kind === "chat" && !config.prompt.trim()) {
      setResult({
        kind,
        status: "error",
        endpoint: plan.chatUrl,
        body: "Enter a user message before running chat/completions.",
      });
      return;
    }

    const endpoint = kind === "models" ? plan.modelsUrl : plan.chatUrl;
    setResult({
      kind,
      status: "running",
      endpoint,
      body: `Calling ${endpoint} ...`,
    });

    const startedAt = performance.now();

    try {
      const response = await fetch(endpoint, {
        method: kind === "models" ? "GET" : "POST",
        headers: plan.liveHeaders,
        credentials: config.authMode === "session" ? "include" : "omit",
        ...(kind === "chat" ? { body: JSON.stringify(plan.chatBody) } : {}),
      });

      const raw = await response.text();
      const contentType = response.headers.get("content-type") ?? "text/plain";
      let body = raw;

      if (contentType.includes("application/json")) {
        try {
          body = JSON.stringify(JSON.parse(raw) as unknown, null, 2);
        } catch {
          body = raw;
        }
      } else if (contentType.includes("text/event-stream")) {
        const parsed = parseOpenAiCompatibleStream(raw);
        body =
          parsed.assistant.trim().length > 0
            ? JSON.stringify(
                {
                  assistant: parsed.assistant,
                  chunk_events: parsed.events,
                  raw_stream: raw,
                },
                null,
                2,
              )
            : raw;
      }

      setResult({
        kind,
        status: response.ok ? "success" : "error",
        endpoint,
        statusCode: response.status,
        contentType,
        durationMs: Math.round(performance.now() - startedAt),
        body,
      });
    } catch (error) {
      setResult({
        kind,
        status: "error",
        endpoint,
        durationMs: Math.round(performance.now() - startedAt),
        body:
          error instanceof Error
            ? error.message
            : "The request failed before the endpoint returned a response.",
      });
    }
  }

  return (
    <div className="rubik-container rubik-page rubik-stack pb-10">
      <section className="rubik-panel-strong overflow-hidden p-6 sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_20rem]">
          <div className="space-y-6">
            <div className="rubik-eyebrow">
              <Cable className="size-3.5" />
              <span>AI Gateway Playground</span>
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-none tracking-[-0.07em] text-foreground sm:text-6xl">
                OpenAI-compatible on the outside, spike.land-aware on the inside.
              </h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
                This surface explains the live compatibility endpoint in{" "}
                <code className="rounded bg-background/80 px-2 py-1 text-sm text-foreground">
                  src/edge-api/main/api/routes/openai-compatible.ts
                </code>
                , then lets you hit it against the browser proxy, the local worker, or production
                without changing the request shape.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="rubik-chip rubik-chip-accent">spike-agent-v1 selector</span>
              <span className="rubik-chip">BYOK-first auto routing</span>
              <span className="rubik-chip">/v1 and /api/v1 aliases</span>
              <span className="rubik-chip">Synthetic stream mode</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6">
                <Link to="/packages/$appId" params={{ appId: "ai-gateway" }}>
                  Package Overview
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-6">
                <Link to="/blog/$slug" params={{ slug: BLOG_SLUG }}>
                  <BookOpen className="size-4" />
                  Read the blog article
                </Link>
              </Button>
            </div>
          </div>

          <aside className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rubik-panel p-4">
              <div className="flex items-center gap-3">
                <div className="rubik-icon-badge">
                  <Globe className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Routes
                  </div>
                  <div className="text-2xl font-semibold tracking-[-0.05em] text-foreground">
                    4
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Two public shapes: <code>/v1/*</code> and <code>/api/v1/*</code>.
              </p>
            </div>
            <div className="rubik-panel p-4">
              <div className="flex items-center gap-3">
                <div className="rubik-icon-badge">
                  <KeyRound className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Auth
                  </div>
                  <div className="text-2xl font-semibold tracking-[-0.05em] text-foreground">
                    2
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Internal bearer secret for local testing, or normal app session auth.
              </p>
            </div>
            <div className="rubik-panel p-4">
              <div className="flex items-center gap-3">
                <div className="rubik-icon-badge">
                  <Workflow className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Local agents
                  </div>
                  <div className="text-2xl font-semibold tracking-[-0.05em] text-foreground">
                    4-stage
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Router, docs, capability, and synthesis stages shape the upstream prompt.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_22rem]">
        <div className="space-y-6">
          <section className="rubik-panel p-6 sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Live playground
                </p>
                <h2 className="text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  Build one request shape, then point it wherever you need.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  The base URL changes, not the contract. This is the entire point of the
                  compatibility layer.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-right">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Active endpoint
                </div>
                <div className="mt-1 font-mono text-xs text-foreground">{plan.chatUrl}</div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Target preset
                </label>
                <div className="grid gap-3 lg:grid-cols-3">
                  {TARGET_OPTIONS.map((option) => (
                    <ControlButton
                      key={option.value}
                      selected={config.targetPreset === option.value}
                      onClick={() => handleTargetChange(option.value)}
                      label={option.label}
                      description={option.description}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Base URL
                  </span>
                  <input
                    value={config.baseUrl}
                    onChange={(event) => updateConfig({ baseUrl: event.target.value })}
                    className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    placeholder="https://local.spike.land:8787"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Path flavor
                  </span>
                  <select
                    value={config.pathFlavor}
                    onChange={(event) =>
                      updateConfig({ pathFlavor: event.target.value as PlaygroundPathFlavor })
                    }
                    className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="compat">/v1</option>
                    <option value="api">/api/v1</option>
                  </select>
                </label>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Auth mode
                </label>
                <div className="grid gap-3 lg:grid-cols-2">
                  {AUTH_OPTIONS.map((option) => (
                    <ControlButton
                      key={option.value}
                      selected={config.authMode === option.value}
                      onClick={() => updateConfig({ authMode: option.value })}
                      label={option.label}
                      description={option.description}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Bearer token
                  </span>
                  <input
                    value={config.bearerToken}
                    onChange={(event) => updateConfig({ bearerToken: event.target.value })}
                    className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                    placeholder="INTERNAL_SERVICE_SECRET"
                    disabled={config.authMode !== "bearer"}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    X-User-Id
                  </span>
                  <input
                    value={config.userId}
                    onChange={(event) => updateConfig({ userId: event.target.value })}
                    className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                    placeholder="local-dev-user"
                    disabled={config.authMode !== "bearer"}
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Model
                  </span>
                  <input
                    list="openai-compatible-models"
                    value={config.model}
                    onChange={(event) => updateConfig({ model: event.target.value })}
                    className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    placeholder="spike-agent-v1"
                  />
                  <datalist id="openai-compatible-models">
                    {MODEL_SUGGESTIONS.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Provider hint
                  </span>
                  <select
                    value={config.provider}
                    onChange={(event) =>
                      updateConfig({ provider: event.target.value as PlaygroundProvider })
                    }
                    className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  >
                    {PROVIDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Temperature
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={config.temperature ?? ""}
                    onChange={(event) =>
                      updateConfig({
                        temperature:
                          event.target.value.trim() === "" ? null : Number(event.target.value),
                      })
                    }
                    className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Max tokens
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={config.maxTokens ?? ""}
                    onChange={(event) =>
                      updateConfig({
                        maxTokens:
                          event.target.value.trim() === "" ? null : Number(event.target.value),
                      })
                    }
                    className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-[22px] border border-border bg-background px-4 py-4">
                  <input
                    type="checkbox"
                    checked={config.stream}
                    onChange={(event) => updateConfig({ stream: event.target.checked })}
                    className="size-4 rounded border-border text-primary"
                  />
                  <div>
                    <div className="text-sm font-semibold tracking-[-0.02em] text-foreground">
                      Stream response
                    </div>
                    <div className="text-xs leading-5 text-muted-foreground">
                      Receive SSE chunks and summarize them in the response panel.
                    </div>
                  </div>
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  System message
                </span>
                <textarea
                  value={config.systemPrompt}
                  onChange={(event) => updateConfig({ systemPrompt: event.target.value })}
                  rows={3}
                  className="w-full rounded-[22px] border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  placeholder="Optional caller instructions to forward into the compatibility layer."
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  User message
                </span>
                <textarea
                  value={config.prompt}
                  onChange={(event) => updateConfig({ prompt: event.target.value })}
                  rows={5}
                  className="w-full rounded-[22px] border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <Button size="lg" onClick={() => void runRequest("models")} className="h-12 px-6">
                  <Layers3 className="size-4" />
                  Run /models
                </Button>
                <Button size="lg" onClick={() => void runRequest("chat")} className="h-12 px-6">
                  <Play className="size-4" />
                  Run chat/completions
                </Button>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <CodeBlock
              title="curl"
              body={plan.curlSnippet}
              copied={copiedKey === "curl"}
              onCopy={() => void copyToClipboard("curl", plan.curlSnippet)}
            />
            <CodeBlock
              title="fetch"
              body={plan.fetchSnippet}
              copied={copiedKey === "fetch"}
              onCopy={() => void copyToClipboard("fetch", plan.fetchSnippet)}
            />
          </div>

          <section className="rubik-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Live response
                </p>
                <h3 className="text-xl font-semibold tracking-[-0.04em] text-foreground">
                  {result.kind === "models" ? "Models catalog" : "Chat completion"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {result.statusCode !== undefined && (
                  <span className="rubik-chip">{result.statusCode}</span>
                )}
                {result.durationMs !== undefined && (
                  <span className="rubik-chip">{result.durationMs} ms</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copyToClipboard("response", result.body)}
                >
                  <Copy className="size-4" />
                  {copiedKey === "response" ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="border-b border-border/70 bg-background/70 px-5 py-4 text-xs leading-6 text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">Endpoint:</span>{" "}
                {result.endpoint || plan.chatUrl}
              </div>
              {result.contentType && (
                <div>
                  <span className="font-semibold text-foreground">Content-Type:</span>{" "}
                  {result.contentType}
                </div>
              )}
              <div>
                <span className="font-semibold text-foreground">Status:</span> {result.status}
              </div>
            </div>

            <pre
              className={cn(
                "max-h-[34rem] overflow-auto px-5 py-5 text-xs leading-6",
                result.status === "error"
                  ? "bg-destructive/8 text-destructive"
                  : "bg-[color:color-mix(in_srgb,var(--card)_86%,black_14%)] text-[color:var(--secondary)]",
              )}
            >
              <code>{result.body}</code>
            </pre>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rubik-panel p-5">
            <div className="flex items-center gap-3">
              <div className="rubik-icon-badge">
                <Bot className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  What makes it different
                </p>
                <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                  The endpoint is compatible, not generic.
                </h3>
              </div>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-muted-foreground">
              {PROVIDER_NOTES.map((note) => (
                <li
                  key={note}
                  className="rounded-2xl border border-border/70 bg-background/75 px-4 py-3"
                >
                  {note}
                </li>
              ))}
            </ul>
          </section>

          <section className="rubik-panel p-5">
            <div className="flex items-center gap-3">
              <div className="rubik-icon-badge">
                <Server className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Route surface
                </p>
                <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                  Exact paths currently wired in spike-edge
                </h3>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {ROUTE_CARDS.map((route) => (
                <div
                  key={route.path}
                  className="rounded-2xl border border-border/70 bg-background/75 p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="rubik-chip rubik-chip-accent">{route.method}</span>
                    <code className="text-xs text-foreground">{route.path}</code>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{route.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rubik-panel p-5">
            <div className="flex items-center gap-3">
              <div className="rubik-icon-badge">
                <Workflow className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Local pipeline
                </p>
                <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                  Four stages before upstream synthesis
                </h3>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {AGENT_STAGES.map((stage, index) => (
                <div
                  key={stage.name}
                  className="rounded-2xl border border-border/70 bg-background/75 px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="rubik-chip">{index + 1}</span>
                    <code className="text-xs text-foreground">{stage.name}</code>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{stage.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rubik-panel p-5">
            <div className="flex items-center gap-3">
              <div className="rubik-icon-badge">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Local quickstart
                </p>
                <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                  Fastest loop for trying the endpoint yourself
                </h3>
              </div>
            </div>
            <pre className="mt-5 overflow-x-auto rounded-[22px] border border-border/70 bg-[color:color-mix(in_srgb,var(--card)_86%,black_14%)] p-4 text-xs leading-6 text-[color:var(--secondary)]">
              <code>{`bash scripts/dev-local.sh

# then open the playground
http://local.spike.land:5173/packages/ai-gateway/ui

# or call the worker directly
curl -sS https://local.spike.land:8787/v1/models \\
  -H 'Authorization: Bearer <INTERNAL_SERVICE_SECRET>' \\
  -H 'X-User-Id: local-dev-user'`}</code>
            </pre>
          </section>
        </aside>
      </div>
    </div>
  );
}
