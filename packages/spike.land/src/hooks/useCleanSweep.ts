"use client";

/**
 * useCleanSweep — Unified hook for the CleanSweep dashboard.
 *
 * Composes useCleanStreaks, useCleanSession, and useCleanAchievements
 * into a single entry point so the main page only needs one hook.
 */

import type { CleaningAchievement, CleaningSession, CleaningStreak } from "@/lib/clean/types";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseCleanSweepReturn {
  // Streak data
  streak: CleaningStreak | null;
  streakLoading: boolean;
  streakError: string | null;
  refreshStreak: () => Promise<void>;

  // Session data
  session: CleaningSession | null;
  sessionLoading: boolean;
  sessionError: string | null;
  startSession: (roomPhotoBase64: string) => Promise<CleaningSession | null>;
  completeTask: (taskId: string, verificationPhoto?: string) => Promise<void>;
  skipTask: (taskId: string, reason?: string) => Promise<void>;
  requeueSkipped: () => Promise<void>;
  endSession: () => Promise<void>;

  // Recent sessions for dashboard history
  recentSessions: CleaningSession[];
  recentLoading: boolean;

  // Achievements
  achievements: CleaningAchievement[];
  achievementsLoading: boolean;

  // Combined loading / error state
  loading: boolean;
  error: string | null;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function useCleanSweep(): UseCleanSweepReturn {
  const [streak, setStreak] = useState<CleaningStreak | null>(null);
  const [streakLoading, setStreakLoading] = useState(false);
  const [streakError, setStreakError] = useState<string | null>(null);

  const [session, setSession] = useState<CleaningSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [recentSessions, setRecentSessions] = useState<CleaningSession[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const [achievements, setAchievements] = useState<CleaningAchievement[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);

  // Track ongoing operations to prevent duplicate concurrent calls
  const fetchingStreak = useRef(false);
  const fetchingRecent = useRef(false);
  const fetchingAchievements = useRef(false);

  const refreshStreak = useCallback(async () => {
    if (fetchingStreak.current) return;
    fetchingStreak.current = true;
    setStreakLoading(true);
    setStreakError(null);
    try {
      const data = await fetchJson<CleaningStreak>("/api/clean/streaks");
      setStreak(data);
    } catch (err) {
      setStreakError(err instanceof Error ? err.message : "Failed to load streak");
    } finally {
      setStreakLoading(false);
      fetchingStreak.current = false;
    }
  }, []);

  const fetchRecentSessions = useCallback(async () => {
    if (fetchingRecent.current) return;
    fetchingRecent.current = true;
    setRecentLoading(true);
    try {
      const data = await fetchJson<CleaningSession[]>("/api/clean/sessions?limit=5");
      setRecentSessions(data);
    } catch {
      // non-critical, silently ignore
    } finally {
      setRecentLoading(false);
      fetchingRecent.current = false;
    }
  }, []);

  const fetchAchievements = useCallback(async () => {
    if (fetchingAchievements.current) return;
    fetchingAchievements.current = true;
    setAchievementsLoading(true);
    try {
      const data = await fetchJson<CleaningAchievement[]>("/api/clean/achievements");
      setAchievements(data);
    } catch {
      // non-critical
    } finally {
      setAchievementsLoading(false);
      fetchingAchievements.current = false;
    }
  }, []);

  // Initial data load
  useEffect(() => {
    void refreshStreak();
    void fetchRecentSessions();
    void fetchAchievements();
  }, [refreshStreak, fetchRecentSessions, fetchAchievements]);

  const startSession = useCallback(
    async (roomPhotoBase64: string): Promise<CleaningSession | null> => {
      setSessionLoading(true);
      setSessionError(null);
      try {
        const newSession = await fetchJson<CleaningSession>("/api/clean/sessions", {
          method: "POST",
          body: JSON.stringify({ roomPhoto: roomPhotoBase64 }),
        });
        setSession(newSession);
        return newSession;
      } catch (err) {
        setSessionError(err instanceof Error ? err.message : "Failed to start session");
        return null;
      } finally {
        setSessionLoading(false);
      }
    },
    [],
  );

  const completeTask = useCallback(
    async (taskId: string, verificationPhoto?: string) => {
      if (!session) return;
      setSessionLoading(true);
      setSessionError(null);
      try {
        const updatedTask = await fetchJson<CleaningSession["tasks"][number]>(
          `/api/clean/sessions/${session.id}/tasks/${taskId}/complete`,
          {
            method: "POST",
            body: JSON.stringify({ verificationPhoto }),
          },
        );
        setSession((prev) =>
          prev
            ? {
                ...prev,
                tasks: prev.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
              }
            : prev,
        );
      } catch (err) {
        setSessionError(err instanceof Error ? err.message : "Failed to complete task");
      } finally {
        setSessionLoading(false);
      }
    },
    [session],
  );

  const skipTask = useCallback(
    async (taskId: string, reason?: string) => {
      if (!session) return;
      setSessionLoading(true);
      setSessionError(null);
      try {
        const updatedTask = await fetchJson<CleaningSession["tasks"][number]>(
          `/api/clean/sessions/${session.id}/tasks/${taskId}/skip`,
          {
            method: "POST",
            body: JSON.stringify({ reason }),
          },
        );
        setSession((prev) =>
          prev
            ? {
                ...prev,
                tasks: prev.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
              }
            : prev,
        );
      } catch (err) {
        setSessionError(err instanceof Error ? err.message : "Failed to skip task");
      } finally {
        setSessionLoading(false);
      }
    },
    [session],
  );

  const requeueSkipped = useCallback(async () => {
    if (!session) return;
    setSessionLoading(true);
    try {
      const updatedSession = await fetchJson<CleaningSession>(
        `/api/clean/sessions/${session.id}/requeue`,
        { method: "POST" },
      );
      setSession(updatedSession);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : "Failed to requeue tasks");
    } finally {
      setSessionLoading(false);
    }
  }, [session]);

  const endSession = useCallback(async () => {
    if (!session) return;
    setSessionLoading(true);
    setSessionError(null);
    try {
      const completed = await fetchJson<CleaningSession>(
        `/api/clean/sessions/${session.id}/complete`,
        { method: "POST" },
      );
      setSession(completed);
      // Refresh streak and achievements after session ends
      await Promise.all([refreshStreak(), fetchRecentSessions(), fetchAchievements()]);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : "Failed to end session");
    } finally {
      setSessionLoading(false);
    }
  }, [session, refreshStreak, fetchRecentSessions, fetchAchievements]);

  const loading = streakLoading || sessionLoading || recentLoading;
  const error = streakError ?? sessionError;

  return {
    streak,
    streakLoading,
    streakError,
    refreshStreak,

    session,
    sessionLoading,
    sessionError,
    startSession,
    completeTask,
    skipTask,
    requeueSkipped,
    endSession,

    recentSessions,
    recentLoading,

    achievements,
    achievementsLoading,

    loading,
    error,
  };
}
