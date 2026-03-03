"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CleanProgressBar } from "@/components/clean/CleanProgressBar";
import { CleanSkipDialog } from "@/components/clean/CleanSkipDialog";
import { CleanTaskCard } from "@/components/clean/CleanTaskCard";
import type { CleaningTask } from "@/lib/clean/types";
import { CheckCircle2, ListTodo, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";

interface TaskBoardProps {
  tasks: CleaningTask[];
  sessionId: string | null;
  loading: boolean;
  onComplete: (taskId: string) => void;
  onSkip: (taskId: string, reason?: string) => void;
  onRequeue: () => void;
}

export function TaskBoard({
  tasks,
  sessionId,
  loading,
  onComplete,
  onSkip,
  onRequeue,
}: TaskBoardProps) {
  const [skipDialogTask, setSkipDialogTask] = useState<CleaningTask | null>(
    null,
  );

  const pendingTasks = tasks.filter(t => t.status === "PENDING");
  const completedTasks = tasks.filter(t => t.status === "COMPLETED");
  const skippedTasks = tasks.filter(t => t.status === "SKIPPED");
  const currentTask = pendingTasks[0] ?? null;

  const doneCount = completedTasks.length + skippedTasks.length;
  const totalCount = tasks.length;

  const handleSkipClick = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) setSkipDialogTask(task);
  }, [tasks]);

  const handleConfirmSkip = useCallback(
    (reason?: string) => {
      if (!skipDialogTask) return;
      onSkip(skipDialogTask.id, reason);
      setSkipDialogTask(null);
    },
    [skipDialogTask, onSkip],
  );

  if (!sessionId || tasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <ListTodo className="h-12 w-12 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">
            No tasks yet. Scan your room to get started!
          </p>
        </CardContent>
      </Card>
    );
  }

  if (pendingTasks.length === 0) {
    return (
      <Card variant="green">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-300" />
          <div>
            <p className="text-lg font-bold">All tasks done!</p>
            <p className="text-sm text-white/70">
              {completedTasks.length} completed, {skippedTasks.length} skipped
            </p>
          </div>
          {skippedTasks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRequeue}
              disabled={loading}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Requeue Skipped ({skippedTasks.length})
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const totalPointsPending = pendingTasks.reduce(
    (sum, t) => sum + t.pointsValue,
    0,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Task Board</CardTitle>
            <Badge variant="secondary" className="tabular-nums">
              {pendingTasks.length} left · {totalPointsPending} pts
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <CleanProgressBar
            completed={doneCount}
            total={totalCount}
            label="Progress"
          />
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {tasks.map(task => (
              <CleanTaskCard
                key={task.id}
                task={task}
                isActive={task.id === currentTask?.id}
                onComplete={() => onComplete(task.id)}
                onSkip={() => handleSkipClick(task.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <CleanSkipDialog
        open={!!skipDialogTask}
        task={skipDialogTask}
        onConfirm={handleConfirmSkip}
        onCancel={() => setSkipDialogTask(null)}
      />
    </div>
  );
}
