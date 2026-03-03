"use client";

import { cn } from "@/lib/utils";
import { Check, Clock, Loader2, X } from "lucide-react";

type Phase =
  | "NEW"
  | "PLANNING"
  | "PLAN_REVIEW"
  | "CODING"
  | "TRANSPILING"
  | "CODE_REVIEW"
  | "PUBLISHED"
  | "FAILED";

interface Review {
  reviewerAgentId: string;
  decision: string;
  feedback: string | null;
  eloAtReview: number;
}

interface PipelineTimelineProps {
  currentPhase: Phase;
  message: string;
  reviews?: Review[];
}

const PHASES: { key: Phase; label: string; }[] = [
  { key: "PLANNING", label: "Planning" },
  { key: "PLAN_REVIEW", label: "Plan Review" },
  { key: "CODING", label: "Coding" },
  { key: "TRANSPILING", label: "Transpiling" },
  { key: "CODE_REVIEW", label: "Code Review" },
  { key: "PUBLISHED", label: "Published" },
];

const PHASE_ORDER = PHASES.map(p => p.key);

function getPhaseStatus(
  phase: Phase,
  currentPhase: Phase,
): "done" | "active" | "pending" | "failed" {
  if (currentPhase === "FAILED") {
    const currentIdx = PHASE_ORDER.indexOf(phase);
    const failedIdx = PHASE_ORDER.indexOf(currentPhase);
    if (currentIdx < failedIdx) return "done";
    if (currentIdx === failedIdx) return "failed";
    return "pending";
  }

  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  const phaseIdx = PHASE_ORDER.indexOf(phase);

  if (phaseIdx < currentIdx) return "done";
  if (phaseIdx === currentIdx) return "active";
  return "pending";
}

function PhaseIcon(
  { status }: { status: "done" | "active" | "pending" | "failed"; },
) {
  switch (status) {
    case "done":
      return <Check className="w-4 h-4 text-green-500" />;
    case "active":
      return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    case "failed":
      return <X className="w-4 h-4 text-destructive" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground/50" />;
  }
}

export function PipelineTimeline(
  { currentPhase, message, reviews }: PipelineTimelineProps,
) {
  return (
    <div className="space-y-3">
      {PHASES.map(({ key, label }) => {
        const status = getPhaseStatus(key, currentPhase);
        const isActive = status === "active";

        return (
          <div
            key={key}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all",
              isActive && "bg-primary/5 border border-primary/20",
              status === "done" && "opacity-60",
              status === "pending" && "opacity-30",
            )}
          >
            <PhaseIcon status={status} />
            <span
              className={cn(
                "text-sm font-medium",
                isActive && "text-foreground",
                status === "pending" && "text-muted-foreground",
              )}
            >
              {label}
            </span>

            {isActive && (
              <span className="text-xs text-muted-foreground ml-auto truncate max-w-[180px]">
                {message}
              </span>
            )}

            {/* Show reviewer badges for review phases */}
            {(key === "PLAN_REVIEW" || key === "CODE_REVIEW")
              && status === "done"
              && reviews
              && reviews.length > 0 && (
              <div className="ml-auto flex gap-1">
                {reviews.map(r => (
                  <span
                    key={r.reviewerAgentId}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
                      r.decision === "APPROVED"
                        ? "bg-green-500/10 text-green-600"
                        : "bg-red-500/10 text-red-600",
                    )}
                  >
                    {r.reviewerAgentId.slice(-4)} ({r.eloAtReview})
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
