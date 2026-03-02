"use client";

import { tryCatch } from "@/lib/try-catch";
import { useCallback, useState } from "react";

// Valid tier IDs for downgrade
type DowngradeTierId = "FREE" | "BASIC" | "STANDARD";

interface DowngradeResponse {
  success: boolean;
  effectiveDate?: string;
  message?: string;
  error?: string;
}

interface ScheduledDowngrade {
  targetTier: DowngradeTierId;
  effectiveDate: Date;
}

interface DowngradeResult {
  success: boolean;
  effectiveDate?: Date | undefined;
  message?: string | undefined;
  error?: string | undefined;
}

/**
 * Hook for handling tier downgrade scheduling
 */
export function useDowngrade() {
  const [isScheduling, setIsScheduling] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [scheduledDowngrade, setScheduledDowngrade] = useState<ScheduledDowngrade | null>(null);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Schedule a tier downgrade for the next billing cycle
   * @param targetTier - The tier to downgrade to (FREE, BASIC, or STANDARD)
   */
  const scheduleDowngrade = useCallback(
    async (targetTier: DowngradeTierId): Promise<DowngradeResult> => {
      setIsScheduling(true);
      setError(null);

      const { data: response, error: fetchError } = await tryCatch(
        fetch("/api/tiers/downgrade", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ targetTier }),
        }),
      );

      if (fetchError) {
        const err = fetchError instanceof Error ? fetchError : new Error("Network error");
        setError(err);
        setIsScheduling(false);
        return { success: false, error: err.message };
      }

      if (!response) {
        const err = new Error("No response from server");
        setError(err);
        setIsScheduling(false);
        return { success: false, error: err.message };
      }

      const { data, error: jsonError } = await tryCatch(
        response.json() as Promise<DowngradeResponse>,
      );

      if (jsonError) {
        const err = jsonError instanceof Error ? jsonError : new Error("Failed to parse response");
        setError(err);
        setIsScheduling(false);
        return { success: false, error: err.message };
      }

      if (!response.ok || !data.success) {
        const errorMessage = data.error || "Failed to schedule downgrade";
        setError(new Error(errorMessage));
        setIsScheduling(false);
        return { success: false, error: errorMessage };
      }

      const effectiveDate = data.effectiveDate ? new Date(data.effectiveDate) : undefined;

      if (effectiveDate) {
        setScheduledDowngrade({
          targetTier,
          effectiveDate,
        });
      }

      setIsScheduling(false);
      return {
        success: true,
        effectiveDate,
        message: data.message,
      };
    },
    [],
  );

  /**
   * Cancel a scheduled downgrade
   */
  const cancelDowngrade = useCallback(async (): Promise<DowngradeResult> => {
    setIsCanceling(true);
    setError(null);

    const { data: response, error: fetchError } = await tryCatch(
      fetch("/api/tiers/downgrade", {
        method: "DELETE",
      }),
    );

    if (fetchError) {
      const err = fetchError instanceof Error ? fetchError : new Error("Network error");
      setError(err);
      setIsCanceling(false);
      return { success: false, error: err.message };
    }

    if (!response) {
      const err = new Error("No response from server");
      setError(err);
      setIsCanceling(false);
      return { success: false, error: err.message };
    }

    const { data, error: jsonError } = await tryCatch(
      response.json() as Promise<DowngradeResponse>,
    );

    if (jsonError) {
      const err = jsonError instanceof Error ? jsonError : new Error("Failed to parse response");
      setError(err);
      setIsCanceling(false);
      return { success: false, error: err.message };
    }

    if (!response.ok || !data.success) {
      const errorMessage = data.error || "Failed to cancel downgrade";
      setError(new Error(errorMessage));
      setIsCanceling(false);
      return { success: false, error: errorMessage };
    }

    setScheduledDowngrade(null);
    setIsCanceling(false);
    return {
      success: true,
      message: data.message,
    };
  }, []);

  /**
   * Clear any scheduled downgrade from local state
   * (useful after successful upgrade)
   */
  const clearScheduledDowngrade = useCallback(() => {
    setScheduledDowngrade(null);
  }, []);

  return {
    isScheduling,
    isCanceling,
    scheduledDowngrade,
    error,
    scheduleDowngrade,
    cancelDowngrade,
    clearScheduledDowngrade,
  };
}
