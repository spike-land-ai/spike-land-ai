"use client";

import { useQuery } from "@tanstack/react-query";
import type { EscoSkill } from "@/lib/career/types";

async function searchSkills(query: string): Promise<EscoSkill[]> {
  if (query.length < 2) return [];

  const response = await fetch(`/api/career/occupations?q=${encodeURIComponent(query)}&limit=10`);
  if (!response.ok) return [];

  const data = (await response.json()) as {
    occupations: Array<{ uri: string; title: string; description: string }>;
  };
  return data.occupations.map((o) => ({
    uri: o.uri,
    title: o.title,
    description: o.description,
    skillType: "skill" as const,
  }));
}

export function useSkillAutocomplete(query: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["skill-autocomplete", query],
    queryFn: () => searchSkills(query),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  return {
    suggestions: data ?? [],
    isLoading,
  };
}
