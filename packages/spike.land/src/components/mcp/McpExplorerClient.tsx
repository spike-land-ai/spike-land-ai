"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { McpExplorerHero } from "@/components/mcp/McpExplorerHero";
import { McpFeaturedTools } from "@/components/mcp/McpFeaturedTools";
import { McpCategoryGrid } from "@/components/mcp/McpCategoryGrid";
import { McpToolGrid } from "@/components/mcp/McpToolGrid";
import { McpToolModal } from "@/components/mcp/McpToolModal";
import { McpToolCard } from "@/components/mcp/McpToolCard";
import { McpIntegrationGuide } from "@/components/mcp/McpIntegrationGuide";
import { McpPlayground } from "@/components/mcp/McpPlayground";
import type { McpToolDef } from "@/components/mcp/mcp-tool-registry";
import { MCP_TOOLS } from "@/components/mcp/mcp-tool-registry";
import { useFavorites, useRecentTools } from "@/components/mcp/useMcpHistory";

const toolMap = new Map(MCP_TOOLS.map((t) => [t.name, t]));

export function McpExplorerClient() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<McpToolDef | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { recent } = useRecentTools();
  const { isFavorite, toggleFavorite } = useFavorites();

  const recentTools = useMemo(
    () =>
      recent
        .map((name) => toolMap.get(name))
        .filter((t): t is McpToolDef => t !== undefined)
        .slice(0, 6),
    [recent],
  );

  const handleTryIt = useCallback((tool: McpToolDef) => {
    setActiveTool(tool);
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveTool(null);
  }, []);

  const handleSearch = useCallback((q: string) => {
    setSearch(q);
    // Clear category filter when searching
    if (q) setSelectedCategory(null);
  }, []);

  const handleCategorySelect = useCallback((id: string | null) => {
    setSelectedCategory(id);
    // Clear search when filtering by category
    setSearch("");
  }, []);

  const handleToolSelectFromSearch = useCallback((tool: McpToolDef) => {
    setActiveTool(tool);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950">
      <McpExplorerHero
        onSearch={handleSearch}
        searchValue={search}
        onToolSelect={handleToolSelectFromSearch}
      />

      <McpFeaturedTools onTryIt={handleTryIt} />

      {/* Recently Used section */}
      {recentTools.length > 0 && (
        <section className="px-4 pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-black text-white">Recently Used</h2>
              <span className="text-zinc-600 text-sm">— pick up where you left off</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentTools.map((tool) => (
                <McpToolCard
                  key={tool.name}
                  tool={tool}
                  onTryIt={handleTryIt}
                  isFavorite={isFavorite(tool.name)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <McpCategoryGrid
        selectedCategory={selectedCategory}
        onCategorySelect={handleCategorySelect}
      />

      <McpToolGrid
        search={search}
        onSearch={handleSearch}
        selectedCategory={selectedCategory}
        onTryIt={handleTryIt}
      />

      <McpIntegrationGuide />

      {/* Advanced: terminal playground in collapsible */}
      <section className="border-t border-white/[0.05] px-4 pb-16">
        <div className="max-w-7xl mx-auto">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className="flex items-center gap-2 py-6 text-sm text-zinc-500 hover:text-zinc-300 transition-colors group w-full text-left"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
            <span>Advanced: Terminal Playground</span>
            <span className="text-zinc-700 text-xs ml-1">(for developers)</span>
          </button>

          {advancedOpen && (
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
              <McpPlayground />
            </div>
          )}
        </div>
      </section>

      <McpToolModal tool={activeTool} onClose={handleCloseModal} />
    </main>
  );
}
