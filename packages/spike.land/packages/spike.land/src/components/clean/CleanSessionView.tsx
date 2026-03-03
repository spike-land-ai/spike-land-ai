"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCleanSession } from "@/hooks/useCleanSession";
import type { CleaningAchievement, CleaningTask } from "@/lib/clean/types";
import { SessionState } from "@/lib/clean/types";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { CleanCamera } from "./CleanCamera";
import { CleanCelebration } from "./CleanCelebration";
import { CleanPointsBadge } from "./CleanPointsBadge";
import { CleanSkipDialog } from "./CleanSkipDialog";
import { CleanTaskList } from "./CleanTaskList";
import { CleanVerificationView } from "./CleanVerificationView";

export function CleanSessionView() {
  const {
    session,
    loading,
    error,
    startSession,
    endSession,
    completeTask,
    skipTask,
  } = useCleanSession();

  const [state, setState] = useState<SessionState>(SessionState.IDLE);
  const [skipDialogTask, setSkipDialogTask] = useState<CleaningTask | null>(
    null,
  );
  const [newAchievement, setNewAchievement] = useState<
    CleaningAchievement | null
  >(null);

  const tasks = useMemo(() => session?.tasks ?? [], [session?.tasks]);
  const pendingTasks = tasks.filter(t => t.status === "PENDING");
  const currentTask = pendingTasks[0] ?? null;

  const handlePhotoCapture = useCallback(
    async (base64: string) => {
      setState(SessionState.ANALYZING);
      const result = await startSession(base64);
      if (result) {
        setState(SessionState.TASK_ACTIVE);
      } else {
        setState(SessionState.IDLE);
      }
    },
    [startSession],
  );

  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      if (!session) return;
      const result = await completeTask(session.id, taskId);
      if (result) {
        // Check if there are more pending tasks
        const remaining = tasks.filter(
          t => t.id !== taskId && t.status === "PENDING",
        );
        if (remaining.length === 0) {
          // All done - end session
          await endSession(session.id);
          setState(SessionState.COMPLETE);
        }
      }
    },
    [session, tasks, completeTask, endSession],
  );

  const handleSkipTask = useCallback(
    (taskId: string) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) setSkipDialogTask(task);
    },
    [tasks],
  );

  const handleConfirmSkip = useCallback(
    async (reason?: string) => {
      if (!session || !skipDialogTask) return;
      await skipTask(session.id, skipDialogTask.id, reason);
      setSkipDialogTask(null);

      const remaining = tasks.filter(
        t => t.id !== skipDialogTask.id && t.status === "PENDING",
      );
      if (remaining.length === 0) {
        await endSession(session.id);
        setState(SessionState.COMPLETE);
      }
    },
    [session, skipDialogTask, tasks, skipTask, endSession],
  );

  const handleVerificationCapture = useCallback(
    async (base64: string) => {
      if (!session || !currentTask) return;
      await completeTask(session.id, currentTask.id, base64);
      setState(SessionState.TASK_ACTIVE);
    },
    [session, currentTask, completeTask],
  );

  // IDLE state
  if (state === SessionState.IDLE) {
    return (
      <div className="space-y-6 text-center">
        <Card>
          <CardHeader>
            <CardTitle>Ready to Clean?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Take a photo of the room you want to clean. AI will analyze it and create a
              personalized task list for you.
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => setState(SessionState.SCANNING)}
            >
              Scan Room
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // SCANNING state
  if (state === SessionState.SCANNING) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-center">
          Take a photo of your room
        </h2>
        <CleanCamera
          onCapture={handlePhotoCapture}
          onCancel={() => setState(SessionState.IDLE)}
        />
      </div>
    );
  }

  // ANALYZING state
  if (state === SessionState.ANALYZING) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium">Analyzing your room...</p>
        <p className="text-sm text-muted-foreground">
          Creating your personalized task list
        </p>
      </div>
    );
  }

  // VERIFY state
  if (state === SessionState.VERIFY && currentTask) {
    return (
      <CleanVerificationView
        task={currentTask}
        onCapture={handleVerificationCapture}
        onSkip={() => setState(SessionState.TASK_ACTIVE)}
      />
    );
  }

  // COMPLETE state
  if (state === SessionState.COMPLETE) {
    const completedCount = tasks.filter(t => t.status === "COMPLETED").length;
    return (
      <div className="space-y-6">
        {newAchievement && (
          <CleanCelebration
            achievement={newAchievement}
            onDismiss={() => setNewAchievement(null)}
          />
        )}
        <Card variant="green">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-300" />
            <p className="text-2xl font-bold">Session Complete!</p>
            <p className="text-white/80">
              You completed {completedCount} of {tasks.length} tasks
            </p>
            {session && <CleanPointsBadge points={session.totalPoints} animated />}
          </CardContent>
        </Card>
        <Link href="/clean" className="block">
          <Button variant="outline" className="w-full">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  // TASK_ACTIVE state (default)
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <CleanTaskList
        tasks={tasks}
        currentTaskId={currentTask?.id ?? null}
        onComplete={handleCompleteTask}
        onSkip={handleSkipTask}
      />
      <CleanSkipDialog
        open={!!skipDialogTask}
        task={skipDialogTask}
        onConfirm={handleConfirmSkip}
        onCancel={() => setSkipDialogTask(null)}
      />
    </div>
  );
}
