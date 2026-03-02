"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface OccupationFiltersProps {
  query: string;
  onQueryChange: (query: string) => void;
}

export function OccupationFilters({ query, onQueryChange }: OccupationFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          placeholder="Search occupations..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-9 bg-zinc-800 border-white/[0.06]"
        />
      </div>
    </div>
  );
}
