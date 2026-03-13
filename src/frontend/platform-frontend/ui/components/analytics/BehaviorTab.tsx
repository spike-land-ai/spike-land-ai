import type { TimeRange, GA4ContentData, DashboardData } from "./types";
import { useGA4Data } from "./useGA4Data";
import { downloadCsv, csvFilename } from "./exportCsv";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function BehaviorTab({ range, d1Data }: { range: TimeRange; d1Data: DashboardData | null }) {
  const { data, loading } = useGA4Data<GA4ContentData>("/analytics/ga4/content", range);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  const blogViews = d1Data?.summary?.blogViews ?? [];

  return (
    <div className="space-y-6">
      {/* Engagement Metrics */}
      {data?.engagement && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rubik-panel p-5">
            <p className="text-sm text-muted-foreground">Pages / Session</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {data.engagement.pagesPerSession.toFixed(1)}
            </p>
          </div>
          <div className="rubik-panel p-5">
            <p className="text-sm text-muted-foreground">Engagement Rate</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {(data.engagement.engagementRate * 100).toFixed(1)}%
            </p>
          </div>
          <div className="rubik-panel p-5">
            <p className="text-sm text-muted-foreground">Avg Session Duration</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {formatDuration(data.engagement.avgSessionDuration)}
            </p>
          </div>
        </div>
      )}

      {/* Top Pages (GA4) */}
      {data && data.pages.length > 0 && (
        <div className="rubik-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Top Pages (GA4)
            </h2>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  data.pages.map((p) => ({
                    path: p.path,
                    views: p.views,
                    avg_duration_s: p.avgDuration.toFixed(1),
                    bounce_rate: (p.bounceRate * 100).toFixed(2),
                  })),
                  csvFilename("behavior-pages", range),
                )
              }
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-medium">Page</th>
                  <th className="pb-2 text-right font-medium">Views</th>
                  <th className="pb-2 text-right font-medium">Avg Time</th>
                  <th className="pb-2 text-right font-medium">Bounce</th>
                </tr>
              </thead>
              <tbody>
                {data.pages.map((page) => (
                  <tr key={page.path} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium text-foreground truncate max-w-xs">
                      {page.path}
                    </td>
                    <td className="py-2 text-right text-foreground">{page.views}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      {formatDuration(page.avgDuration)}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {(page.bounceRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Blog Views (D1) */}
      {blogViews.length > 0 && (
        <div className="rubik-panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Top Articles (Platform Events)
          </h2>
          <div className="space-y-2">
            {blogViews.slice(0, 10).map((view) => (
              <div
                key={view.slug}
                className="flex items-center justify-between rounded-2xl bg-muted px-3 py-2"
              >
                <span className="text-sm font-medium text-foreground">{view.slug}</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{
                      width: `${Math.max(12, (view.count / (blogViews[0]?.count ?? 1)) * 120)}px`,
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{view.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data?.pages.length && !blogViews.length && (
        <div className="flex h-48 items-center justify-center rounded-2xl border-2 border-dashed border-border text-muted-foreground">
          No behavior data for this range
        </div>
      )}
    </div>
  );
}
