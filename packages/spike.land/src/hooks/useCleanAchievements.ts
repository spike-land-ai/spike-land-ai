"use client";

import type { CleaningAchievement } from "@/lib/clean/types";
import { useCallback, useEffect, useState } from "react";

interface UseCleanAchievementsReturn {
  achievements: CleaningAchievement[];
  loading: boolean;
  error: string | null;
  fetchAchievements: () => Promise<void>;
}

export function useCleanAchievements(): UseCleanAchievementsReturn {
  const [achievements, setAchievements] = useState<CleaningAchievement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAchievements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clean/achievements");
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((body as { error?: string }).error ?? "Failed to fetch achievements");
      }
      const data = (await res.json()) as CleaningAchievement[];
      setAchievements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAchievements();
  }, [fetchAchievements]);

  return { achievements, loading, error, fetchAchievements };
}
