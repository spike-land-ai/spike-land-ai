import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";

const FOUNDER_EMAIL = "zoltan.erdos@spike.land";

type TimeRange =
  | "1m"
  | "5m"
  | "15m"
  | "1h"
  | "6h"
  | "24h"
  | "7d"
  | "30d"
  | "3mo"
  | "6mo"
  | "1y"
  | "3y";

interface PlatformEvent {
  id: string;
  event_type: string;
  source: string;
  metadata: string;
  created_at: number;
}

interface FunnelRow {
  event_type: string;
  count: number;
  unique_users: number;
}

interface DashboardData {
  summary: {
    totalEvents: number;
    uniqueUsers: number;
    eventsByType: Array<{ event_type: string; count: number }>;
    toolUsage: Array<{ tool_name: string; count: number }>;
    blogViews?: Array<{ slug: string; count: number }>;
  };
  recentEvents: PlatformEvent[];
  funnel: FunnelRow[] | null;
  activeUsers: number | null;
  meta: {
    range: string;
    queriedAt: number;
    earliestEvent: number | null;
  };
}

const RANGE_GROUPS: { label: string; ranges: TimeRange[] }[] = [
  { label: "Realtime", ranges: ["1m", "5m", "15m"] },
  { label: "Short", ranges: ["1h", "6h", "24h"] },
  { label: "Medium", ranges: ["7d", "30d"] },
  { label: "Long", ranges: ["3mo", "6mo", "1y", "3y"] },
];

const AUTO_REFRESH: Partial<Record<TimeRange, number>> = {
  "1m": 10_000,
  "5m": 30_000,
  "15m": 60_000,
  "1h": 120_000,
};

