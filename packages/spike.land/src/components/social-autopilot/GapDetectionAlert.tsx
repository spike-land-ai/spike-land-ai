"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GapDetectionAlertProps {
  gapDays: number;
  lastPostDate: string;
  suggestedTime: string;
  platform: string;
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

export function GapDetectionAlert({
  gapDays,
  lastPostDate,
  suggestedTime,
  platform,
}: GapDetectionAlertProps) {
  const isUrgent = gapDays >= 7;

  return (
    <Card
      className={cn(
        "border transition-colors",
        isUrgent ? "bg-amber-500/5 border-amber-500/30" : "bg-yellow-500/5 border-yellow-500/20",
      )}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "p-2 rounded-lg shrink-0",
              isUrgent ? "bg-amber-500/15 text-amber-400" : "bg-yellow-500/10 text-yellow-400",
            )}
          >
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div className="space-y-1 min-w-0">
            <p
              className={cn(
                "text-sm font-semibold",
                isUrgent ? "text-amber-300" : "text-yellow-300",
              )}
            >
              {gapDays}-day posting gap detected on <span className="capitalize">{platform}</span>
            </p>
            <p className="text-xs text-zinc-400">
              Last post was on <span className="text-zinc-300 font-medium">{lastPostDate}</span>.
              Consistent posting improves reach and engagement.
            </p>
            <div
              className={cn(
                "inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-xs font-medium",
                isUrgent ? "bg-amber-500/15 text-amber-300" : "bg-yellow-500/10 text-yellow-300",
              )}
            >
              <span>Suggested post time:</span>
              <span className="font-bold">{suggestedTime}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
