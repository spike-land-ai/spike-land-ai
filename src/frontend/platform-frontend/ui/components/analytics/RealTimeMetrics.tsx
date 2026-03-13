import { useCallback, useEffect, useRef, useState } from "react";
import type { GA4RealtimeData, DashboardData } from "./types";

const REFRESH_MS = 30_000;

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function PulseDot({ active = true }: { active?: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {active && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      )}
      <span
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
          active ? "bg-emerald-400" : "bg-muted-foreground"
        }`}
      />
    </span>
  );
}

interface RealtimeKpiProps {
  label: string;
  value: string | number;
  sub?: string;
  loading?: boolean;
}

function RealtimeKpi({ label, value, sub, loading }: RealtimeKpiProps) {
  return (
    <div className="rubik-panel p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
        {loading ? <span className="animate-pulse">—</span> : value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function RealTimeMetrics() {
  const [ga4, setGa4] = useState<GA4RealtimeData | null>(null);
  const [platform, setPlatform] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(REFRESH_MS / 1000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ga4Res, platformRes] = await Promise.all([
        fetch("/analytics/ga4/realtime", { credentials: "include" }),
        fetch("/analytics/dashboard?range=1h", { credentials: "include" }),
      ]);

      if (ga4Res.ok) {
        setGa4((await ga4Res.json()) as GA4RealtimeData);
      }
      if (platformRes.ok) {
        setPlatform((await platformRes.json()) as DashboardData);
      }
      setLastUpdated(Date.now());
      setSecondsUntilRefresh(REFRESH_MS / 1000);
    } catch {
      // Network error — keep stale data
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    // Auto-refresh every 30s
    intervalRef.current = setInterval(() => {
      fetchAll(true);
    }, REFRESH_MS);

    // Countdown ticker
    countdownRef.current = setInterval(() => {
      setSecondsUntilRefresh((s) => (s <= 1 ? REFRESH_MS / 1000 : s - 1));
    }, 1000);

    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
      } else {
        fetchAll(true);
        intervalRef.current = setInterval(() => fetchAll(true), REFRESH_MS);
        countdownRef.current = setInterval(() => {
          setSecondsUntilRefresh((s) => (s <= 1 ? REFRESH_MS / 1000 : s - 1));
        }, 1000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchAll]);

  const recentEvents = (platform?.recentEvents ?? []).slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PulseDot active={!loading} />
          <span className="text-sm font-medium text-foreground">Live</span>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">Updated {relativeTime(lastUpdated)}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Refreshes in {secondsUntilRefresh}s
          </span>
          <button
            type="button"
            onClick={() => fetchAll()}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Refresh now
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RealtimeKpi
          label="Active Users"
          value={ga4?.activeUsers ?? 0}
          sub="right now (GA4)"
          loading={loading}
        />
        <RealtimeKpi
          label="Active (5m)"
          value={platform?.activeUsers ?? 0}
          sub="platform events"
          loading={loading}
        />
        <RealtimeKpi
          label="Recent Events"
          value={recentEvents.length}
          sub="last hour"
          loading={loading}
        />
        <RealtimeKpi
          label="Total (1h)"
          value={platform?.summary?.totalEvents ?? 0}
          sub="all event types"
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current page views */}
        {ga4 && ga4.topPages.length > 0 && (
          <div className="rubik-panel p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Active Pages
            </h2>
            <div className="space-y-2">
              {ga4.topPages.map((page) => {
                const pct = ga4.activeUsers > 0 ? (page.users / ga4.activeUsers) * 100 : 0;
                return (
                  <div key={page.page} className="space-y-0.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-foreground max-w-[70%]">
                        {page.page}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {page.users} users
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent events stream */}
        <div className="rubik-panel p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Events Stream
          </h2>
          {recentEvents.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              {loading ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
              ) : (
                "No recent events"
              )}
            </div>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <PulseDot active={Date.now() - event.created_at < 60_000} />
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {event.event_type}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{event.source}</span>
                  </div>
                  <span className="ml-2 shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {relativeTime(event.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Countries + Devices */}
      {ga4 && (ga4.topCountries.length > 0 || ga4.devices.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {ga4.topCountries.length > 0 && (
            <div className="rubik-panel p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Active Countries
              </h2>
              <div className="flex flex-wrap gap-2">
                {ga4.topCountries.map((c) => (
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

          {ga4.devices.length > 0 && (
            <div className="rubik-panel p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Active Devices
              </h2>
              <div className="space-y-2">
                {ga4.devices.map((d) => {
                  const maxUsers = ga4.devices[0]?.users ?? 1;
                  return (
                    <div
                      key={d.category}
                      className="flex items-center justify-between rounded-2xl bg-muted px-3 py-2"
                    >
                      <span className="text-sm font-medium text-foreground capitalize">
                        {d.category}
                      </span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{
                            width: `${Math.max(12, (d.users / maxUsers) * 80)}px`,
                          }}
                        />
                        <span className="text-xs text-muted-foreground">{d.users}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
