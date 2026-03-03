"use client";

import { Button } from "@/components/ui/button";
import { useAutoResizeTextarea } from "@/hooks/useAutoResizeTextarea";
import { useComposerImages } from "@/hooks/useComposerImages";
import { useDebounce } from "@/hooks/use-debounce";
import { motion } from "framer-motion";
import { Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ComposerGlow } from "./composer-glow";
import { ComposerImageStrip } from "./composer-image-strip";
import { ComposerSkills } from "./composer-skills";
import { ComposerTypingDemo } from "./composer-typing-demo";

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-/]/g, "");
}

export interface ComposerBoxProps {
  initialPrompt?: string;
}

export function ComposerBox({ initialPrompt }: ComposerBoxProps) {
  const [query, setQuery] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState<
    { type: "blocked" | "unclear"; message: string; } | null
  >(null);
  const [results, setResults] = useState<
    { slug: string; title: string; description: string; }[]
  >([]);
  const [isFocused, setIsFocused] = useState(false);

  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { textareaRef, resize } = useAutoResizeTextarea();

  const {
    images,
    addImages,
    removeImage,
    dragHandlers,
    isDragging,
    uploadedUrls,
  } = useComposerImages();

  const debouncedQuery = useDebounce(query, 300);

  // Fill textarea from template selection
  useEffect(() => {
    if (initialPrompt) {
      setQuery(initialPrompt);
      textareaRef.current?.focus();
    }
  }, [initialPrompt, textareaRef]);

  // Auto-resize on content change
  useEffect(() => {
    resize();
  }, [query, resize]);

  // Global Cmd+K / Ctrl+K shortcut to focus textarea
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [textareaRef]);

  // Fetch search results with abort controller
  useEffect(() => {
    const controller = new AbortController();

    async function search() {
      if (debouncedQuery.length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/create/search?q=${encodeURIComponent(debouncedQuery)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        setResults(data);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error(e);
        }
      }
    }
    search();
    return () => controller.abort();
  }, [debouncedQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    if (results.length === 0) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current
        && !containerRef.current.contains(event.target as Node)
      ) {
        setResults([]);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [results.length]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isClassifying) return;

    setIsClassifying(true);
    setClassifyError(null);
    setResults([]);

    try {
      const res = await fetch("/api/create/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: query.trim(),
          ...(uploadedUrls.length > 0 && { imageUrls: uploadedUrls }),
        }),
      });

      if (!res.ok) {
        router.push(`/create/${slugify(query)}`);
        return;
      }

      const data = await res.json();

      if (data.status === "ok" && data.slug) {
        router.push(`/create/${data.slug}`);
      } else if (data.status === "blocked") {
        setClassifyError({
          type: "blocked",
          message: data.reason || "This topic is not allowed.",
        });
      } else if (data.status === "unclear") {
        setClassifyError({
          type: "unclear",
          message: data.reason || "Try describing what the app should do.",
        });
      } else {
        router.push(`/create/${slugify(query)}`);
      }
    } catch {
      router.push(`/create/${slugify(query)}`);
    } finally {
      setIsClassifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setQuery("");
      textareaRef.current?.blur();
    }
  };

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addImages(e.target.files);
        e.target.value = "";
      }
    },
    [addImages],
  );

  const showTypewriter = !isFocused && query.length === 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      <ComposerGlow isFocused={isFocused || isDragging}>
        <form
          onSubmit={handleSubmit}
          className="relative"
          {...dragHandlers}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-cyan-400/50 bg-cyan-400/5 z-20 flex items-center justify-center pointer-events-none">
              <span className="text-cyan-400 text-sm font-medium">
                Drop images here
              </span>
            </div>
          )}

          {/* Image thumbnail strip */}
          <ComposerImageStrip
            images={images}
            onRemove={removeImage}
            onAddClick={handleAttachClick}
            maxImages={4}
          />

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Auto-resize textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              data-testid="composer-textarea"
              aria-label="Describe the app you want to create"
              className="w-full rounded-xl glass-input px-5 py-4 text-base text-white/90 placeholder:text-zinc-500 focus:outline-none resize-none min-h-[96px] max-h-[224px] bg-transparent tracking-wide leading-relaxed"
              rows={3}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                if (classifyError) setClassifyError(null);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={showTypewriter
                ? ""
                : "Describe the app you want to create..."}
            />

            {/* Typewriter animation when empty & unfocused */}
            <ComposerTypingDemo isActive={showTypewriter} />
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.07]">
            {/* Left: Attach image */}
            <button
              type="button"
              onClick={handleAttachClick}
              className="p-2 rounded-lg text-zinc-400 hover:text-cyan-400 hover:bg-white/10 hover:shadow-[0_0_8px_rgba(34,211,238,0.2)] transition-all"
              aria-label="Attach image"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {/* Center: Matched skills */}
            <ComposerSkills query={debouncedQuery} />

            {/* Right: Keyboard hint + Create button */}
            <div className="flex items-center gap-2">
              <kbd className="hidden sm:inline-block text-xs text-zinc-500 bg-white/5 border border-white/[0.06] px-2 py-1 rounded font-mono">
                {"\u2318"}Enter
              </kbd>
              <Button
                type="submit"
                data-testid="composer-submit"
                size="sm"
                loading={isClassifying}
                disabled={!query.trim()}
              >
                Create
              </Button>
            </div>
          </div>
        </form>
      </ComposerGlow>

      {/* Error display */}
      {classifyError && (
        <p
          className={cn(
            "mt-2 text-sm",
            classifyError.type === "blocked"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {classifyError.message}
        </p>
      )}

      {/* Search results dropdown */}
      {results.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-magic z-50 overflow-hidden"
        >
          <div className="p-1">
            {results.map(result => (
              <Button
                key={result.slug}
                variant="ghost"
                className="w-full justify-start text-left h-auto py-2 px-3"
                onClick={() => {
                  setResults([]);
                  router.push(`/create/${result.slug}`);
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
        </motion.div>
      )}
    </div>
  );
}
