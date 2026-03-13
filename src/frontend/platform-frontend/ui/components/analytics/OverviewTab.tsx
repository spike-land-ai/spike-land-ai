import type { TimeRange, GA4OverviewData, GA4RealtimeData } from "./types";
import { useGA4Data } from "./useGA4Data";
import { SparklineChart } from "./SparklineChart";
import { downloadCsv, csvFilename } from "./exportCsv";

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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function OverviewTab({ range }: { range: TimeRange }) {
  const { data: overview, loading } = useGA4Data<GA4OverviewData>("/analytics/ga4/overview", range);
  const { data: realtime } = useGA4Data<GA4RealtimeData>("/analytics/ga4/realtime", range);

  const isRealtime = overview?.isRealtime;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Sessions"
          value={
            loading
              ? "..."
              : isRealtime
                ? String(realtime?.activeUsers ?? 0)
                : String(overview?.sessions ?? 0)
          }
          subtitle={isRealtime ? "active now" : range}
        />
        <MetricCard
          label="Active Users"
          value={loading ? "..." : String(overview?.activeUsers ?? 0)}
          subtitle={range}
        />
        <MetricCard
          label="Page Views"
          value={loading ? "..." : String(overview?.pageViews ?? 0)}
          subtitle={range}
        />
        <MetricCard
          label="Avg Session Duration"
          value={loading ? "..." : formatDuration(overview?.avgSessionDuration ?? 0)}
          subtitle={isRealtime ? "realtime" : range}
        />
      </div>

      {/* Engagement KPIs */}
      {!isRealtime && overview && (
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Bounce Rate" value={`${(overview.bounceRate * 100).toFixed(1)}%`} />
          <MetricCard
            label="Engagement Rate"
            value={`${(overview.engagementRate * 100).toFixed(1)}%`}
          />
          <MetricCard
            label="Realtime Users"
            value={String(realtime?.activeUsers ?? 0)}
            subtitle="right now"
          />
        </div>
      )}

      {/* Time Series */}
      {!isRealtime && overview && overview.timeSeries.length > 1 && (
        <div className="rubik-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Traffic Over Time
            </h2>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  overview.timeSeries.map((d) => ({ date: d.date, sessions: d.sessions, users: d.users })),
                  csvFilename("overview-traffic", range),
                )
              }
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Export CSV
            </button>
          </div>
          <SparklineChart
            data={overview.timeSeries.map((d) => d.sessions)}
            secondaryData={overview.timeSeries.map((d) => d.users)}
            labels={overview.timeSeries.map((d) => d.date)}
            height={80}
          />
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-4 rounded bg-primary" /> Sessions
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-4 rounded bg-muted-foreground opacity-50" /> Users
            </span>
          </div>
        </div>
      )}

      {/* Realtime top pages */}
      {realtime && realtime.topPages.length > 0 && (
        <div className="rubik-panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Active Pages (Realtime)
          </h2>
          <div className="space-y-2">
            {realtime.topPages.slice(0, 10).map((page) => (
              <div
                key={page.page}
                className="flex items-center justify-between rounded-2xl bg-muted px-3 py-2"
              >
                <span className="text-sm font-medium text-foreground truncate max-w-[70%]">
                  {page.page}
                </span>
                <span className="text-xs font-semibold text-foreground">{page.users} users</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Realtime countries */}
      {realtime && realtime.topCountries.length > 0 && (
        <div className="rubik-panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Active Countries (Realtime)
          </h2>
          <div className="flex flex-wrap gap-2">
            {realtime.topCountries.map((c) => (
              <span
                key={c.country}
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
              >
                {c.country} ({c.users})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
