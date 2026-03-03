"use client";

import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { slugify } from "@/lib/learnit/utils";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface LearnItSearchProps {
  compact?: boolean;
}

export function LearnItSearch({ compact }: LearnItSearchProps = {}) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const [results, setResults] = useState<
    { slug: string; title: string; description: string; }[]
  >(
    [],
  );
  const [isFocused, setIsFocused] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    async function search() {
      if (debouncedQuery.length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/learnit/search?q=${encodeURIComponent(debouncedQuery)}`,
        );
        const data = await res.json();
        setResults(data);
      } catch (e) {
        console.error(e);
      }
    }
    search();
  }, [debouncedQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const slug = slugify(query);
      router.push(`/learnit/${slug}`);
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <motion.div
        animate={isFocused
          ? {
            boxShadow: [
              "0 0 20px rgba(16,185,129,0.15)",
              "0 0 40px rgba(16,185,129,0.25)",
              "0 0 20px rgba(16,185,129,0.15)",
            ],
          }
          : { boxShadow: "0 0 0px rgba(16,185,129,0)" }}
        transition={isFocused
          ? { duration: 2, repeat: Infinity }
          : { duration: 0.3 }}
        className="rounded-2xl"
      >
        <form onSubmit={handleSubmit} className="relative">
          <Search
            className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none",
              compact ? "h-4 w-4" : "h-5 w-5",
            )}
          />
          <input
            data-testid="learnit-search-input"
            className={cn(
              "w-full rounded-2xl bg-zinc-900/50 backdrop-blur-xl text-white placeholder:text-zinc-500 border-2 border-transparent focus:border-emerald-400/50 focus:outline-none transition-colors",
              compact
                ? "pl-10 pr-16 py-2.5 text-sm"
                : "pl-12 pr-24 py-5 text-lg",
            )}
            placeholder={compact
              ? "Search topics..."
              : "What do you want to learn today?"}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          <Button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl"
          >
            Go
          </Button>
        </form>
      </motion.div>

      {/* Autocomplete Dropdown */}
      {results.length > 0 && isFocused && (
        <div className="absolute top-full left-0 right-0 mt-2 glass-2 border border-white/10 rounded-xl shadow-magic z-50 overflow-hidden">
          <div className="p-1">
            {results.map(result => (
              <Button
                key={result.slug}
                variant="ghost"
                className="w-full justify-start text-left h-auto py-2 px-3"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  router.push(`/learnit/${result.slug}`);
                  setQuery("");
                  setResults([]);
                  setIsFocused(false);
                }}
              >
                <div>
                  <div className="font-medium">{result.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.description}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
