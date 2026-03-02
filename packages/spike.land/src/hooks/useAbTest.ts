"use client";

import { useEffect, useState } from "react";
import {
  fetchVariantAssignment,
  getVariantFromCookie,
  setVariantCookie,
} from "@/lib/ab-test/assignment";

interface UseAbTestReturn {
  variant: string | null;
  isLoading: boolean;
}

/**
 * Thin hook that wraps A/B test assignment utilities.
 * Returns { variant, isLoading }.
 */
export function useAbTest(testId: string, visitorId: string): UseAbTestReturn {
  const [variant, setVariant] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const existing = getVariantFromCookie();
    if (existing) {
      setVariant(existing);
      setIsLoading(false);
      return;
    }

    fetchVariantAssignment(testId, visitorId)
      .then((v) => {
        setVariant(v);
        setVariantCookie(v);
      })
      .catch(() => {
        setVariant("control");
      })
      .finally(() => setIsLoading(false));
  }, [testId, visitorId]);

  return { variant, isLoading };
}
