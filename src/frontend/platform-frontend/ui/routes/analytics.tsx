import { useCallback, useEffect, useState } from "react";

type TimeRange = "24h" | "7d" | "30d";

interface PlatformEvent {
  id: string;
  event_type: string;
  source: string;
  metadata: string;
  created_at: number;
}

interface AnalyticsSummary {
  totalEvents: number;
  uniqueUsers: number;
  eventsByType: Array<{ event_type: string; count: number }>;
  toolUsage: Array<{ tool_name: string; count: number }>;
  blogViews?: Array<{ slug: string; count: number }>;
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
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
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
  const ranges: TimeRange[] = ["24h", "7d", "30d"];
  return (
    <div role="group" aria-label="Time range" className="flex gap-1 rounded-lg border border-border bg-muted p-1">
      {ranges.map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            value === range
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

const API_BASE = "/api/analytics";

export function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [recentEvents, setRecentEvents] = useState<PlatformEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (range: TimeRange) => {
    setLoading(true);
    try {
      const [summaryRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE}/summary?range=${range}`),
        fetch(`${API_BASE}/events?range=${range}&limit=20`),
      ]);

      if (summaryRes.ok) {
        setSummary((await summaryRes.json()) as AnalyticsSummary);
      }
      if (eventsRes.ok) {
        setRecentEvents((await eventsRes.json()) as PlatformEvent[]);
      }
    } catch {
      // Network error — keep existing data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(timeRange);
  }, [timeRange, fetchData]);

  const toolInvocations =
    summary?.eventsByType.find((e) => e.event_type === "tool_use")?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Unique Visitors"
          value={loading ? "..." : String(summary?.uniqueUsers ?? 0)}
          subtitle={timeRange}
        />
        <MetricCard
          label="Tool Invocations"
          value={loading ? "..." : String(toolInvocations)}
          subtitle={timeRange}
        />
        <MetricCard
          label="Event Types"
          value={loading ? "..." : String(summary?.eventsByType.length ?? 0)}
        />
        <MetricCard
          label="Total Events"
          value={loading ? "..." : String(summary?.totalEvents ?? 0)}
          subtitle={timeRange}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Blog Views */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Top Articles
          </h3>
          {!summary?.blogViews?.length ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border-2 border-dashed border-border text-muted-foreground">
              {loading ? "Loading..." : "No blog views yet"}
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
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Top Tools by Usage
          </h3>
          {!summary?.toolUsage.length ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border-2 border-dashed border-border text-muted-foreground">
              {loading ? "Loading..." : "No tool usage data yet"}
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
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Activity
          </h3>
          {recentEvents.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border-2 border-dashed border-border text-muted-foreground">
              {loading ? "Loading..." : "No recent events"}
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
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Events by Type */}
      {summary?.eventsByType && summary.eventsByType.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Events by Type
          </h3>
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
