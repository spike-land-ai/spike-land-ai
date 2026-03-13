import type { TimeRange, GA4GeoData, GA4DevicesData, GA4RetentionData } from "./types";
import { useGA4Data } from "./useGA4Data";
import { MiniDonut } from "./MiniDonut";
import { downloadCsv, csvFilename } from "./exportCsv";

export function AudienceTab({ range }: { range: TimeRange }) {
  const { data: devices, loading: devLoading } = useGA4Data<GA4DevicesData>(
    "/analytics/ga4/devices",
    range,
  );
  const { data: geo, loading: geoLoading } = useGA4Data<GA4GeoData>("/analytics/ga4/geo", range);
  const { data: retention } = useGA4Data<GA4RetentionData>("/analytics/ga4/retention", range);

  const loading = devLoading || geoLoading;

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Device Categories */}
        {devices && devices.categories.length > 0 && (
          <div className="rubik-panel p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Devices
            </h2>
            <MiniDonut
              segments={devices.categories.map((d) => ({
                label: d.category,
                value: d.users,
              }))}
              size={120}
            />
          </div>
        )}

        {/* New vs Returning */}
        {retention && retention.newVsReturning.length > 0 && (
          <div className="rubik-panel p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              New vs Returning
            </h2>
            <MiniDonut
              segments={retention.newVsReturning.map((r) => ({
                label: r.type === "new" ? "New" : "Returning",
                value: r.users,
              }))}
              size={120}
            />
          </div>
        )}
      </div>

      {/* Browsers */}
      {devices && devices.browsers.length > 0 && (
        <div className="rubik-panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Browsers
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-medium">Browser</th>
                  <th className="pb-2 text-right font-medium">Users</th>
                </tr>
              </thead>
              <tbody>
                {devices.browsers.map((b) => (
                  <tr key={b.browser} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium text-foreground">{b.browser}</td>
                    <td className="py-2 text-right text-foreground">{b.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Countries */}
        {geo && geo.countries.length > 0 && (
          <div className="rubik-panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Countries
              </h2>
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    geo.countries.map((c) => ({ country: c.country, users: c.users, sessions: c.sessions })),
                    csvFilename("audience-countries", range),
                  )
                }
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Export CSV
              </button>
            </div>
            <div className="space-y-2">
              {geo.countries.map((c) => {
                const maxUsers = geo.countries[0]?.users ?? 1;
                return (
                  <div
                    key={c.country}
                    className="flex items-center justify-between rounded-2xl bg-muted px-3 py-2"
                  >
                    <span className="text-sm font-medium text-foreground">{c.country}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.max(12, (c.users / maxUsers) * 100)}px` }}
                      />
                      <span className="text-xs text-muted-foreground">{c.users}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cities */}
        {geo && geo.cities.length > 0 && (
          <div className="rubik-panel p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Cities
            </h2>
            <div className="space-y-2">
              {geo.cities.map((c) => {
                const maxUsers = geo.cities[0]?.users ?? 1;
                return (
                  <div
                    key={c.city}
                    className="flex items-center justify-between rounded-2xl bg-muted px-3 py-2"
                  >
                    <span className="text-sm font-medium text-foreground">{c.city}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.max(12, (c.users / maxUsers) * 100)}px` }}
                      />
                      <span className="text-xs text-muted-foreground">{c.users}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Languages */}
      {geo && geo.languages.length > 0 && (
        <div className="rubik-panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Languages
          </h2>
          <div className="flex flex-wrap gap-2">
            {geo.languages.map((l) => (
              <span
                key={l.language}
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
              >
                {l.language} ({l.users})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* OS */}
      {devices && devices.os.length > 0 && (
        <div className="rubik-panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Operating Systems
          </h2>
          <div className="flex flex-wrap gap-2">
            {devices.os.map((o) => (
              <span
                key={o.os}
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
              >
                {o.os} ({o.users})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
