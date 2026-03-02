"use client";

import { useQuery } from "@tanstack/react-query";
import { useCareerStore } from "@/lib/store/career";
import type { JobListing } from "@/lib/career/types";

async function fetchJobs(
  query: string,
  location?: string,
  countryCode?: string,
): Promise<JobListing[]> {
  if (!query) return [];

  const params = new URLSearchParams({ q: query });
  if (location) params.set("location", location);
  if (countryCode) params.set("country", countryCode);

  const response = await fetch(`/api/career/jobs?${params.toString()}`);
  if (!response.ok) return [];

  const data = (await response.json()) as { jobs: JobListing[] };
  return data.jobs;
}

export function useJobListings(occupationTitle: string) {
  const { location } = useCareerStore();

  const { data, isLoading } = useQuery({
    queryKey: ["job-listings", occupationTitle, location?.city],
    queryFn: () => fetchJobs(occupationTitle, location?.city, location?.countryCode?.toLowerCase()),
    enabled: !!occupationTitle,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  return {
    jobs: data ?? [],
    isLoading,
  };
}
