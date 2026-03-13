import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../../styling/cn";
import { Button } from "../../shared/ui/button";

const MAX_CHARS = 2000;

const SUGGESTION_CHIPS = [
  "Add auth",
  "Add database",
  "Make it responsive",
  "Add dark mode",
  "Add animations",
  "Add charts",
  "Real-time updates",
  "Export as CSV",
] as const;

export interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = "Describe the app you want to build...",
  className,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-expand textarea height based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (value.trim() && !isLoading) {
          onSubmit();
        }
      }
    },
    [value, isLoading, onSubmit],
  );

  const handleChipClick = useCallback(
    (chip: string) => {
      const separator = value.trim() ? ". " : "";
      onChange(`${value.trim()}${separator}${chip}`);
      textareaRef.current?.focus();
    },
    [value, onChange],
  );

  const charsRemaining = MAX_CHARS - value.length;
  const isOverLimit = charsRemaining < 0;
  const isNearLimit = charsRemaining < 200 && charsRemaining >= 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className={cn(
          "relative rounded-2xl border bg-background transition-all duration-200",
          isFocused
            ? "border-primary/60 shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
            : "border-border shadow-sm hover:border-border/80",
          isOverLimit && "border-destructive/60",
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= MAX_CHARS) {
              onChange(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          rows={3}
          aria-label="App description"
          aria-describedby="prompt-hint"
          className={cn(
            "w-full resize-none rounded-2xl bg-transparent px-4 pb-12 pt-4 text-sm",
            "text-foreground placeholder:text-muted-foreground/60",
            "focus:outline-none",
            "min-h-[96px]",
          )}
        />

        {/* Bottom bar: char count + submit */}
        <div className="absolute bottom-3 left-4 right-3 flex items-center justify-between">
          <span
            id="prompt-hint"
            className={cn(
              "select-none text-xs",
              isOverLimit
                ? "text-destructive"
                : isNearLimit
                  ? "text-amber-500"
                  : "text-muted-foreground/50",
            )}
          >
            {isOverLimit ? `${Math.abs(charsRemaining)} over limit` : `${charsRemaining} left`}
          </span>

          <Button
            onClick={onSubmit}
            disabled={!value.trim() || isLoading || isOverLimit}
            size="sm"
            className="h-8 gap-1.5 px-4 text-xs"
            aria-label="Generate app (Cmd+Enter)"
          >
            {isLoading ? (
              <>
                <span
                  className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
                Generating...
              </>
            ) : (
              <>
                Generate
                <kbd
                  className="hidden rounded border border-current/30 px-1 py-0.5 font-mono text-[10px] opacity-60 sm:inline-block"
                  aria-hidden="true"
                >
                  ⌘↵
                </kbd>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Prompt suggestions">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => handleChipClick(chip)}
            className={cn(
              "rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium",
              "text-muted-foreground transition-colors duration-150",
              "hover:border-primary/40 hover:bg-primary/8 hover:text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
              "active:scale-95",
            )}
          >
            + {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
