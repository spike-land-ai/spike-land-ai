"use client";

import { OccupationCard } from "./OccupationCard";
import { OccupationFilters } from "./OccupationFilters";
import { useOccupations } from "@/hooks/useOccupations";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function OccupationGrid() {
  const { occupations, isLoading, query, setQuery, loadMore, hasMore } = useOccupations();

  return (
    <div className="space-y-6">
      <OccupationFilters query={query} onQueryChange={setQuery} />

      {isLoading && occupations.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 bg-zinc-800" />
          ))}
        </div>
      )}

      {!isLoading && occupations.length === 0 && query && (
        <div className="text-center py-12 text-zinc-500">
          No occupations found for &quot;{query}&quot;. Try a different search term.
        </div>
      )}

      {!isLoading && occupations.length === 0 && !query && (
        <div className="text-center py-12 text-zinc-500">
          Start typing to search for occupations.
        </div>
      )}

      {occupations.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {occupations.map((occupation) => (
              <OccupationCard key={occupation.uri} occupation={occupation} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={loadMore} disabled={isLoading}>
                {isLoading ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
