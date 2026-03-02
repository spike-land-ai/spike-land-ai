"use client";

import { useQuery } from "@tanstack/react-query";
import type { Occupation, SalaryData } from "@/lib/career/types";

async function fetchOccupation(uri: string): Promise<Occupation | null> {
  const response = await fetch(`/api/career/occupations/${encodeURIComponent(uri)}`);
  if (!response.ok) return null;
  const data = (await response.json()) as { occupation: Occupation };
  return data.occupation;
}

async function fetchSalary(_title: string): Promise<SalaryData | null> {
  // Salary endpoint would be separate - return null for now
  return null;
}

export function useOccupationDetail(uri: string) {
  const occQuery = useQuery({
    queryKey: ["occupation-detail", uri],
    queryFn: () => fetchOccupation(uri),
    enabled: !!uri,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const salaryQuery = useQuery({
    queryKey: ["occupation-salary", occQuery.data?.title],
    queryFn: () => fetchSalary(occQuery.data?.title ?? ""),
    enabled: !!occQuery.data?.title,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  return {
    occupation: occQuery.data ?? null,
    salary: salaryQuery.data ?? null,
    isLoading: occQuery.isLoading,
    error: occQuery.error,
  };
}
