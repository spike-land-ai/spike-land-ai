import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import type { TimeRange, DashboardData } from "../components/analytics/types";
import { isRealtimeRange } from "../components/analytics/useGA4Data";
import { OverviewTab } from "../components/analytics/OverviewTab";
import { AcquisitionTab } from "../components/analytics/AcquisitionTab";
import { BehaviorTab } from "../components/analytics/BehaviorTab";
import { AudienceTab } from "../components/analytics/AudienceTab";
import { PlatformTab } from "../components/analytics/PlatformTab";
import { EventsTab } from "../components/analytics/EventsTab";
import { RealTimeMetrics } from "../components/analytics/RealTimeMetrics";

const ADMIN_EMAILS = new Set(["zoltan.erdos@spike.land", "zolika84@gmail.com"]);

type TabId = "overview" | "acquisition" | "behavior" | "audience" | "platform" | "events" | "realtime";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "acquisition", label: "Acquisition" },
  { id: "behavior", label: "Behavior" },
  { id: "audience", label: "Audience" },
  { id: "platform", label: "Platform" },
  { id: "events", label: "Events" },
  { id: "realtime", label: "Real-time" },
];

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

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
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

const D1_API_BASE = "/analytics";

export function AnalyticsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [d1Data, setD1Data] = useState<DashboardData | null>(null);
  const [d1Loading, setD1Loading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchD1Data = useCallback(async (range: TimeRange, isAutoRefresh = false) => {
    if (!isAutoRefresh) setD1Loading(true);
    try {
      const res = await fetch(`${D1_API_BASE}/dashboard?range=${range}`, {
        credentials: "include",
      });
      if (res.ok) {
        setD1Data((await res.json()) as DashboardData);
        setLastUpdated(Date.now());
      }
    } catch {
      // Network error — keep existing data
    } finally {
      if (!isAutoRefresh) setD1Loading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || !ADMIN_EMAILS.has(user.email)) return;
    fetchD1Data(timeRange);
  }, [timeRange, fetchD1Data, user]);

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
        fetchD1Data(timeRange, true);
        intervalRef.current = setInterval(() => fetchD1Data(timeRange, true), refreshMs);
      }
    };

    intervalRef.current = setInterval(() => fetchD1Data(timeRange, true), refreshMs);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [timeRange, fetchD1Data]);

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (!user || !ADMIN_EMAILS.has(user.email)) {
    return <Navigate to="/" />;
  }

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

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab range={timeRange} />}
      {activeTab === "acquisition" && <AcquisitionTab range={timeRange} />}
      {activeTab === "behavior" && <BehaviorTab range={timeRange} d1Data={d1Data} />}
      {activeTab === "audience" && <AudienceTab range={timeRange} />}
      {activeTab === "platform" && (
        <PlatformTab range={timeRange} data={d1Data} loading={d1Loading} />
      )}
      {activeTab === "events" && (
        <EventsTab range={timeRange} d1Data={d1Data} />
      )}
      {activeTab === "realtime" && <RealTimeMetrics />}
    </div>
  );
}
