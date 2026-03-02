"use client";

import { useQuery } from "@tanstack/react-query";
import type { MatchResult, UserSkill } from "@/lib/career/types";

async function fetchComparison(occupationUri: string, skills: UserSkill[]): Promise<MatchResult> {
  const response = await fetch("/api/career/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skills, occupationUri }),
  });
  if (!response.ok) throw new Error("Comparison failed");
  const data = (await response.json()) as { comparison: MatchResult };
  return data.comparison;
}

export function useSkillComparison(occupationUri: string, userSkills: UserSkill[]) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["skill-comparison", occupationUri, userSkills.map((s) => s.uri).join(",")],
    queryFn: () => fetchComparison(occupationUri, userSkills),
    enabled: !!occupationUri && userSkills.length > 0,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  return {
    comparison: data ?? null,
    isLoading,
    error,
  };
}
