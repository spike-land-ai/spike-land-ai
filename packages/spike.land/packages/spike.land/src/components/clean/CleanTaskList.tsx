"use client";

import type { CleaningTask } from "@/lib/clean/types";
import { CleanProgressBar } from "./CleanProgressBar";
import { CleanTaskCard } from "./CleanTaskCard";

interface CleanTaskListProps {
  tasks: CleaningTask[];
  currentTaskId: string | null;
  onComplete: (taskId: string) => void;
  onSkip: (taskId: string) => void;
}

export function CleanTaskList({
  tasks,
  currentTaskId,
  onComplete,
  onSkip,
}: CleanTaskListProps) {
  const completed = tasks.filter(
    t => t.status === "COMPLETED" || t.status === "SKIPPED",
  ).length;

  return (
    <div className="space-y-4">
      <CleanProgressBar
        completed={completed}
        total={tasks.length}
        label="Tasks"
      />
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {tasks.map(task => (
          <CleanTaskCard
            key={task.id}
            task={task}
            isActive={task.id === currentTaskId}
            onComplete={() => onComplete(task.id)}
            onSkip={() => onSkip(task.id)}
          />
        ))}
      </div>
    </div>
  );
}
