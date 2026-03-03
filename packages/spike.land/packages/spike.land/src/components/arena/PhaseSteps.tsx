"use client";

import type { ArenaPhase } from "@/lib/arena/types";

const PHASES: { key: ArenaPhase; label: string; }[] = [
  { key: "PROMPTED", label: "Prompted" },
  { key: "GENERATING", label: "Generating" },
  { key: "TRANSPILING", label: "Transpiling" },
  { key: "REVIEWING", label: "Reviewing" },
  { key: "SCORED", label: "Scored" },
];

interface PhaseStepsProps {
  currentPhase: ArenaPhase;
}

export function PhaseSteps({ currentPhase }: PhaseStepsProps) {
  const currentIndex = PHASES.findIndex(p => p.key === currentPhase);
  const isFailed = currentPhase === "FAILED";
  const isFixing = currentPhase === "FIXING";

  return (
    <div className="flex items-center gap-1">
      {PHASES.map((phase, i) => {
        const isActive = phase.key === currentPhase
          || (isFixing && phase.key === "TRANSPILING");
        const isComplete = i < currentIndex && !isFailed;
        const isCurrent = isActive && !isComplete;

        return (
          <div key={phase.key} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`h-0.5 w-6 ${isComplete ? "bg-green-500" : "bg-zinc-700"}`}
              />
            )}
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  isComplete
                    ? "bg-green-500 border-green-500"
                    : isCurrent
                    ? isFailed
                      ? "bg-red-500 border-red-500"
                      : "bg-blue-500 border-blue-500 animate-pulse"
                    : "bg-zinc-800 border-zinc-600"
                }`}
              />
              <span
                className={`text-[10px] mt-1 ${
                  isComplete
                    ? "text-green-400"
                    : isCurrent
                    ? isFailed ? "text-red-400" : "text-blue-400"
                    : "text-zinc-600"
                }`}
              >
                {phase.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
