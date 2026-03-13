import type { TimeRange, FunnelRow } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelStep {
  key: string;
  label: string;
  icon: string;
  description: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FUNNEL_STEPS: FunnelStep[] = [
  {
    key: "page_view",
    label: "Visit",
    icon: "→",
    description: "Lands on spike.land",
  },
  {
    key: "store_browse",
    label: "Browse Store",
    icon: "⊞",
    description: "Views the app store",
  },
  {
    key: "app_view",
    label: "View App",
    icon: "◎",
    description: "Opens an app page",
  },
  {
    key: "store_app_install",
    label: "Install",
    icon: "↓",
    description: "Installs / connects an app",
  },
  {
    key: "first_tool_call",
    label: "Use",
    icon: "✓",
    description: "Makes first tool call",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function conversionColor(rate: number): string {
  if (rate >= 0.6) return "text-emerald-500";
  if (rate >= 0.3) return "text-amber-500";
  return "text-rose-500";
}

function dropOffWidth(count: number, max: number): number {
  if (max === 0) return 0;
  return Math.max(4, (count / max) * 100);
}

// ─── FunnelView ───────────────────────────────────────────────────────────────

interface FunnelViewProps {
  data: FunnelRow[] | null;
  range: TimeRange;
  loading?: boolean;
}

export function FunnelView({ data, range, loading }: FunnelViewProps) {
  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border">
        <p className="text-sm text-muted-foreground">
          {["1m", "5m", "15m", "1h", "6h", "24h"].includes(range)
            ? "Funnel requires 7d+ range"
            : "No funnel data yet"}
        </p>
        <p className="max-w-xs text-center text-xs text-muted-foreground/60">
          {["1m", "5m", "15m", "1h", "6h", "24h"].includes(range)
            ? "Switch to 7d or longer to view the full conversion funnel."
            : "Events will appear here once users complete funnel steps."}
        </p>
      </div>
    );
  }

  // Map API data to funnel steps — fill zeros for missing steps
  const stepValues: Array<{ step: FunnelStep; count: number; uniqueUsers: number }> =
    FUNNEL_STEPS.map((step) => {
      const row = data.find((r) => r.event_type === step.key);
      return {
        step,
        count: row?.count ?? 0,
        uniqueUsers: row?.unique_users ?? 0,
      };
    });

  // If every step is zero use counts from whatever data we have (fallback)
  const hasAnyData = stepValues.some((s) => s.uniqueUsers > 0);
  if (!hasAnyData) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border">
        <p className="text-sm text-muted-foreground">No funnel data yet</p>
      </div>
    );
  }

  const topCount = Math.max(...stepValues.map((s) => s.uniqueUsers), 1);

  return (
    <div className="space-y-6">
      {/* Visual funnel */}
      <div className="space-y-1">
        {stepValues.map((sv, i) => {
          const prev = i > 0 ? stepValues[i - 1] : null;
          const convRate = prev && prev.uniqueUsers > 0
            ? sv.uniqueUsers / prev.uniqueUsers
            : null;
          const barWidth = dropOffWidth(sv.uniqueUsers, topCount);

          return (
            <div key={sv.step.key} className="space-y-0.5">
              {/* Drop-off connector */}
              {i > 0 && (
                <div className="flex items-center gap-3 py-1 pl-4">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <div className="h-full w-px bg-border" />
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      convRate !== null ? conversionColor(convRate) : "text-muted-foreground"
                    }`}
                  >
                    {convRate !== null
                      ? `${(convRate * 100).toFixed(1)}% converted`
                      : "—"}
                  </span>
                  {convRate !== null && convRate < 1 && (
                    <span className="text-xs text-muted-foreground">
                      {(prev?.uniqueUsers ?? 0) - sv.uniqueUsers} dropped off
                    </span>
                  )}
                </div>
              )}

              {/* Step row */}
              <div className="rubik-panel overflow-hidden p-0">
                <div
                  className="relative flex min-h-[64px] items-center gap-4 px-5 py-4"
                  style={{
                    background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${barWidth}%, transparent ${barWidth}%)`,
                    backgroundSize: "100% 100%",
                    backgroundBlendMode: "overlay",
                  }}
                >
                  {/* Tinted fill */}
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-10"
                    style={{
                      background: `linear-gradient(to right, var(--color-primary), transparent ${barWidth}%)`,
                    }}
                  />

                  {/* Icon */}
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-base font-bold text-foreground">
                    {sv.step.icon}
                  </div>

                  {/* Text */}
                  <div className="relative z-10 min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="text-sm font-semibold text-foreground">
                        {sv.step.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{sv.step.description}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>

                  {/* Count */}
                  <div className="relative z-10 shrink-0 text-right">
                    <div className="text-lg font-bold tabular-nums text-foreground">
                      {sv.uniqueUsers.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {sv.count.toLocaleString()} events
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary table */}
      <div className="rubik-panel overflow-x-auto p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Conversion Summary
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="pb-2 font-medium">Step</th>
              <th className="pb-2 text-right font-medium">Users</th>
              <th className="pb-2 text-right font-medium">Events</th>
              <th className="pb-2 text-right font-medium">vs Previous</th>
              <th className="pb-2 text-right font-medium">vs Top</th>
            </tr>
          </thead>
          <tbody>
            {stepValues.map((sv, i) => {
              const prev = i > 0 ? stepValues[i - 1] : null;
              const convRate = prev && prev.uniqueUsers > 0
                ? sv.uniqueUsers / prev.uniqueUsers
                : null;
              const topRate = topCount > 0 ? sv.uniqueUsers / topCount : 0;

              return (
                <tr key={sv.step.key} className="border-b border-border last:border-0">
                  <td className="py-2">
                    <span className="font-medium text-foreground">{sv.step.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{sv.step.description}</span>
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums text-foreground">
                    {sv.uniqueUsers.toLocaleString()}
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {sv.count.toLocaleString()}
                  </td>
                  <td className={`py-2 text-right font-medium tabular-nums ${
                    convRate !== null ? conversionColor(convRate) : "text-muted-foreground"
                  }`}>
                    {convRate !== null ? `${(convRate * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {(topRate * 100).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
