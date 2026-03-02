"use client";

import { tryCatch } from "@/lib/try-catch";
import { useCallback, useEffect, useRef, useState } from "react";
import { ENHANCEMENT_COSTS } from "@/lib/credits/costs";

interface WorkspaceCreditsResponse {
  remaining: number;
  limit: number;
  used: number;
  tier: string;
  workspaceId: string;
}

export const LOW_CREDITS_THRESHOLD = 10;
export const CRITICAL_CREDITS_THRESHOLD = 5;

/**
 * Calculate estimated enhancements remaining based on credits and tier usage
 */
export function calculateEstimatedEnhancements(
  credits: number,
  averageTier: "TIER_1K" | "TIER_2K" | "TIER_4K" = "TIER_1K",
): {
  tier1K: number;
  tier2K: number;
  tier4K: number;
  suggested: number;
  suggestedTier: string;
} {
  const tier1K = Math.floor(credits / ENHANCEMENT_COSTS.TIER_1K);
  const tier2K = Math.floor(credits / ENHANCEMENT_COSTS.TIER_2K);
  const tier4K = Math.floor(credits / ENHANCEMENT_COSTS.TIER_4K);

  const suggestedMap = {
    TIER_1K: { count: tier1K, label: "1K" },
    TIER_2K: { count: tier2K, label: "2K" },
    TIER_4K: { count: tier4K, label: "4K" },
  };

  const suggested = suggestedMap[averageTier];

  return {
    tier1K,
    tier2K,
    tier4K,
    suggested: suggested.count,
    suggestedTier: suggested.label,
  };
}

// Minimum time between focus-triggered refreshes (5 seconds)
const FOCUS_DEBOUNCE_MS = 5000;

export function useWorkspaceCredits(options?: { autoRefreshOnFocus?: boolean }) {
  const [remaining, setRemaining] = useState<number>(0);
  const [limit, setLimit] = useState<number>(0);
  const [used, setUsed] = useState<number>(0);
  const [tier, setTier] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const lastFetchTimeRef = useRef<number>(0);

  const fetchCredits = useCallback(async () => {
    setIsLoading(true);

    const { data: response, error: fetchError } = await tryCatch(fetch("/api/credits/balance"));

    if (fetchError) {
      setError(fetchError instanceof Error ? fetchError : new Error("Unknown error"));
      setIsLoading(false);
      return;
    }

    if (!response) {
      setError(new Error("No response from server"));
      setIsLoading(false);
      return;
    }

    if (!response.ok) {
      setError(new Error("Failed to fetch workspace credits"));
      setIsLoading(false);
      return;
    }

    const { data, error: jsonError } = await tryCatch(
      response.json() as Promise<WorkspaceCreditsResponse>,
    );

    if (jsonError) {
      setError(jsonError instanceof Error ? jsonError : new Error("Unknown error"));
      setIsLoading(false);
      return;
    }

    setRemaining(data.remaining);
    setLimit(data.limit);
    setUsed(data.used);
    setTier(data.tier ?? null);
    setWorkspaceId(data.workspaceId ?? null);
    setError(null);
    setHasFetched(true);
    lastFetchTimeRef.current = Date.now();
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Auto-refresh on window focus with debouncing
  useEffect(() => {
    if (!options?.autoRefreshOnFocus) return;

    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFetchTimeRef.current >= FOCUS_DEBOUNCE_MS) {
        fetchCredits();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [options?.autoRefreshOnFocus, fetchCredits]);

  // Compute if balance is low or critical
  const isLowCredits = remaining < LOW_CREDITS_THRESHOLD;
  const isCriticalCredits = remaining < CRITICAL_CREDITS_THRESHOLD;

  // Calculate estimated enhancements
  const estimatedEnhancements = calculateEstimatedEnhancements(remaining);

  // Calculate usage percentage
  const usagePercent = limit > 0 ? Math.round((used / limit) * 100) : 0;

  return {
    remaining,
    limit,
    used,
    tier,
    workspaceId,
    isLoading,
    hasFetched,
    error,
    isLowCredits,
    isCriticalCredits,
    usagePercent,
    estimatedEnhancements,
    refetch: fetchCredits,
  };
}
