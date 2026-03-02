"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { MCP_TOOLS, SUPER_CATEGORY_COUNT } from "@/components/mcp/mcp-tool-registry";
import { STORE_APPS } from "@/app/store/data/store-apps";
import type { McpToolDef } from "@/components/mcp/mcp-tool-registry";

interface McpExplorerHeroProps {
  onSearch: (query: string) => void;
  searchValue: string;
  onToolSelect?: (tool: McpToolDef) => void;
}

const stats = [
  { value: String(STORE_APPS.length), label: "Apps" },
  { value: String(SUPER_CATEGORY_COUNT), label: "Categories" },
  { value: "MCP", label: "Protocol" },
  { value: "Free", label: "Access" },
];

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

export function McpExplorerHero({ onSearch, searchValue, onToolSelect }: McpExplorerHeroProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Global "/" shortcut to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        !(document.activeElement as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const suggestions = useMemo(() => {
    if (!searchValue.trim() || searchValue.trim().length < 2) return [];
    return fuse.search(searchValue.trim()).slice(0, 8);
  }, [searchValue]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearch(e.target.value);
      setShowSuggestions(true);
      setHighlightedIdx(-1);
    },
    [onSearch],
  );

  const handleSuggestionClick = useCallback(
    (tool: McpToolDef) => {
      setShowSuggestions(false);
      onToolSelect?.(tool);
    },
    [onToolSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      } else if (e.key === "Enter" && highlightedIdx >= 0) {
        e.preventDefault();
        const selected = suggestions[highlightedIdx];
        if (selected) handleSuggestionClick(selected.item);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    },
    [showSuggestions, suggestions, highlightedIdx, handleSuggestionClick],
  );

  return (
    <section className="relative pt-24 pb-16 px-4 text-center overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full bg-cyan-500/[0.06] blur-[120px] top-[-100px] left-1/2 -translate-x-1/2" />
      </div>

      <div className="relative max-w-3xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-cyan-400 mb-6 backdrop-blur-xl">
          <span className="font-semibold uppercase tracking-wider">MCP Explorer</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter text-white mb-4 leading-none">
          Every App,
          <br />
          <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            One API
          </span>
        </h1>

        <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto">
          Search, explore, and try every app live — no setup required.
        </p>

        {/* Search Input with Suggestions */}
        <div className="relative max-w-xl mx-auto mb-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={searchValue}
            onChange={handleInputChange}
            onFocus={() => searchValue.trim().length >= 2 && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search tools... e.g. generate image, chess, analytics"
            aria-label="Search MCP tools"
            aria-expanded={showSuggestions && suggestions.length > 0}
            aria-controls="search-suggestions"
            aria-activedescendant={highlightedIdx >= 0 ? `suggestion-${highlightedIdx}` : undefined}
            role="combobox"
            aria-autocomplete="list"
            className="w-full pl-12 pr-16 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.06] transition-all text-base focus:ring-2 focus:ring-cyan-500/20"
          />
          <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] text-zinc-500 font-mono">
            /
          </kbd>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              id="search-suggestions"
              role="listbox"
              className="absolute left-0 right-0 top-full mt-2 rounded-xl bg-zinc-900 border border-white/[0.08] shadow-2xl overflow-hidden z-50"
            >
              {suggestions.map((result, idx) => (
                <button
                  key={result.item.name}
                  id={`suggestion-${idx}`}
                  role="option"
                  type="button"
                  aria-selected={idx === highlightedIdx}
                  onClick={() => handleSuggestionClick(result.item)}
                  onMouseEnter={() => setHighlightedIdx(idx)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                    idx === highlightedIdx
                      ? "bg-cyan-500/10 text-white"
                      : "text-zinc-300 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm truncate">{result.item.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{result.item.description}</p>
                  </div>
                  <span className="text-[10px] text-zinc-600 shrink-0">{result.item.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats pills */}
        <div className="flex flex-wrap justify-center gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] text-sm"
            >
              <span className="font-black text-white">{stat.value}</span>
              <span className="text-zinc-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
