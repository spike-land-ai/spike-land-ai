import { useState, useMemo } from "react";
import { useTable } from "@/hooks/useTable";

type TimeRange = "24h" | "7d" | "30d";

interface PlatformEvent {
  id: string;
  event_type: string;
  source: string;
  metadata: string;
  created_at: number;
}

interface Agent {
  identity: string;
  name: string;
  online: boolean;
  last_seen: number;
}

interface App {
  id: string;
  name: string;
  owner: string;
  version: number;
  message_count: number;
}

function timeRangeToMs(range: TimeRange): number {
  switch (range) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
  }
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
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
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
    <div className="flex gap-1 rounded-lg border bg-gray-50 p-1">
      {ranges.map((range) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            value === range
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

export function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const cutoff = Date.now() - timeRangeToMs(timeRange);

  const allEvents = useTable<PlatformEvent>("PlatformEvent");
  const agents = useTable<Agent>("Agent");
  const apps = useTable<App>("App");

  const filteredEvents = useMemo(
    () => allEvents.filter((e) => e.created_at >= cutoff),
    [allEvents, cutoff],
  );

  const onlineUsers = useMemo(() => agents.filter((a) => a.online).length, [agents]);

  const toolInvocations = useMemo(
    () => filteredEvents.filter((e) => e.event_type === "tool_use"),
    [filteredEvents],
  );

  const toolUsageByName = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of toolInvocations) {
      try {
        const meta = JSON.parse(event.metadata) as Record<string, unknown>;
        const name = (meta.toolName as string) ?? "unknown";
        counts.set(name, (counts.get(name) ?? 0) + 1);
      } catch {
        // skip malformed metadata
      }
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [toolInvocations]);

  const recentEvents = useMemo(
    () => [...filteredEvents].sort((a, b) => b.created_at - a.created_at).slice(0, 20),
    [filteredEvents],
  );

  const appsByActivity = useMemo(
    () => [...apps].sort((a, b) => b.message_count - a.message_count),
    [apps],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Users"
          value={String(agents.length)}
          subtitle={`${onlineUsers} online`}
        />
        <MetricCard
          label="Tool Invocations"
          value={String(toolInvocations.length)}
          subtitle={timeRange}
        />
        <MetricCard label="Active Apps" value={String(apps.length)} />
        <MetricCard
          label="Events Today"
          value={String(filteredEvents.length)}
          subtitle={timeRange}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tool Usage */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Top Tools by Usage
          </h3>
          {toolUsageByName.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed text-gray-400">
              No tool usage data yet
            </div>
          ) : (
            <div className="space-y-2">
              {toolUsageByName.slice(0, 10).map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                >
                  <span className="text-sm font-medium text-gray-700">{tool.name}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{
                        width: `${Math.max(
                          12,
                          (tool.count / (toolUsageByName[0]?.count ?? 1)) * 120,
                        )}px`,
                      }}
                    />
                    <span className="text-xs text-gray-500">{tool.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Activity */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Recent Activity
          </h3>
          {recentEvents.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed text-gray-400">
              No recent events
            </div>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                      {event.event_type}
                    </span>
                    <span className="text-sm text-gray-500">{event.source}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(event.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* App Performance */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          App Performance
        </h3>
        {appsByActivity.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed text-gray-400">
            No app data yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="pb-2 font-medium">App</th>
                  <th className="pb-2 font-medium">Owner</th>
                  <th className="pb-2 text-right font-medium">Messages</th>
                  <th className="pb-2 text-right font-medium">Version</th>
                </tr>
              </thead>
              <tbody>
                {appsByActivity.slice(0, 10).map((app) => (
                  <tr key={app.id} className="border-b last:border-0">
                    <td className="py-2 font-medium text-gray-900">{app.name}</td>
                    <td className="py-2 text-gray-500">{app.owner}</td>
                    <td className="py-2 text-right text-gray-700">{app.message_count}</td>
                    <td className="py-2 text-right text-gray-400">v{app.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
