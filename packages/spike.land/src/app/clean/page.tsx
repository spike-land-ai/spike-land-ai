"use client";

import { MotivationBanner } from "@/components/clean/MotivationBanner";
import { StreakDisplay } from "@/components/clean/StreakDisplay";
import { TaskBoard } from "@/components/clean/TaskBoard";
import { RoomScanner } from "@/components/clean/RoomScanner";
import { CleanCelebration } from "@/components/clean/CleanCelebration";
import { CleanPointsBadge } from "@/components/clean/CleanPointsBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCleanSweep } from "@/hooks/useCleanSweep";
import type { CleaningAchievement, CleaningSession } from "@/lib/clean/types";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

type PageView = "dashboard" | "scanning" | "session" | "complete";

export default function CleanPage() {
  const {
    streak,
    streakLoading,
    session,
    sessionLoading,
    sessionError,
    recentSessions,
    recentLoading,
    startSession,
    completeTask,
    skipTask,
    requeueSkipped,
    endSession,
  } = useCleanSweep();

  const [view, setView] = useState<PageView>("dashboard");
  const [newAchievement, setNewAchievement] = useState<
    CleaningAchievement | null
  >(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleScanComplete = useCallback(
    async (base64Photo: string) => {
      setAnalyzing(true);
      const newSession = await startSession(base64Photo);
      setAnalyzing(false);
      if (newSession) {
        setView("session");
      } else {
        setView("scanning");
      }
    },
    [startSession],
  );

  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      await completeTask(taskId);
      const tasks = session?.tasks ?? [];
      const remaining = tasks.filter(
        t => t.id !== taskId && t.status === "PENDING",
      );
      if (remaining.length === 0) {
        await endSession();
        setView("complete");
      }
    },
    [completeTask, session, endSession],
  );

  const handleSkipTask = useCallback(
    async (taskId: string, reason?: string) => {
      await skipTask(taskId, reason);
      const tasks = session?.tasks ?? [];
      const remaining = tasks.filter(
        t => t.id !== taskId && t.status === "PENDING",
      );
      if (remaining.length === 0) {
        await endSession();
        setView("complete");
      }
    },
    [skipTask, session, endSession],
  );

  const handleRequeue = useCallback(async () => {
    await requeueSkipped();
  }, [requeueSkipped]);

  const isInitialLoading = streakLoading && !streak;

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Session complete view
  // -------------------------------------------------------------------------
  if (view === "complete" && session) {
    const completedCount = session.tasks.filter(t => t.status === "COMPLETED").length;
    const totalCount = session.tasks.length;

    return (
      <div className="space-y-6">
        {newAchievement && (
          <CleanCelebration
            achievement={newAchievement}
            onDismiss={() => setNewAchievement(null)}
          />
        )}

        <MotivationBanner context="session_complete" autoDismissMs={8000} />

        <Card variant="green">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-300" />
            <p className="text-2xl font-bold">Session Complete!</p>
            <p className="text-white/80">
              You completed {completedCount} of {totalCount} tasks
            </p>
            <CleanPointsBadge points={session.totalPoints} animated />
          </CardContent>
        </Card>

        <Button
          size="lg"
          className="w-full gap-2"
          onClick={() => setView("dashboard")}
        >
          <ArrowRight className="h-5 w-5" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Active session view
  // -------------------------------------------------------------------------
  if (view === "session" && session) {
    return (
      <div className="space-y-4">
        {sessionError && <p className="text-sm text-destructive text-center">{sessionError}</p>}
        {sessionLoading && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        <TaskBoard
          tasks={session.tasks}
          sessionId={session.id}
          loading={sessionLoading}
          onComplete={handleCompleteTask}
          onSkip={handleSkipTask}
          onRequeue={handleRequeue}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setView("dashboard")}
        >
          Pause Session
        </Button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Scanning view
  // -------------------------------------------------------------------------
  if (view === "scanning") {
    return (
      <div className="space-y-4">
        <RoomScanner
          onScanComplete={handleScanComplete}
          onCancel={() => setView("dashboard")}
          analyzing={analyzing}
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Dashboard (default) view
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {streak && (
        <StreakDisplay
          streak={{
            currentStreak: streak.currentStreak,
            bestStreak: streak.bestStreak,
            totalPoints: streak.totalPoints,
            level: streak.level,
            totalSessions: streak.totalSessions,
            ...(streak.lastSessionDate !== undefined
              ? { lastSessionDate: streak.lastSessionDate }
              : {}),
          }}
        />
      )}

      <MotivationBanner
        context={streak && streak.currentStreak === 0 ? "comeback" : "starting"}
        dismissable
      />

      <Link href="/clean/session" className="block group">
        <Button
          size="lg"
          className="w-full gap-2 text-lg h-16 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0 shadow-xl shadow-emerald-900/20 transition-all hover:scale-[1.01] active:scale-95 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Sparkles className="h-6 w-6 animate-pulse" />
          <span className="font-black tracking-tight">
            START CLEANING MISSION
          </span>
          <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
        </Button>
      </Link>

      {!recentLoading && recentSessions.length > 0 && (
        <RecentSessionsList sessions={recentSessions} />
      )}

      <nav className="flex gap-3">
        <Link
          href="/clean/achievements"
          className="flex-1 rounded-xl border border-white/10 p-4 text-center text-sm font-medium transition-colors hover:bg-white/5"
        >
          Achievements
        </Link>
        <Link
          href="/clean/settings"
          className="flex-1 rounded-xl border border-white/10 p-4 text-center text-sm font-medium transition-colors hover:bg-white/5"
        >
          Reminders
        </Link>
      </nav>
    </div>
  );
}

function RecentSessionsList({ sessions }: { sessions: CleaningSession[]; }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-6 pt-0">
        {sessions.map(s => (
          <div
            key={s.id}
            className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
          >
            <div>
              <p className="text-sm font-medium">{s.tasks.length} tasks</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(s.startedAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
            <span className="text-sm font-semibold text-green-400">
              +{s.totalPoints} pts
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
