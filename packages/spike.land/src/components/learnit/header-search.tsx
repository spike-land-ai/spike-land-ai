"use client";

import { Search, X } from "lucide-react";
import { useState } from "react";
import { LearnItSearch } from "./search";

export function HeaderSearch() {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isExpanded) {
    return (
      <div className="flex items-center gap-2 w-64" data-testid="header-search-expanded">
        <LearnItSearch compact />
        <button
          onClick={() => setIsExpanded(false)}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-all shrink-0"
          aria-label="Close search"
          data-testid="header-search-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsExpanded(true)}
      className="p-2 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-white/10 transition-all"
      aria-label="Search topics"
      data-testid="header-search-toggle"
    >
      <Search className="w-5 h-5" />
    </button>
  );
}
