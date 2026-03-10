import { ExternalLink, RefreshCw, Server, Sigma, TimerReset, Waypoints } from "lucide-react";
import { startTransition, useEffect, useState, type ReactNode } from "react";
import { Skeleton } from "../../core-logic/skeleton";

type StatusRangeKey = "60m" | "6h" | "24h";
type ServiceStatus = "up" | "degraded" | "down";

interface StatusPayload {
  overall: "operational" | "partial_degradation" | "major_outage";
  timestamp: string;
  range: {
    key: StatusRangeKey;
    label: string;
    windowMinutes: number;
  };
  summary: {
    up: number;
    degraded: number;
    down: number;
    total: number;
  };
  platform: {
    currentRpm: number;
    totalRequests: number;
    peakRpm: number;
    meanLatencyMs: number | null;
  };
  services: StatusService[];
}

interface StatusService {
  label: string;
  url: string;
  status: ServiceStatus;
  httpStatus: number | null;
  latencyMs: number;
  error: string | null;
  history: {
    summary: {
      totalRequests: number;
      currentRpm: number;
      averageRpm: number;
      currentRpmDelta: number;
      peakRpm: number;
      minLatencyMs: number | null;
      maxLatencyMs: number | null;
      meanLatencyMs: number | null;
      stddevLatencyMs: number | null;
      latestAvgLatencyMs: number | null;
      latestLatencyDeltaMs: number | null;
    };
    chartPoints: Array<{
      bucketStartMs: number;
      requestCount: number;
    }>;
  };
}

const STATUS_API_URL = "https://status.spike.land/api/status";
const RANGE_OPTIONS: Array<{ key: StatusRangeKey; label: string }> = [
  { key: "60m", label: "1h" },
  { key: "6h", label: "6h" },
  { key: "24h", label: "24h" },
];

function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits).replace(/\.0$/, "");
}

function formatRpm(value: number): string {
  return `${formatNumber(value, value >= 10 ? 0 : 1)} rpm`;
}

function formatDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  if (value >= 1000) {
    return `${formatNumber(value / 1000, 2)}s`;
  }

  return `${formatNumber(value, value >= 100 ? 0 : 1)}ms`;
}

function formatSignedDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  const sign = value > 0 ? "+" : value < 0 ? "-" : "±";
  return `${sign}${formatDuration(Math.abs(value))}`;
}

function formatSignedRpm(value: number): string {
  if (value === 0) {
    return "±0 rpm";
  }

  const sign = value > 0 ? "+" : "-";
  return `${sign}${formatRpm(Math.abs(value))}`;
}

function getOverallLabel(overall: StatusPayload["overall"]): string {
  if (overall === "major_outage") {
    return "Major outage";
  }

  if (overall === "partial_degradation") {
    return "Partial degradation";
  }

  return "Operational";
}

function getStatusTone(status: ServiceStatus): {
  badge: string;
  text: string;
  panel: string;
  bar: string;
  latestBar: string;
} {
  if (status === "down") {
    return {
      badge: "border-destructive/20 bg-destructive/70 text-destructive-foreground",
      text: "text-destructive",
      panel: "border-destructive/25",
      bar: "bg-destructive/35",
      latestBar: "bg-destructive",
    };
  }

  if (status === "degraded") {
    return {
      badge: "border-warning/20 bg-warning/70 text-warning-foreground",
      text: "text-warning-foreground",
      panel: "border-warning/25",
      bar: "bg-warning/35",
      latestBar: "bg-warning",
    };
  }

  return {
    badge: "border-success/20 bg-success/70 text-success-foreground",
    text: "text-success-foreground",
    panel: "border-success/25",
    bar: "bg-success/30",
    latestBar: "bg-success",
  };
}

function MetricTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[1.4rem] border border-border bg-card/85 p-5 shadow-[0_24px_60px_color-mix(in_srgb,var(--fg)_5%,transparent)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function RequestBars({
  points,
  status,
}: {
  points: StatusService["history"]["chartPoints"];
  status: ServiceStatus;
}) {
  const tone = getStatusTone(status);
  const maxRequests = Math.max(1, ...points.map((point) => point.requestCount));

  return (
    <div className="space-y-3 rounded-[1.2rem] border border-border/80 bg-background/70 p-4">
      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        <span>Requests / minute</span>
        <span>{points.length} buckets</span>
      </div>
      <div className="flex h-24 items-end gap-1">
        {points.map((point, index) => {
          const height =
            point.requestCount === 0
              ? "8%"
              : `${Math.max(10, (point.requestCount / maxRequests) * 100)}%`;
          const isLatest = index === points.length - 1;

          return (
            <div
              key={`${point.bucketStartMs}-${index}`}
              className={`min-w-0 flex-1 rounded-t-full transition-[height,opacity] duration-300 ${
                isLatest ? tone.latestBar : tone.bar
              } ${point.requestCount === 0 ? "opacity-30" : "opacity-100"}`}
              style={{ height }}
              title={`${new Date(point.bucketStartMs).toISOString()}: ${point.requestCount} rpm`}
            />
          );
        })}
      </div>
    </div>
  );
}

function ServiceCard({ service, rangeLabel }: { service: StatusService; rangeLabel: string }) {
  const tone = getStatusTone(service.status);

  return (
    <article
      className={`rounded-[1.6rem] border bg-card/90 p-5 shadow-[0_24px_70px_color-mix(in_srgb,var(--fg)_5%,transparent)] backdrop-blur ${tone.panel}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xl font-semibold tracking-[-0.04em] text-foreground">
              {service.label}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{service.url}</p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${tone.badge}`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {service.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border bg-background/70 px-3 py-1.5">
            Live probe {formatDuration(service.latencyMs)}
          </span>
          <span className="rounded-full border border-border bg-background/70 px-3 py-1.5">
            HTTP {service.httpStatus ?? "—"}
          </span>
          <span
            className={`rounded-full border border-border bg-background/70 px-3 py-1.5 ${tone.text}`}
          >
            {service.error ?? "Healthy response"}
          </span>
        </div>

        <RequestBars points={service.history.chartPoints} status={service.status} />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-[1.1rem] border border-border bg-background/60 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Current load
            </p>
            <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
              {formatRpm(service.history.summary.currentRpm)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatSignedRpm(service.history.summary.currentRpmDelta)} vs mean
            </p>
          </div>
          <div className="rounded-[1.1rem] border border-border bg-background/60 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Latency spread
            </p>
            <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
              {formatDuration(service.history.summary.stddevLatencyMs)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Standard deviation over {rangeLabel.toLowerCase()}
            </p>
          </div>
          <div className="rounded-[1.1rem] border border-border bg-background/60 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Mean latency
            </p>
            <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
              {formatDuration(service.history.summary.meanLatencyMs)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              latest {formatSignedDuration(service.history.summary.latestLatencyDeltaMs)}
            </p>
          </div>
          <div className="rounded-[1.1rem] border border-border bg-background/60 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Min / max
            </p>
            <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
              {formatDuration(service.history.summary.minLatencyMs)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              max {formatDuration(service.history.summary.maxLatencyMs)}
            </p>
          </div>
          <div className="rounded-[1.1rem] border border-border bg-background/60 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Observed requests
            </p>
            <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
              {service.history.summary.totalRequests.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              peak {formatRpm(service.history.summary.peakRpm)}
            </p>
          </div>
          <div className="rounded-[1.1rem] border border-border bg-background/60 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Request window
            </p>
            <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
              {rangeLabel}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              avg {formatRpm(service.history.summary.averageRpm)}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-[1.4rem]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[26rem] rounded-[1.6rem]" />
        ))}
      </div>
    </div>
  );
}

export function StatusPage() {
  const [range, setRange] = useState<StatusRangeKey>("6h");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadStatus() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${STATUS_API_URL}?range=${range}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Status API returned ${response.status}`);
        }

        const nextPayload = (await response.json()) as StatusPayload;
        if (!cancelled) {
          setPayload(nextPayload);
        }
      } catch (requestError) {
        if (controller.signal.aborted || cancelled) {
          return;
        }

        const message =
          requestError instanceof Error ? requestError.message : "Unable to load system telemetry.";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [range, refreshNonce]);

  const services = payload?.services ?? [];

  return (
    <div className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_38%),radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--success)_10%,transparent),transparent_34%),linear-gradient(180deg,color-mix(in_srgb,var(--background)_96%,black_4%),color-mix(in_srgb,var(--background)_100%,black_12%))]" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
          <div className="rounded-[2rem] border border-border bg-card/90 p-7 shadow-[0_26px_90px_color-mix(in_srgb,var(--fg)_6%,transparent)] backdrop-blur sm:p-9">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Platform telemetry
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.08em] text-foreground sm:text-5xl">
              Historical request pressure and latency spread per service.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              View requests per minute, min and max request time, weighted mean latency, and the
              deviation from that mean for each production service. This frontend consumes the live
              status API directly, so it stays aligned with the dedicated status host.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => startTransition(() => setRange(option.key))}
                  aria-pressed={range === option.key}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    range === option.key
                      ? "border-primary/30 bg-primary/15 text-primary"
                      : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <a
                href="https://status.spike.land"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                Open dedicated host
                <ExternalLink className="size-4" />
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border bg-card/90 p-7 shadow-[0_26px_90px_color-mix(in_srgb,var(--fg)_6%,transparent)] backdrop-blur sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Live status
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] ${
                  payload?.overall === "major_outage"
                    ? "border-destructive/20 bg-destructive/70 text-destructive-foreground"
                    : payload?.overall === "partial_degradation"
                      ? "border-warning/20 bg-warning/70 text-warning-foreground"
                      : "border-success/20 bg-success/70 text-success-foreground"
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-current" />
                {getOverallLabel(payload?.overall ?? "operational")}
              </div>
              {payload && (
                <span className="font-mono text-xs text-muted-foreground">{payload.timestamp}</span>
              )}
            </div>
            <div className="mt-5 space-y-4">
              <div className="rounded-[1.25rem] border border-border bg-background/65 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Service count
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  {payload ? `${payload.summary.up}/${payload.summary.total}` : "—"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {payload
                    ? `${payload.summary.degraded} degraded · ${payload.summary.down} down`
                    : "Waiting for status payload"}
                </p>
              </div>
              {error && (
                <div className="rounded-[1.25rem] border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.25rem] border border-border bg-background/65 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Current rpm
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                    {payload ? formatRpm(payload.platform.currentRpm) : "—"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-border bg-background/65 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Mean latency
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                    {payload ? formatDuration(payload.platform.meanLatencyMs) : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loading && !payload ? (
          <StatusSkeleton />
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-4">
              <MetricTile
                label="Current load"
                value={payload ? formatRpm(payload.platform.currentRpm) : "—"}
                hint={payload ? `${payload.summary.total} tracked services` : "Live service demand"}
                icon={<Waypoints className="size-4" />}
              />
              <MetricTile
                label="Observed requests"
                value={payload ? payload.platform.totalRequests.toLocaleString() : "—"}
                hint={payload ? payload.range.label : "Rolling telemetry window"}
                icon={<Server className="size-4" />}
              />
              <MetricTile
                label="Peak minute"
                value={payload ? formatRpm(payload.platform.peakRpm) : "—"}
                hint="Highest request bucket in the selected range"
                icon={<Sigma className="size-4" />}
              />
              <MetricTile
                label="Last refresh"
                value={payload ? new Date(payload.timestamp).toLocaleTimeString() : "—"}
                hint="Status API payload timestamp"
                icon={<TimerReset className="size-4" />}
              />
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Service breakdown
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                    Requests, request time floor and ceiling, mean, and deviation.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => startTransition(() => setRefreshNonce((current) => current + 1))}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                >
                  <RefreshCw className="size-4" />
                  Refresh
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {services.map((service) => (
                  <ServiceCard
                    key={service.label}
                    service={service}
                    rangeLabel={payload?.range.label ?? "Range"}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
