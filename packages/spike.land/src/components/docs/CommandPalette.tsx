"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { initSearch, search } from "@/lib/docs/search";
import type { DocsSearchEntry } from "@/lib/docs/types";
import { cn } from "@/lib/utils";
import { BookOpen, Code2, FileText, Terminal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const typeIconMap: Record<DocsSearchEntry["type"], React.ComponentType<{ className?: string }>> = {
  tool: Terminal,
  api: Code2,
  page: BookOpen,
  guide: FileText,
};

const typeColorMap: Record<DocsSearchEntry["type"], string> = {
  tool: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  api: "bg-green-500/20 text-green-400 border-green-500/30",
  page: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  guide: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const typeLabelMap: Record<DocsSearchEntry["type"], string> = {
  tool: "Tool",
  api: "API",
  page: "Page",
  guide: "Guide",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocsSearchEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchReady, setSearchReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Initialize search when dialog opens
  useEffect(() => {
    if (!open) return;

    initSearch()
      .then(() => setSearchReady(true))
      .catch(() => {
        // Search initialization failed; results will remain empty
      });
  }, [open]);

  // Run search when query changes
  useEffect(() => {
    if (!searchReady || !query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const searchResults = search(query, 20);
    setResults(searchResults);
    setSelectedIndex(0);
  }, [query, searchReady]);

  // Listen for keyboard shortcut and custom event
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    function handleCustomEvent() {
      setOpen(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleCustomEvent);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleCustomEvent);
    };
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  const navigateToResult = useCallback(
    (entry: DocsSearchEntry) => {
      setOpen(false);
      router.push(entry.href);
    },
    [router],
  );

  // Keyboard navigation within results
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        navigateToResult(results[selectedIndex]);
      }
    },
    [results, selectedIndex, navigateToResult],
  );

  // Scroll selected item into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const selected = resultsRef.current.querySelector("[data-selected=true]");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Group results by type
  const groupedResults = results.reduce<Record<string, DocsSearchEntry[]>>((acc, entry) => {
    const key = entry.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  const groupOrder: DocsSearchEntry["type"][] = ["tool", "api", "page", "guide"];
  let flatIndex = 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-2xl p-0 gap-0 bg-background/95 backdrop-blur-2xl border-white/10 shadow-2xl overflow-hidden [&>button[class*='absolute']]:hidden"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Search Documentation</DialogTitle>

        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-1 border-b border-white/5">
          <Terminal className="h-5 w-5 text-muted-foreground/60 shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, APIs, pages, guides..."
            className="h-12 border-none bg-transparent pl-2 pr-0 text-base rounded-l-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-7 items-center rounded-md border border-white/10 bg-white/5 px-2 font-mono text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto py-2">
          {query.trim() && results.length === 0 && searchReady && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground/60">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {query.trim() && !searchReady && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground/60">
              Loading search index...
            </div>
          )}

          {!query.trim() && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground/60">
              Type to search across all documentation
            </div>
          )}

          {groupOrder.map((type) => {
            const entries = groupedResults[type];
            if (!entries || entries.length === 0) return null;

            return (
              <div key={type} className="mb-1">
                <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">
                  {typeLabelMap[type]}s
                </div>
                {entries.map((entry) => {
                  const currentIndex = flatIndex;
                  flatIndex++;
                  const isSelected = currentIndex === selectedIndex;
                  const Icon = typeIconMap[entry.type];

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      data-selected={isSelected}
                      onClick={() => navigateToResult(entry)}
                      className={cn(
                        "flex items-start gap-3 w-full px-4 py-2.5 text-left transition-colors duration-100",
                        isSelected
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-white/5",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 mt-0.5 shrink-0",
                          isSelected ? "text-primary" : "opacity-50",
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{entry.title}</span>
                          <span
                            className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border uppercase tracking-wider shrink-0",
                              typeColorMap[entry.type],
                            )}
                          >
                            {typeLabelMap[entry.type]}
                          </span>
                        </div>
                        {entry.description && (
                          <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
                            {entry.description}
                          </p>
                        )}
                        {entry.category && (
                          <span className="text-[10px] text-muted-foreground/40 capitalize">
                            {entry.category.replace(/-/g, " ")}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] text-muted-foreground/50 mt-0.5 shrink-0">
                          Enter
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-[10px] text-muted-foreground/40">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-white/10 bg-white/5 px-1 font-mono">
                &uarr;&darr;
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-white/10 bg-white/5 px-1 font-mono">
                Enter
              </kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-white/10 bg-white/5 px-1 font-mono">
                Esc
              </kbd>
              close
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
