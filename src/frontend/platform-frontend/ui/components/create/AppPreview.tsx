import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ExternalLink, Maximize, Minimize, RefreshCw } from "lucide-react";
import { Button } from "../../shared/ui/button";
import { cn } from "../../../styling/cn";

export interface GenerationStep {
  label: string;
  done: boolean;
}

export interface AppPreviewProps {
  /** URL to load in the iframe (a live codespace URL). */
  src: string | null;
  /** Whether generation is in progress. */
  isGenerating?: boolean;
  /** Progress steps shown during generation. */
  generationSteps?: GenerationStep[];
  /** Human-readable app title for the toolbar. */
  title?: string;
  className?: string;
}

function GenerationProgress({ steps }: { steps: GenerationStep[] }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-background p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <div
          className="mb-2 h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-foreground">Generating your app…</p>
        <p className="text-xs text-muted-foreground">This usually takes 5–15 seconds</p>
      </div>

      <ol className="flex w-full max-w-xs flex-col gap-2" aria-label="Generation progress">
        {steps.map((step, i) => (
          <li
            key={i}
            className={cn(
              "flex items-center gap-2.5 text-xs transition-colors duration-300",
              step.done ? "text-foreground" : "text-muted-foreground/50",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                step.done
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-muted",
              )}
              aria-hidden="true"
            >
              {step.done ? "✓" : i + 1}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background p-8 text-center"
    >
      <div className="rounded-full bg-destructive/10 p-3 text-destructive">
        <AlertCircle className="size-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Preview failed to load</p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
          We couldn&apos;t reach the edge runtime. Check that the app was generated successfully.
        </p>
      </div>
      <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
        <RefreshCw className="size-3.5" />
        Try Again
      </Button>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div
      aria-label="Loading preview"
      aria-busy="true"
      className="absolute inset-0 z-10 flex flex-col gap-3 bg-background p-5"
    >
      <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
      <div className="mt-1 h-32 w-full animate-pulse rounded-xl bg-muted" />
      <div className="flex gap-3">
        <div className="h-20 flex-1 animate-pulse rounded-lg bg-muted/60" />
        <div className="h-20 flex-1 animate-pulse rounded-lg bg-muted/60" />
      </div>
      <div className="h-4 w-4/5 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-3/5 animate-pulse rounded-md bg-muted/60" />
    </div>
  );
}

const DEFAULT_STEPS: GenerationStep[] = [
  { label: "Classifying idea", done: false },
  { label: "Selecting template", done: false },
  { label: "Generating React code", done: false },
  { label: "Transpiling", done: false },
  { label: "Deploying to edge", done: false },
];

export function AppPreview({
  src,
  isGenerating = false,
  generationSteps = DEFAULT_STEPS,
  title,
  className,
}: AppPreviewProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reset iframe state whenever src changes
  useEffect(() => {
    if (!src) return;
    setIsIframeLoading(true);
    setHasError(false);
    setIframeKey((k) => k + 1);
  }, [src]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsIframeLoading(true);
    setIframeKey((k) => k + 1);
  }, []);

  // Escape exits fullscreen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg transition-all",
        isFullscreen && "fixed inset-0 z-[100] rounded-none",
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/50 px-4 py-2 backdrop-blur-sm">
        {/* Browser chrome dots + URL */}
        <div className="flex min-w-0 items-center gap-3 overflow-hidden">
          <div className="flex shrink-0 gap-1.5" aria-hidden="true">
            <div className="h-2.5 w-2.5 rounded-full bg-border" />
            <div className="h-2.5 w-2.5 rounded-full bg-border" />
            <div className="h-2.5 w-2.5 rounded-full bg-border" />
          </div>
          {src && (
            <span
              title={src}
              className="min-w-0 truncate rounded border border-border/50 bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground/70"
            >
              {src}
            </span>
          )}
          {!src && title && (
            <span className="truncate text-xs font-medium text-muted-foreground">{title}</span>
          )}
        </div>

        {/* Actions */}
        <div className="ml-2 flex shrink-0 items-center gap-1">
          {src && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={handleRetry}
                aria-label="Refresh preview"
                title="Refresh preview"
              >
                <RefreshCw className={cn("size-3.5", isIframeLoading && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                asChild
                title="Open in new tab"
              >
                <a href={src} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab">
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsFullscreen((f) => !f)}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
          </Button>
        </div>
      </div>

      {/* Preview area */}
      <div
        className={cn(
          "relative bg-background",
          isFullscreen ? "flex-1" : "h-[520px]",
        )}
      >
        {/* Generation progress overlay */}
        {isGenerating && <GenerationProgress steps={generationSteps} />}

        {/* Empty state */}
        {!isGenerating && !src && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-full bg-muted p-4">
              <ExternalLink className="size-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">
              Your app preview will appear here after generation
            </p>
          </div>
        )}

        {/* Iframe loading skeleton */}
        {src && isIframeLoading && !hasError && <PreviewSkeleton />}

        {/* Error state */}
        {hasError && <ErrorState onRetry={handleRetry} />}

        {/* Iframe */}
        {src && (
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src={src}
            title={`Preview — ${title ?? src}`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className="h-full w-full border-0"
            onLoad={() => setIsIframeLoading(false)}
            onError={() => {
              setIsIframeLoading(false);
              setHasError(true);
            }}
          />
        )}
      </div>
    </div>
  );
}
