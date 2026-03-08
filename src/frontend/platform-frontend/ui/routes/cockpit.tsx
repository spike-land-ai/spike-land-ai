import { useEffect, useRef, useState } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { ChatThread } from "../components/ChatThread";
import { apiUrl } from "../../core-logic/api";
import type { Message } from "../components/ChatThread";

const FOUNDER_EMAIL = "zoltan.erdos@spike.land";
const CHAT_STORAGE_KEY = "cockpit_chat_history";

// ── Types ──────────────────────────────────────────────────────────────────

type KanbanStatus = "planned" | "in-progress" | "done";

interface Milestone {
  id: string;
  title: string;
  description: string;
  status: KanbanStatus;
  priority: "high" | "medium" | "low";
}

// ── Static roadmap data ────────────────────────────────────────────────────

const MILESTONES: Milestone[] = [
  {
    id: "m1",
    title: "Stripe billing integration",
    description: "Pro $29/mo, Business $99/mo. Checkout, webhooks, invoice.paid.",
    status: "in-progress",
    priority: "high",
  },
  {
    id: "m2",
    title: "Onboarding flow",
    description: "Welcome modal (3 steps), interests selection, tool suggestions.",
    status: "in-progress",
    priority: "high",
  },
  {
    id: "m3",
    title: "MCP registry v2",
    description: "Tool versioning, categories, search, install counts, ratings.",
    status: "planned",
    priority: "high",
  },
  {
    id: "m4",
    title: "Marketplace revenue share",
    description: "price_cents on tools, tool_purchases table, paid install flow.",
    status: "planned",
    priority: "medium",
  },
  {
    id: "m5",
    title: "Credit system",
    description: "D1 migration, metering middleware, balance widget, buy credits.",
    status: "planned",
    priority: "medium",
  },
  {
    id: "m6",
    title: "Auth hardening",
    description: "CSP headers, rate limiting, BYOK encryption, security audit.",
    status: "planned",
    priority: "medium",
  },
  {
    id: "m7",
    title: "Landing page v2",
    description: "New hero, social proof, pricing comparison table, CTA A/B test.",
    status: "planned",
    priority: "low",
  },
  {
    id: "m8",
    title: "spike-app launch",
    description: "Vite SPA deployed to Cloudflare Pages.",
    status: "done",
    priority: "high",
  },
  {
    id: "m9",
    title: "WhatsApp integration",
    description: "Cloud API integration — link phone, OTP flow, messaging.",
    status: "done",
    priority: "medium",
  },
  {
    id: "m10",
    title: "AWS decommission",
    description: "All AWS infra torn down. Platform runs 100% on Cloudflare.",
    status: "done",
    priority: "high",
  },
];

const KANBAN_COLS: { id: KanbanStatus; label: string; dotClass: string }[] = [
  { id: "planned", label: "Planned", dotClass: "bg-muted-foreground" },
  { id: "in-progress", label: "In Progress", dotClass: "bg-amber-500" },
  { id: "done", label: "Done", dotClass: "bg-green-500" },
];

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  low: "bg-muted text-muted-foreground",
};

// ── Roadmap Board ──────────────────────────────────────────────────────────

