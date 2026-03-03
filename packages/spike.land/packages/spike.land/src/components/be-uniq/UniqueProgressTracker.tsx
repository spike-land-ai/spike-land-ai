"use client";

import { cn } from "@/lib/utils";

interface UniqueProgressTrackerProps {
  answered: number;
  total: number;
  currentStreak?: number;
}

export function UniqueProgressTracker({
  answered,
  total,
  currentStreak,
}: UniqueProgressTrackerProps) {
  const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;
  const remaining = total - answered;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-300 font-medium">
          {answered} of {total} answered
        </span>
        <div className="flex items-center gap-3">
          {currentStreak !== undefined && currentStreak > 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full border",
                "bg-amber-500/10 text-amber-400 border-amber-500/30",
              )}
            >
              <span className="text-amber-400">&#9733;</span>
              {currentStreak} streak
            </span>
          )}
          <span className="text-zinc-500 text-xs font-mono">{percentage}%</span>
        </div>
      </div>

      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={answered}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${answered} of ${total} questions answered`}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-600 font-mono">
        <span>{answered} done</span>
        {remaining > 0 && <span>{remaining} remaining</span>}
        {remaining === 0 && <span className="text-violet-400 font-medium">Complete!</span>}
      </div>
    </div>
  );
}
