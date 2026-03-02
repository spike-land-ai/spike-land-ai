"use client";

import { useMemo, useState } from "react";
import { Clock, Heart, Search } from "lucide-react";
import Fuse from "fuse.js";
import { McpToolCard } from "@/components/mcp/McpToolCard";
import type { McpToolDef } from "@/components/mcp/mcp-tool-registry";
import { MCP_SUPER_CATEGORIES, MCP_TOOLS } from "@/components/mcp/mcp-tool-registry";
import { useFavorites, useRecentTools } from "@/components/mcp/useMcpHistory";

interface McpToolGridProps {
  search: string;
  onSearch: (q: string) => void;
  selectedCategory: string | null;
  onTryIt: (tool: McpToolDef) => void;
}

const ALL_TABS = [
  { id: null, label: "All" },
  ...MCP_SUPER_CATEGORIES.map((s) => ({ id: s.id, label: s.name })),
];

const TIER_OPTIONS = [
  { id: "all", label: "All Tiers" },
  { id: "free", label: "Free" },
  { id: "workspace", label: "Pro" },
] as const;

type ViewFilter = "all" | "favorites" | "recent";

const fuse = new Fuse(MCP_TOOLS, {
  keys: [
    { name: "name", weight: 0.3 },
    { name: "displayName", weight: 0.3 },
    { name: "description", weight: 0.2 },
    { name: "keywords", weight: 0.2 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
});

const toolMap = new Map(MCP_TOOLS.map((t) => [t.name, t]));

export function McpToolGrid({ search, onSearch, selectedCategory, onTryIt }: McpToolGridProps) {
  const [activeSuper, setActiveSuper] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<"all" | "free" | "workspace">("all");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [visibleCount, setVisibleCount] = useState(18);

  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const { recent } = useRecentTools();

  // Reset pagination when search or filters change
  const handleSearch = (q: string) => {
    setVisibleCount(18);
    onSearch(q);
  };

  const handleSetViewFilter = (f: ViewFilter) => {
    setVisibleCount(18);
    setViewFilter(f);
  };

  const handleSetTierFilter = (t: "all" | "free" | "workspace") => {
    setVisibleCount(18);
    setTierFilter(t);
  };

  const handleSetActiveSuper = (s: string | null) => {
    setVisibleCount(18);
    setActiveSuper(s);
  };

  // When parent sets a category, use it as default active super
  const effectiveSuper = selectedCategory ?? activeSuper;

  // Build set of category IDs for active super category
  const superCategoryIds = useMemo(() => {
    if (!effectiveSuper) return null;
    const sup = MCP_SUPER_CATEGORIES.find((s) => s.id === effectiveSuper);
    if (!sup) return null;
    const ids = new Set<string>();
    for (const sub of sup.subcategories) {
      for (const cat of sub.categories) {
        ids.add(cat.id);
      }
    }
    return ids;
  }, [effectiveSuper]);

  const filteredTools = useMemo(() => {
    const q = search.toLowerCase().trim();

    // Get base set depending on view filter
    let baseTools: McpToolDef[];
    if (viewFilter === "favorites") {
      baseTools = favorites
        .map((name) => toolMap.get(name))
        .filter((t): t is McpToolDef => t !== undefined);
    } else if (viewFilter === "recent") {
      baseTools = recent
        .map((name) => toolMap.get(name))
        .filter((t): t is McpToolDef => t !== undefined);
    } else {
      baseTools = MCP_TOOLS;
    }

    // Apply fuzzy search if query present
    let searched: McpToolDef[];
    if (q && q.length >= 2 && viewFilter === "all") {
      const results = fuse.search(q);
      searched = results.map((r) => r.item);
    } else if (q) {
      // Simple filter for favorites/recent views
      searched = baseTools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(q) ||
          tool.displayName.toLowerCase().includes(q) ||
          tool.description.toLowerCase().includes(q) ||
          tool.category.toLowerCase().includes(q),
      );
    } else {
      searched = baseTools;
    }

    // Apply super category and tier filters
    return searched.filter((tool) => {
      if (superCategoryIds && !superCategoryIds.has(tool.category)) {
        return false;
      }
      if (tierFilter !== "all" && tool.tier !== tierFilter) return false;
      return true;
    });
  }, [search, superCategoryIds, tierFilter, viewFilter, favorites, recent]);

  return (
    <section className="px-4 pb-16">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-black text-white">
            {filteredTools.length} Tool{filteredTools.length !== 1 ? "s" : ""}
            {effectiveSuper && (
              <span className="text-zinc-500 font-normal text-base ml-2">
                in {MCP_SUPER_CATEGORIES.find((s) => s.id === effectiveSuper)?.name}
              </span>
            )}
          </h2>

          <div className="flex items-center gap-3 flex-wrap">
            {/* View filter: All / Favorites / Recent */}
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
              <button
                type="button"
                onClick={() => handleSetViewFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewFilter === "all"
                    ? "bg-white/[0.08] text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => handleSetViewFilter("favorites")}
                aria-label="Show favorites"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                  viewFilter === "favorites"
                    ? "bg-pink-500/20 text-pink-400"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Heart className="w-3 h-3" />
                Favorites
                {favorites.length > 0 && (
                  <span className="text-[10px] opacity-60">({favorites.length})</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSetViewFilter("recent")}
                aria-label="Show recent tools"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                  viewFilter === "recent"
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Clock className="w-3 h-3" />
                Recent
              </button>
            </div>

            {/* Tier filter */}
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
              {TIER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSetTierFilter(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tierFilter === opt.id
                      ? "bg-white/[0.08] text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category tabs */}
        <div className="relative">
          <div
            className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none scroll-smooth"
            role="tablist"
            aria-label="Tool categories"
          >
            {ALL_TABS.map((tab) => (
              <button
                key={String(tab.id)}
                type="button"
                role="tab"
                aria-selected={effectiveSuper === tab.id}
                onClick={() => handleSetActiveSuper(tab.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                  effectiveSuper === tab.id
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    : "bg-white/[0.03] border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Scroll fade indicators for mobile */}
          <div className="pointer-events-none absolute top-0 right-0 bottom-2 w-8 bg-gradient-to-l from-zinc-950 to-transparent sm:hidden" />
        </div>

        {/* Search bar (synced with hero) */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Filter tools..."
            aria-label="Filter tools"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20 transition-all text-sm"
          />
        </div>

        {/* Grid */}
        {filteredTools.length === 0 ? (
          <div className="text-center py-20 text-zinc-600">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No tools found</p>
            <p className="text-sm mt-1">
              {viewFilter === "favorites"
                ? "Star some tools to add them to favorites"
                : viewFilter === "recent"
                  ? "Try some tools to build your history"
                  : "Try a different search term or category"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTools.slice(0, visibleCount).map((tool) => (
              <McpToolCard
                key={tool.name}
                tool={tool}
                onTryIt={onTryIt}
                isFavorite={isFavorite(tool.name)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {filteredTools.length > visibleCount && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((v) => v + 18)}
              className="px-6 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all text-sm font-medium"
            >
              Load More Tools ({filteredTools.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
