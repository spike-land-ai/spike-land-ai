/**
 * ErrorOverlay — shows compilation errors in the preview pane.
 *
 * Features:
 * - Displays error message with optional line/column info
 * - Clickable "Go to line" button that calls onGoToLine(line, column)
 * - Dismiss button to hide the overlay
 * - Accessible: role="alert", focusable dismiss button
 *
 * Usage:
 *   <ErrorOverlay
 *     error={{ message: "Unexpected token", line: 12, column: 4 }}
 *     onDismiss={() => clearError()}
 *     onGoToLine={(line, col) => editor.revealLine(line)}
 *   />
 */

import { useEffect, useRef } from "react";
import { AlertTriangle, X, ArrowRight } from "lucide-react";
import { cn } from "../../../styling/cn";

export interface ErrorInfo {
  message: string;
  /** 1-based line number */
  line?: number;
  /** 1-based column number */
  column?: number;
}

export interface ErrorOverlayProps {
  error: ErrorInfo | null;
  onDismiss: () => void;
  onGoToLine?: (line: number, column: number) => void;
  className?: string;
}

export function ErrorOverlay({ error, onDismiss, onGoToLine, className }: ErrorOverlayProps) {
  const dismissRef = useRef<HTMLButtonElement>(null);

  // Move focus to dismiss button when the overlay appears so keyboard users
  // can immediately close it without having to tab through the whole page.
  useEffect(() => {
    if (error) {
      dismissRef.current?.focus();
    }
  }, [error]);

  if (!error) return null;

  const hasLocation = error.line !== undefined;
  const locationLabel = hasLocation
    ? `Line ${error.line}${error.column !== undefined ? `:${error.column}` : ""}`
    : null;

  const handleGoToLine = () => {
    if (onGoToLine && error.line !== undefined) {
      onGoToLine(error.line, error.column ?? 1);
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "absolute inset-x-0 bottom-0 z-30",
        "mx-3 mb-3 rounded-xl border",
        "border-destructive/20 bg-destructive/5 backdrop-blur-sm",
        "shadow-lg shadow-destructive/10",
        className,
      )}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Icon */}
        <div className="mt-0.5 flex-shrink-0 rounded-full bg-destructive/10 p-1.5">
          <AlertTriangle
            className="h-3.5 w-3.5 text-destructive"
            aria-hidden="true"
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-destructive">Compilation Error</p>

          {/* Location badge */}
          {locationLabel && (
            <button
              type="button"
              onClick={handleGoToLine}
              className={cn(
                "mt-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
                "text-[10px] font-medium text-destructive/80",
                "bg-destructive/10 hover:bg-destructive/20",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50",
                onGoToLine ? "cursor-pointer" : "cursor-default pointer-events-none",
              )}
              aria-label={`Jump to ${locationLabel} in editor`}
              disabled={!onGoToLine}
            >
              {locationLabel}
              {onGoToLine && <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />}
            </button>
          )}

          {/* Error message */}
          <pre
            className={cn(
              "mt-1.5 overflow-x-auto text-[11px] leading-relaxed",
              "text-destructive/90 font-mono whitespace-pre-wrap break-words",
              "max-h-[8rem]",
            )}
          >
            {error.message}
          </pre>
        </div>

        {/* Dismiss */}
        <button
          ref={dismissRef}
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className={cn(
            "ml-auto flex-shrink-0 rounded-md p-1",
            "text-destructive/60 hover:text-destructive hover:bg-destructive/10",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50",
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
