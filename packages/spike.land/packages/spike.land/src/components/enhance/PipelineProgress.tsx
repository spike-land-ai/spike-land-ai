"use client";

import { cn } from "@/lib/utils";
import type { PipelineStage } from "@prisma/client";
import {
  Check,
  Crop,
  Loader2,
  ScanSearch,
  Sparkles,
  Wand2,
} from "lucide-react";

interface PipelineProgressProps {
  currentStage: PipelineStage | null;
  isComplete?: boolean;
  className?: string;
}

const STAGES: { key: PipelineStage; label: string; icon: typeof Loader2; }[] = [
  { key: "ANALYZING", label: "Analyzing", icon: ScanSearch },
  { key: "CROPPING", label: "Cropping", icon: Crop },
  { key: "PROMPTING", label: "Prompting", icon: Wand2 },
  { key: "GENERATING", label: "Generating", icon: Sparkles },
];

const STAGE_ORDER: Record<PipelineStage, number> = {
  ANALYZING: 0,
  CROPPING: 1,
  PROMPTING: 2,
  GENERATING: 3,
};

export function PipelineProgress(
  { currentStage, isComplete, className }: PipelineProgressProps,
) {
  const currentStageIndex = currentStage ? STAGE_ORDER[currentStage] : -1;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {STAGES.map((stage, index) => {
        const isPast = isComplete || index < currentStageIndex;
        const isCurrent = !isComplete && index === currentStageIndex;
        const isFuture = !isComplete && index > currentStageIndex;
        const Icon = stage.icon;

        return (
          <div key={stage.key} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
                isPast && "bg-green-500/20 text-green-400",
                isCurrent && "bg-primary/20 text-primary animate-pulse",
                isFuture && "bg-muted text-muted-foreground",
              )}
            >
              {isPast
                ? (
                  <Check
                    className="h-3 w-3"
                    aria-label={`${stage.label} completed`}
                  />
                )
                : isCurrent
                ? (
                  <Loader2
                    className="h-3 w-3 animate-spin"
                    aria-label={`${stage.label} in progress`}
                  />
                )
                : (
                  <Icon
                    className="h-3 w-3"
                    aria-label={`${stage.label} pending`}
                  />
                )}
              <span className="hidden sm:inline">{stage.label}</span>
            </div>
            {index < STAGES.length - 1 && (
              <div
                className={cn(
                  "w-4 h-0.5 mx-0.5",
                  isPast ? "bg-green-500/50" : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact version showing just the current stage label
 */
export function PipelineStageLabel({
  currentStage,
  className,
}: {
  currentStage: PipelineStage | null;
  className?: string;
}) {
  if (!currentStage) return null;

  const stage = STAGES.find(s => s.key === currentStage);
  if (!stage) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <Loader2
        className="h-3 w-3 animate-spin"
        aria-label={`${stage.label} in progress`}
      />
      <span>{stage.label}...</span>
    </span>
  );
}
