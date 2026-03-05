import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

interface CreditBalance {
  balance: number;
  dailyLimit: number;
  tier: string;
  usedToday: number;
}

function getBarColor(pct: number): string {
  if (pct > 50) return "bg-green-500";
  if (pct > 20) return "bg-yellow-500";
  return "bg-red-500";
}

function getTextColor(pct: number): string {
  if (pct > 50) return "text-green-600 dark:text-green-400";
  if (pct > 20) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getResetHours(): number {
  const now = new Date();
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / (1000 * 60 * 60));
}

export function CreditWidget() {
  const [data, setData] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/credits/balance"), { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load credits");
        return r.json() as Promise<CreditBalance>;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Credit Balance
        </h3>
        <div className="h-16 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Credit Balance
        </h3>
        <p className="text-sm text-muted-foreground">Unable to load credits.</p>
      </div>
    );
  }

  const isUnlimited = data.dailyLimit === 0;
  const usedPct = isUnlimited ? 0 : Math.min(100, (data.usedToday / data.dailyLimit) * 100);
  const remainingPct = 100 - usedPct;
  const barColor = isUnlimited ? "bg-green-500" : getBarColor(remainingPct);
  const textColor = isUnlimited ? "text-green-600 dark:text-green-400" : getTextColor(remainingPct);
  const resetHours = getResetHours();

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Credit Balance
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-foreground">
          {data.tier}
        </span>
      </div>

      {/* Balance */}
      <div className="mb-3 flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${textColor}`}>
          {data.balance.toLocaleString()}
        </span>
        <span className="text-sm text-muted-foreground">credits remaining</span>
      </div>

      {/* Usage meter */}
      {isUnlimited ? (
        <p className="mb-3 text-sm text-muted-foreground">Unlimited daily credits</p>
      ) : (
        <>
          <div
            className="mb-1 h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={usedPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Daily credit usage"
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <div className="mb-3 flex justify-between text-xs text-muted-foreground">
            <span>{data.usedToday.toLocaleString()} used today</span>
            <span>{data.dailyLimit.toLocaleString()} daily limit</span>
          </div>
        </>
      )}

      {/* Reset time */}
      <p className="mb-4 text-xs text-muted-foreground">
        Resets in {resetHours} {resetHours === 1 ? "hour" : "hours"}
      </p>

      <a
        href="/settings?tab=billing"
        className="block w-full rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        Buy More Credits
      </a>
    </div>
  );
}
