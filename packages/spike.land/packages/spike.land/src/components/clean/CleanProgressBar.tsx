"use client";

import { Progress } from "@/components/ui/progress";

interface CleanProgressBarProps {
  completed: number;
  total: number;
  label?: string;
}

export function CleanProgressBar(
  { completed, total, label }: CleanProgressBarProps,
) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">
            {completed}/{total}
          </span>
        </div>
      )}
      <Progress
        value={percentage}
        variant={percentage === 100 ? "success" : "default"}
        glow={percentage === 100}
      />
    </div>
  );
}
