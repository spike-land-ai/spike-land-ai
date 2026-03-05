import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import { Button } from "@/shared/ui/button";
import { Zap, AlertTriangle } from "lucide-react";

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
  return Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / (1000 * 60 * 60)));
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
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-pulse">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-5 w-12 rounded-full bg-muted" />
        </div>
        <div className="mb-3 h-8 w-32 rounded bg-muted" />
        <div className="mb-1 h-2 w-full rounded-full bg-muted" />
        <div className="mb-6 flex justify-between">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
        <div className="h-10 w-full rounded-lg bg-muted" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-destructive mb-2">
          <AlertTriangle className="size-4" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">
            Balance Error
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Unable to load your credit balance at this time.</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
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
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Zap className="size-3.5 fill-current" />
          Credit Balance
        </h3>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border/50">
          {data.tier}
        </span>
      </div>

      <div className="mb-3 flex items-baseline gap-1.5">
        <span className={`text-3xl font-bold tracking-tight ${textColor}`}>
          {data.balance.toLocaleString()}
        </span>
        <span className="text-sm font-medium text-muted-foreground">credits remaining</span>
      </div>

      {isUnlimited ? (
        <p className="mb-4 text-sm text-muted-foreground">Unlimited daily credits included</p>
      ) : (
        <>
          <div
            className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-muted/50"
            role="progressbar"
            aria-valuenow={usedPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Daily credit usage"
          >
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <div className="mb-4 flex justify-between text-[11px] font-medium text-muted-foreground">
            <span>{data.usedToday.toLocaleString()} used today</span>
            <span>{data.dailyLimit.toLocaleString()} daily limit</span>
          </div>
        </>
      )}

      <p className="mb-6 text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded-md w-fit">
        Resets in <strong>{resetHours} {resetHours === 1 ? "hour" : "hours"}</strong>
      </p>

      <Button asChild className="w-full font-bold">
        <a href="/settings?tab=billing">
          Buy More Credits
        </a>
      </Button>
    </div>
  );
}