function RoadmapBoard() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {KANBAN_COLS.map((col) => {
        const items = MILESTONES.filter((m) => m.status === col.id);
        return (
          <div
            key={col.id}
            className="rounded-2xl border border-border bg-card dark:glass-card p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${col.dotClass}`} />
              <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-border bg-background p-3 space-y-1.5"
                >
                  <p className="text-sm font-medium text-foreground leading-snug">{m.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{m.description}</p>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_BADGE[m.priority]}`}
                  >
                    {m.priority}
                  </span>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">Nothing here yet.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── AI Chat ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the AI assistant embedded in the spike.land founder cockpit.
spike.land is an AI development platform running on Cloudflare Workers with 80+ MCP tools.
Key packages: spike-app (Vite+TanStack Router), spike-edge (Hono edge API), spike-land-mcp (MCP registry),
mcp-auth (Better Auth), spike-land-backend (Durable Objects).
Help the founder with architecture decisions, product roadmap, debugging, and platform strategy.`;

function CockpitChat() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Message[]) : [];
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  async function handleSend(content: string) {
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setIsLoading(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/proxy/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = (await res.json()) as { content?: string; error?: string };
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.content ?? data.error ?? "No response",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        const errMsg: Message = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: `Error: ${err.message}`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
  }

  return (
    <div
      className="rounded-2xl border border-border bg-card dark:glass-card overflow-hidden flex flex-col"
      style={{ height: "480px" }}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">AI Chat</h3>
        <button
          onClick={clearHistory}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear history
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <ChatThread messages={messages} onSendMessage={handleSend} isLoading={isLoading} />
      </div>
    </div>
  );
}

// ── Experiments Dashboard ──────────────────────────────────────────────

interface DashboardExperiment {
  id: string;
  name: string;
  dimension: string;
  status: string;
  winner: string | null;
  trafficPct: number;
  createdAt: number;
}

interface VariantMetric {
  variantId: string;
  impressions: number;
  donations: number;
  revenue: number;
  fistbumps: number;
  donateRate: number;
  revenuePerImpression: number;
  conversionRate: number;
}

interface ExperimentMetrics {
  experimentId: string;
  name: string;
  status: string;
  winner: string | null;
  variants: VariantMetric[];
}

interface EvalResult {
  ready: boolean;
  reason?: string;
  graduated?: boolean;
  winner?: string | null;
  probabilities?: Record<string, number>;
  improvement?: number;
  controlRate?: number;
  winnerRate?: number;
  runtimeHours?: number;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  graduated: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

function ExperimentCard({ exp }: { exp: DashboardExperiment }) {
  const [metrics, setMetrics] = useState<ExperimentMetrics | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    fetch(apiUrl(`/experiments/${exp.id}/metrics`))
      .then((r) => r.json() as Promise<ExperimentMetrics>)
      .then(setMetrics)
      .catch(() => { });
  }, [expanded, exp.id]);

  const runEvaluation = async () => {
    setEvaluating(true);
    try {
      const res = await fetch(apiUrl(`/experiments/${exp.id}/evaluate`), { method: "POST" });
      const data = (await res.json()) as EvalResult;
      setEvalResult(data);
    } catch {
      setEvalResult({ ready: false, reason: "Request failed" });
    } finally {
      setEvaluating(false);
    }
  };

  const runtimeDays = Math.round((Date.now() - exp.createdAt) / 86400000);

  return (
    <div className="rounded-2xl border border-border bg-card dark:glass-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[exp.status] ?? "bg-muted text-muted-foreground"}`}
          >
            {exp.status}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{exp.name}</p>
            <p className="text-xs text-muted-foreground">
              {exp.dimension} — {runtimeDays}d running
            </p>
          </div>
        </div>
        <span className="text-muted-foreground text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && metrics && (
        <div className="border-t border-border p-4 space-y-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-1 pr-2">Variant</th>
                <th className="text-right py-1 px-2">Impressions</th>
                <th className="text-right py-1 px-2">Donations</th>
                <th className="text-right py-1 px-2">Donate Rate</th>
                <th className="text-right py-1 px-2">Revenue</th>
                <th className="text-right py-1 pl-2">Fistbumps</th>
              </tr>
            </thead>
            <tbody>
              {metrics.variants.map((v) => (
                <tr
                  key={v.variantId}
                  className={
                    metrics.winner === v.variantId ? "bg-green-50 dark:bg-green-900/10" : ""
                  }
                >
                  <td className="py-1.5 pr-2 font-medium text-foreground">
                    {v.variantId}
                    {metrics.winner === v.variantId && (
                      <span className="ml-1 text-green-600 dark:text-green-400 text-[10px]">
                        winner
                      </span>
                    )}
                  </td>
                  <td className="text-right py-1.5 px-2 text-muted-foreground">
                    {v.impressions.toLocaleString()}
                  </td>
                  <td className="text-right py-1.5 px-2 text-muted-foreground">{v.donations}</td>
                  <td className="text-right py-1.5 px-2 text-muted-foreground">
                    {(v.donateRate * 100).toFixed(2)}%
                  </td>
                  <td className="text-right py-1.5 px-2 font-semibold text-foreground">
                    ${(v.revenue / 100).toFixed(2)}
                  </td>
                  <td className="text-right py-1.5 pl-2 text-muted-foreground">{v.fistbumps}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center gap-3">
            <button
              onClick={runEvaluation}
              disabled={evaluating || exp.status !== "active"}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {evaluating ? "Evaluating..." : "Run Evaluation"}
            </button>

            {evalResult && (
              <div className="text-xs text-muted-foreground">
                {!evalResult.ready ? (
                  <span>{evalResult.reason}</span>
                ) : evalResult.graduated ? (
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    Graduated! Winner: {evalResult.winner} (+{evalResult.improvement}%)
                  </span>
                ) : (
                  <span>
                    P(best):{" "}
                    {Object.entries(evalResult.probabilities ?? {})
                      .map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`)
                      .join(", ")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExperimentsDashboard() {
  const [data, setData] = useState<{
    experiments: DashboardExperiment[];
    revenue24h: number;
  } | null>(null);

  useEffect(() => {
    fetch(apiUrl("/experiments/dashboard"))
      .then((r) => r.json() as Promise<{ experiments: DashboardExperiment[]; revenue24h: number }>)
      .then(setData)
      .catch(() => { });
  }, []);

  if (!data) {
    return <p className="text-sm text-muted-foreground">Loading experiments...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card dark:glass-card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            24h Experiment Revenue
          </p>
          <p className="text-2xl font-bold text-foreground">${data.revenue24h.toFixed(2)}</p>
        </div>
        <span className="text-xs text-muted-foreground">{data.experiments.length} experiments</span>
      </div>

      {data.experiments.map((exp) => (
        <ExperimentCard key={exp.id} exp={exp} />
      ))}
    </div>
  );
}

// ── Dev Health ─────────────────────────────────────────────────────────────

interface ErrorSummary {
  total: number;
  topCodes: Array<{ error_code: string; count: number }>;
  range: string;
}

function DevHealth() {
  const [errorSummary, setErrorSummary] = useState<ErrorSummary | null>(null);

  useEffect(() => {
    fetch("/errors/summary?range=24h")
      .then((r) => {
        if (!r.ok) return null;
        return r.json() as Promise<ErrorSummary>;
      })
      .then((data) => {
        if (data) setErrorSummary(data);
      })
      .catch(() => { });
  }, []);

  const errorCount = errorSummary?.total ?? "--";
  const errorColor = errorSummary
    ? errorSummary.total === 0
      ? "bg-green-500"
      : errorSummary.total < 10
        ? "bg-amber-500"
        : "bg-red-500"
    : "bg-muted";
  const topCode = errorSummary?.topCodes[0];
  const errorNote = topCode
    ? `Top: ${topCode.error_code} (${topCode.count})`
    : errorSummary
      ? "No errors"
      : "Loading...";

  const panels = [
    { label: "CI Status", value: "--", note: "Last run: --", color: "bg-muted" },
    { label: "Recent Deploys", value: "--", note: "No recent deploys", color: "bg-muted" },
    { label: "Errors (24h)", value: String(errorCount), note: errorNote, color: errorColor },
    { label: "Worker CPU p99", value: "--", note: "Cloudflare Analytics", color: "bg-muted" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {panels.map((p) => (
        <div key={p.label} className="rounded-2xl border border-border bg-card dark:glass-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {p.label}
          </p>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${p.color}`} />
            <span className="text-xl font-bold text-foreground">{p.value}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>
        </div>
      ))}
    </div>
  );
}

// ── Metrics Dashboard ──────────────────────────────────────────────────────

interface CockpitMetrics {
  userCount: number;
  activeSubscriptions: number;
  toolCount: number;
  mrr: number;
  recentSignups: Array<{ id: string; email: string; created_at: string }>;
  servicePurchases: number;
  recentServicePurchases: Array<{
    service: string;
    email: string | null;
    status: string;
    created_at: number;
  }>;
}

function MetricsDashboard() {
  const [data, setData] = useState<CockpitMetrics | null>(null);

  useEffect(() => {
    fetch(apiUrl("/cockpit/metrics"))
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json() as Promise<CockpitMetrics>;
      })
      .then(setData)
      .catch(() => { });
  }, []);

  const fmt = (n: number) => n.toLocaleString();
  const metrics = [
    { label: "Total Users", value: data ? fmt(data.userCount) : "--" },
    { label: "Active Subscriptions", value: data ? fmt(data.activeSubscriptions) : "--" },
    { label: "MCP Tools", value: data ? fmt(data.toolCount) : "--" },
    { label: "MRR", value: data ? `$${fmt(data.mrr)}` : "--" },
    { label: "Service Purchases", value: data ? fmt(data.servicePurchases) : "--" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-border bg-card dark:glass-card p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              {m.label}
            </p>
            <p className="text-2xl font-bold text-foreground">{m.value}</p>
          </div>
        ))}
      </div>

      {data && data.recentSignups.length > 0 && (
        <div className="rounded-2xl border border-border bg-card dark:glass-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Recent Signups
          </p>
          <div className="space-y-2">
            {data.recentSignups.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{u.email}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data && data.recentServicePurchases.length > 0 && (
        <div className="rounded-2xl border border-border bg-card dark:glass-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Service Purchases
          </p>
          <div className="space-y-2">
            {data.recentServicePurchases.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    {p.service.replace(/_/g, " ")}
                  </span>
                  <span className="text-foreground">{p.email ?? "guest"}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

// ── Cockpit Page ───────────────────────────────────────────────────────────

export function CockpitPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.email !== FOUNDER_EMAIL) {
    return <Navigate to="/" />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Founder Cockpit</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Private
        </span>
      </div>

      <Section title="Experiments">
        <ExperimentsDashboard />
      </Section>

      <Section title="Metrics Dashboard">
        <MetricsDashboard />
      </Section>

      <Section title="Dev Health">
        <DevHealth />
      </Section>

      <Section title="Roadmap Board">
        <RoadmapBoard />
      </Section>

      <Section title="AI Chat">
        <CockpitChat />
      </Section>
    </div>
  );
}
