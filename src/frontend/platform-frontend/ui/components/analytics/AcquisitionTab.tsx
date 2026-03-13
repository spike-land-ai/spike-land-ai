import type { TimeRange, GA4AcquisitionData } from "./types";
import { useGA4Data } from "./useGA4Data";
import { MiniDonut } from "./MiniDonut";
import { downloadCsv, csvFilename } from "./exportCsv";

export function AcquisitionTab({ range }: { range: TimeRange }) {
  const { data, loading } = useGA4Data<GA4AcquisitionData>("/analytics/ga4/acquisition", range);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground">No acquisition data available</p>;

  return (
    <div className="space-y-6">
      {/* Channel breakdown donut */}
      {data.channels.length > 0 && (
        <div className="rubik-panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Traffic Channels
          </h2>
          <MiniDonut
            segments={data.channels.map((ch) => ({
              label: ch.channel,
              value: ch.sessions,
            }))}
            size={120}
          />
        </div>
      )}

      {/* Top Sources table */}
      {data.sources.length > 0 && (
        <div className="rubik-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Top Sources
            </h2>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  data.sources.map((s) => ({
                    source: s.source,
                    medium: s.medium,
                    sessions: s.sessions,
                    bounce_rate: (s.bounceRate * 100).toFixed(2),
                  })),
                  csvFilename("acquisition-sources", range),
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
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium">Medium</th>
                  <th className="pb-2 text-right font-medium">Sessions</th>
                  <th className="pb-2 text-right font-medium">Bounce Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((src) => (
                  <tr
                    key={`${src.source}-${src.medium}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-2 font-medium text-foreground">{src.source}</td>
                    <td className="py-2 text-muted-foreground">{src.medium}</td>
                    <td className="py-2 text-right text-foreground">{src.sessions}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      {(src.bounceRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Landing Pages */}
      {data.landingPages.length > 0 && (
        <div className="rubik-panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Top Landing Pages
          </h2>
          <div className="space-y-2">
            {data.landingPages.map((lp) => {
              const maxSessions = data.landingPages[0]?.sessions ?? 1;
              return (
                <div
                  key={lp.page}
                  className="flex items-center justify-between rounded-2xl bg-muted px-3 py-2"
                >
                  <span className="text-sm font-medium text-foreground truncate max-w-[70%]">
                    {lp.page}
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.max(12, (lp.sessions / maxSessions) * 120)}px` }}
                    />
                    <span className="text-xs text-muted-foreground">{lp.sessions}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.channels.length === 0 && data.sources.length === 0 && (
        <div className="flex h-48 items-center justify-center rounded-2xl border-2 border-dashed border-border text-muted-foreground">
          No acquisition data for this range (try a longer range)
        </div>
      )}
    </div>
  );
}
