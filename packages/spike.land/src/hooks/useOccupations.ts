"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Occupation } from "@/lib/career/types";

async function fetchOccupations(
  query: string,
  offset: number,
  limit: number,
): Promise<Occupation[]> {
  if (!query || query.length < 2) return [];

  const response = await fetch(
    `/api/career/occupations?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
  );
  if (!response.ok) return [];

  const data = (await response.json()) as { occupations: Occupation[] };
  return data.occupations;
}

export function useOccupations(pageSize = 20) {
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [accumulated, setAccumulated] = useState<Occupation[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["occupations", query, offset],
    queryFn: () => fetchOccupations(query, offset, pageSize),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setOffset(0);
    setAccumulated([]);
  }, []);

  const occupations = useMemo(
    () => (offset === 0 ? (data ?? []) : [...accumulated, ...(data ?? [])]),
    [offset, data, accumulated],
  );

  const loadMore = useCallback(() => {
    setAccumulated(occupations);
    setOffset((prev) => prev + pageSize);
  }, [occupations, pageSize]);

  return {
    occupations,
    isLoading,
    query,
    setQuery: handleQueryChange,
    loadMore,
    hasMore: (data?.length ?? 0) >= pageSize,
  };
}