function isRealtimeRange(range: TimeRange): boolean {
  return range in AUTO_REFRESH;
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

function MetricCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rubik-panel p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Time range"
      className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-muted p-1"
    >
      {RANGE_GROUPS.map((group, gi) => (
        <div key={group.label} className="flex items-center gap-1">
          {gi > 0 && (
            <span className="mx-0.5 text-border select-none" aria-hidden="true">
              ·
            </span>
          )}
          {group.ranges.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={value === range}
              onClick={() => onChange(range)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                value === range
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function LiveIndicator({ lastUpdated }: { lastUpdated: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
      </span>
      <span className="text-xs font-medium text-success-foreground">Live</span>
      {lastUpdated && (
        <span className="text-xs text-muted-foreground">Updated {relativeTime(lastUpdated)}</span>
      )}
    </div>
  );
}

const FUNNEL_ORDER = [
  "signup_completed",
  "mcp_server_connected",
  "first_tool_call",
  "second_session",
  "upgrade_completed",
];

const FUNNEL_LABELS: Record<string, string> = {
  signup_completed: "Signup",
  mcp_server_connected: "MCP Connected",
  first_tool_call: "First Tool Call",
  second_session: "Second Session",
  upgrade_completed: "Upgrade",
};

function ConversionFunnel({ data }: { data: FunnelRow[] }) {
  const ordered = FUNNEL_ORDER.map((type) => {
    const row = data.find((r) => r.event_type === type);
    return {
      type,
      label: FUNNEL_LABELS[type] ?? type,
      count: row?.unique_users ?? 0,
    };
  }).filter((step) => step.count > 0 || data.length > 0);

  const maxCount = Math.max(...ordered.map((s) => s.count), 1);

  if (ordered.every((s) => s.count === 0)) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border-2 border-dashed border-border text-muted-foreground">
        No funnel data yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ordered.map((step, i) => {
        const prevCount = i > 0 ? (ordered[i - 1]?.count ?? 0) : 0;
        const pct = i > 0 && prevCount > 0 ? ((step.count / prevCount) * 100).toFixed(1) : null;

        return (
          <div key={step.type} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{step.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-semibold">{step.count}</span>
                {pct && <span className="text-xs text-muted-foreground">{pct}% of prev</span>}
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-muted">
              <div
                className="h-3 rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(2, (step.count / maxCount) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const API_BASE = "/analytics";

export function AnalyticsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (range: TimeRange, isAutoRefresh = false) => {
    if (!isAutoRefresh) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dashboard?range=${range}`, {
        credentials: "include",
      });
      if (res.ok) {
        setData((await res.json()) as DashboardData);
        setLastUpdated(Date.now());
      }
    } catch {
      // Network error — keep existing data
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  }, []);

  // Initial fetch and range change
  useEffect(() => {
    if (!user || user.email !== FOUNDER_EMAIL) return;
    fetchData(timeRange);
  }, [timeRange, fetchData, user]);

  // Auto-refresh for realtime ranges
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const refreshMs = AUTO_REFRESH[timeRange];
    if (!refreshMs) return;

    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        fetchData(timeRange, true);
        intervalRef.current = setInterval(() => fetchData(timeRange, true), refreshMs);
      }
    };

    intervalRef.current = setInterval(() => fetchData(timeRange, true), refreshMs);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [timeRange, fetchData]);

  // Auth guard
  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (!user || user.email !== FOUNDER_EMAIL) {
    return <Navigate to="/" />;
  }

  const summary = data?.summary;
  const recentEvents = data?.recentEvents ?? [];
  const toolInvocations =
    summary?.eventsByType.find((e) => e.event_type === "tool_use")?.count ?? 0;
  const signups =
    summary?.eventsByType.find((e) => e.event_type === "signup_completed")?.count ?? 0;
  const conversionRate =
    summary && summary.uniqueUsers > 0 ? ((signups / summary.uniqueUsers) * 100).toFixed(1) : "0";
  const showFunnel = data?.funnel !== null && data?.funnel !== undefined;
  const isRealtime = isRealtimeRange(timeRange);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          {isRealtime && <LiveIndicator lastUpdated={lastUpdated} />}
          {!isRealtime && lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {relativeTime(lastUpdated)}
            </span>
          )}
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Unique Visitors"
          value={loading ? "..." : String(summary?.uniqueUsers ?? 0)}
          subtitle={
            isRealtime && data?.activeUsers != null ? `${data.activeUsers} active now` : timeRange
          }
        />
        <MetricCard
          label="Total Events"
          value={loading ? "..." : String(summary?.totalEvents ?? 0)}
          subtitle={timeRange}
        />
        <MetricCard
          label="Tool Invocations"
          value={loading ? "..." : String(toolInvocations)}
          subtitle={timeRange}
        />
        <MetricCard
          label="Conversion Rate"
          value={loading ? "..." : `${conversionRate}%`}
          subtitle={showFunnel ? "signups / visitors" : `${timeRange} (need 7d+)`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Blog Views */}
        <div className="rubik-panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Top Articles
          </h2>
          {!summary?.blogViews?.length ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border">
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading..." : "No blog views yet"}
              </p>
              {!loading && (
                <p className="max-w-48 text-center text-xs text-muted-foreground/70">
                  Blog view events will appear once readers visit articles.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {summary.blogViews.slice(0, 10).map((view) => (
                <div
                  key={view.slug}
                  className="flex items-center justify-between rounded-2xl bg-muted px-3 py-2"
                >
                  <span className="text-sm font-medium text-foreground">{view.slug}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${Math.max(
                          12,
                          (view.count / (summary.blogViews?.[0]?.count ?? 1)) * 120,
                        )}px`,
                      }}
                    />
                    <span className="text-xs text-muted-foreground">{view.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tool Usage */}
        <div className="rubik-panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Top Tools by Usage
          </h2>
          {!summary?.toolUsage.length ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border">
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading..." : "No tool usage data yet"}
              </p>
              {!loading && (
                <p className="max-w-48 text-center text-xs text-muted-foreground/70">
                  Tool invocations will be tracked as users connect MCP servers.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {summary.toolUsage.slice(0, 10).map((tool) => (
                <div
                  key={tool.tool_name}
                  className="flex items-center justify-between rounded-2xl bg-muted px-3 py-2"
                >
                  <span className="text-sm font-medium text-foreground">{tool.tool_name}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${Math.max(
                          12,
                          (tool.count / (summary.toolUsage[0]?.count ?? 1)) * 120,
                        )}px`,
                      }}
                    />
                    <span className="text-xs text-muted-foreground">{tool.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rubik-panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Activity
          </h2>
          {recentEvents.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border">
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading..." : "No recent events"}
              </p>
              {!loading && (
                <p className="max-w-48 text-center text-xs text-muted-foreground/70">
                  Platform events will stream here in near-real-time.
                </p>
              )}
            </div>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {event.event_type}
                    </span>
                    <span className="text-sm text-muted-foreground">{event.source}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {isRealtime
                      ? relativeTime(event.created_at)
                      : new Date(event.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conversion Funnel (only for >= 7d ranges) */}
        {showFunnel && data?.funnel && (
          <div className="rubik-panel p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Conversion Funnel
            </h2>
            <ConversionFunnel data={data.funnel} />
          </div>
        )}

        {/* Funnel placeholder for short ranges */}
        {!showFunnel && !loading && (
          <div className="rubik-panel p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Conversion Funnel
            </h2>
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border">
              <p className="text-sm text-muted-foreground">Requires 7d+ range</p>
              <p className="max-w-52 text-center text-xs text-muted-foreground/70">
                Switch to a 7-day or longer time window to view the signup-to-upgrade funnel.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Events by Type */}
      {summary?.eventsByType && summary.eventsByType.length > 0 && (
        <div className="rubik-panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Events by Type
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-medium">Event Type</th>
                  <th className="pb-2 text-right font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {summary.eventsByType.map((entry) => (
                  <tr key={entry.event_type} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium text-foreground">{entry.event_type}</td>
                    <td className="py-2 text-right text-foreground">{entry.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
