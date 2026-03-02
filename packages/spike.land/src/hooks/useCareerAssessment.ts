"use client";

import { useCallback, useState } from "react";
import { useCareerStore } from "@/lib/store/career";
import type { MatchResult } from "@/lib/career/types";

export function useCareerAssessment() {
  const { userSkills, setAssessmentResults, location } = useCareerStore();
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assess = useCallback(async () => {
    if (userSkills.length === 0) return;

    setIsAssessing(true);
    setError(null);

    try {
      const response = await fetch("/api/career/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: userSkills }),
      });

      if (!response.ok) {
        throw new Error("Assessment failed");
      }

      const data = (await response.json()) as { results: MatchResult[] };
      setResults(data.results);
      setAssessmentResults({
        userSkills,
        matches: data.results,
        timestamp: Date.now(),
        location,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assessment failed");
    } finally {
      setIsAssessing(false);
    }
  }, [userSkills, location, setAssessmentResults]);

  return { assess, results, isAssessing, error };
}
