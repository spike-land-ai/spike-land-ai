"use client";

import { cn } from "@/lib/utils";
import { Check, Circle, Loader2, X } from "lucide-react";

const STEPS = [
  { key: "UNPLANNED", label: "Unplanned" },
  { key: "PLANNING", label: "Planning" },
  { key: "PLAN_READY", label: "Ready" },
  { key: "APPROVED", label: "Approved" },
  { key: "SENT_TO_JULES", label: "Sent" },
  { key: "JULES_WORKING", label: "Working" },
  { key: "COMPLETED", label: "Done" },
] as const;

const STATUS_ORDER: Record<string, number> = {
  UNPLANNED: 0,
  PLANNING: 1,
  PLAN_READY: 2,
  APPROVED: 3,
  SENT_TO_JULES: 4,
  JULES_WORKING: 5,
  JULES_REVIEW: 5,
  BUILD_FIXING: 5,
  COMPLETED: 6,
  FAILED: -1,
};

export function WorkflowStepper({ status }: { status: string }) {
  const currentIndex = STATUS_ORDER[status] ?? 0;
  const isFailed = status === "FAILED";

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isCompleted = !isFailed && currentIndex > i;
        const isCurrent = !isFailed && currentIndex === i;
        const isActive = isCurrent && ["PLANNING", "JULES_WORKING"].includes(status);

        return (
          <div key={step.key} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center justify-center h-5 w-5 rounded-full transition-all duration-300",
                isCompleted && "bg-green-500/20 text-green-400",
                isCurrent && !isActive && "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50",
                isActive && "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50",
                isFailed && i === currentIndex && "bg-red-500/20 text-red-400",
                !isCompleted && !isCurrent && !isFailed && "bg-zinc-800 text-zinc-600",
              )}
            >
              {isCompleted ? (
                <Check className="h-3 w-3" />
              ) : isActive ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isFailed && i === currentIndex ? (
                <X className="h-3 w-3" />
              ) : (
                <Circle className="h-2 w-2" />
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-3 transition-colors duration-300",
                  isCompleted ? "bg-green-500/40" : "bg-zinc-700",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
