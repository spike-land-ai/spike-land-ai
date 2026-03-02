"use client";

import type { CleaningSession, CleaningTask } from "@/lib/clean/types";
import { useCallback, useState } from "react";

interface UseCleanSessionReturn {
  session: CleaningSession | null;
  loading: boolean;
  error: string | null;
  startSession: (roomPhoto: string) => Promise<CleaningSession | null>;
  endSession: (sessionId: string) => Promise<CleaningSession | null>;
  getCurrentSession: () => Promise<CleaningSession | null>;
  completeTask: (
    sessionId: string,
    taskId: string,
    verificationPhoto?: string,
  ) => Promise<CleaningTask | null>;
  skipTask: (sessionId: string, taskId: string, reason?: string) => Promise<CleaningTask | null>;
  requeueSkipped: (sessionId: string) => Promise<CleaningSession | null>;
}

export function useCleanSession(): UseCleanSessionReturn {
  const [session, setSession] = useState<CleaningSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = useCallback(async <T>(url: string, options?: RequestInit): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({
          error: res.statusText,
        }));
        throw new Error((body as { error?: string }).error ?? "Request failed");
      }
      return (await res.json()) as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const startSession = useCallback(
    async (roomPhoto: string) => {
      const result = await apiCall<CleaningSession>("/api/clean/sessions", {
        method: "POST",
        body: JSON.stringify({ roomPhoto }),
      });
      if (result) setSession(result);
      return result;
    },
    [apiCall],
  );

  const endSession = useCallback(
    async (sessionId: string) => {
      const result = await apiCall<CleaningSession>(`/api/clean/sessions/${sessionId}/complete`, {
        method: "POST",
      });
      if (result) setSession(result);
      return result;
    },
    [apiCall],
  );

  const getCurrentSession = useCallback(async () => {
    const result = await apiCall<CleaningSession>("/api/clean/sessions/current");
    if (result) setSession(result);
    return result;
  }, [apiCall]);

  const completeTask = useCallback(
    async (sessionId: string, taskId: string, verificationPhoto?: string) => {
      const result = await apiCall<CleaningTask>(
        `/api/clean/sessions/${sessionId}/tasks/${taskId}/complete`,
        {
          method: "POST",
          body: JSON.stringify({ verificationPhoto }),
        },
      );
      if (result && session) {
        setSession({
          ...session,
          tasks: session.tasks.map((t) => (t.id === taskId ? result : t)),
        });
      }
      return result;
    },
    [apiCall, session],
  );

  const skipTask = useCallback(
    async (sessionId: string, taskId: string, reason?: string) => {
      const result = await apiCall<CleaningTask>(
        `/api/clean/sessions/${sessionId}/tasks/${taskId}/skip`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        },
      );
      if (result && session) {
        setSession({
          ...session,
          tasks: session.tasks.map((t) => (t.id === taskId ? result : t)),
        });
      }
      return result;
    },
    [apiCall, session],
  );

  const requeueSkipped = useCallback(
    async (sessionId: string) => {
      const result = await apiCall<CleaningSession>(`/api/clean/sessions/${sessionId}/requeue`, {
        method: "POST",
      });
      if (result) setSession(result);
      return result;
    },
    [apiCall],
  );

  return {
    session,
    loading,
    error,
    startSession,
    endSession,
    getCurrentSession,
    completeTask,
    skipTask,
    requeueSkipped,
  };
}
