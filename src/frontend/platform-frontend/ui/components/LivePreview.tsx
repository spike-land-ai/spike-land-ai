import { useCallback, useState, useEffect, Component, type ReactNode } from "react";
import { RefreshCw, Maximize, Minimize, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "../shared/ui/button";
import { cn } from "../../styling/cn";

// ---------------------------------------------------------------------------
// Skeleton shimmer — shown while the iframe is loading
// ---------------------------------------------------------------------------

function PreviewSkeleton({ isDarkMode }: { isDarkMode: boolean }) {
  const shimmer = isDarkMode ? "bg-white/5 animate-pulse" : "bg-muted animate-pulse";
  const shimmerAlt = isDarkMode ? "bg-white/[0.03] animate-pulse" : "bg-muted/60 animate-pulse";

  return (
    <div
      aria-label="Loading preview"
      aria-busy="true"
      className={cn("absolute inset-0 z-10 flex flex-col gap-3 p-5", "bg-background")}
    >
      {/* Fake browser chrome bar */}
      <div className={cn("h-4 w-2/3 rounded-md", shimmer)} />

      {/* Fake content blocks */}
      <div className={cn("h-32 w-full rounded-xl mt-1", shimmer)} />

      <div className="flex gap-3">
        <div className={cn("h-20 flex-1 rounded-lg", shimmerAlt)} />
        <div className={cn("h-20 flex-1 rounded-lg", shimmerAlt)} />
      </div>

      <div className={cn("h-4 w-4/5 rounded-md", shimmer)} />
      <div className={cn("h-4 w-3/5 rounded-md", shimmerAlt)} />
      <div className={cn("h-4 w-1/2 rounded-md", shimmer)} />

      <div className="flex gap-3 mt-1">
        <div className={cn("h-8 w-24 rounded-lg", shimmer)} />
        <div className={cn("h-8 w-16 rounded-lg", shimmerAlt)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error boundary — catches iframe-level React errors in the host tree
// (Note: cross-origin iframe crashes won't bubble here; onError handles those)
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset: () => void;
  isDarkMode: boolean;
}

class IframeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message ?? "Unknown error" };
  }

  override componentDidCatch() {
    // Error already captured in state — no need for additional logging here
  }

  override render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay
          message={this.state.message}
          isDarkMode={this.props.isDarkMode}
          onRetry={() => {
            this.setState({ hasError: false, message: "" });
            this.props.onReset();
          }}
        />
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Shared error UI — used by both the error boundary and iframe onError
// ---------------------------------------------------------------------------

function ErrorDisplay({
  message,
  isDarkMode,
  onRetry,
}: {
  message?: string;
  isDarkMode: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center",
        "bg-background",
      )}
    >
      <div
        className={cn(
          "p-3 rounded-full mb-4",
          isDarkMode ? "bg-red-500/10 text-red-400" : "bg-destructive/10 text-destructive",
        )}
      >
        <AlertCircle className="size-6" />
      </div>
      <h3 className={cn("text-sm font-semibold", isDarkMode ? "text-white" : "text-foreground")}>
        Preview Failed to Load
      </h3>
      <p
        className={cn(
          "mt-1.5 text-xs max-w-[260px] leading-relaxed",
          isDarkMode ? "text-gray-500" : "text-muted-foreground",
        )}
      >
        {message ? `Error: ${message}` : "We couldn't reach the edge runtime for this application."}
      </p>
      <Button
        onClick={onRetry}
        variant="outline"
        size="sm"
        className={cn(
          "mt-6",
          isDarkMode && "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white",
        )}
      >
        <RefreshCw className="mr-2 size-3.5" />
        Try Again
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LivePreview
// ---------------------------------------------------------------------------

export interface LivePreviewProps {
  appId: string;
  edgeUrl?: string;
  isDarkMode?: boolean;
}

export function LivePreview({
  appId,
  edgeUrl = "https://edge.spike.land",
  isDarkMode = false,
}: LivePreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [key, setKey] = useState(0);

  const src = `${edgeUrl}/live/${appId}/index.html`;

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(false);
    setKey((k) => k + 1);
  }, []);

  // Reset loading/error when appId changes
  useEffect(() => {
    setLoading(true);
    setError(false);
    setKey((k) => k + 1);
  }, [appId]);

  // Escape key exits fullscreen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) setFullscreen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [fullscreen]);

  return (
    <div
      className={cn(
        "flex flex-col border transition-all overflow-hidden",
        isDarkMode
          ? "border-white/5 bg-background shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
          : "border-border bg-card shadow-lg",
        fullscreen ? "fixed inset-0 z-[100] rounded-none" : "relative rounded-xl",
      )}
    >
      {/* ---- Toolbar ---- */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-2 backdrop-blur-sm shrink-0",
          isDarkMode ? "border-white/5 bg-white/[0.03]" : "border-border bg-muted/50",
        )}
      >
        {/* Left: traffic lights + URL */}
        <div className="flex items-center gap-3 overflow-hidden min-w-0">
          <div className="flex gap-1.5 shrink-0">
            <div
              className={cn("h-2.5 w-2.5 rounded-full", isDarkMode ? "bg-white/10" : "bg-border")}
            />
            <div
              className={cn("h-2.5 w-2.5 rounded-full", isDarkMode ? "bg-white/10" : "bg-border")}
            />
            <div
              className={cn("h-2.5 w-2.5 rounded-full", isDarkMode ? "bg-white/10" : "bg-border")}
            />
          </div>
          <span
            title={src}
            className={cn(
              "truncate text-[11px] font-medium px-2 py-0.5 rounded border min-w-0",
              isDarkMode
                ? "text-gray-500 bg-white/5 border-white/5"
                : "text-muted-foreground/70 bg-muted border-border/50",
            )}
          >
            {src}
          </span>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-8",
              isDarkMode
                ? "text-gray-500 hover:text-white hover:bg-white/5"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={handleRefresh}
            aria-label="Refresh preview"
            title="Refresh preview"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>

          {/* Open in new tab */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-8",
              isDarkMode
                ? "text-gray-500 hover:text-white hover:bg-white/5"
                : "text-muted-foreground hover:text-foreground",
            )}
            asChild
            title="Open in new tab"
          >
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open preview in new tab"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </Button>

          {/* Fullscreen toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-8",
              isDarkMode
                ? "text-gray-500 hover:text-white hover:bg-white/5"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setFullscreen((f) => !f)}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {fullscreen ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
          </Button>
        </div>
      </div>

      {/* ---- iframe area ---- */}
      <div className={cn("relative", fullscreen ? "flex-1" : "h-[600px]", "bg-background")}>
        {/* Skeleton shimmer while loading */}
        {loading && !error && <PreviewSkeleton isDarkMode={isDarkMode} />}

        {/* Error overlay */}
        {error && <ErrorDisplay isDarkMode={isDarkMode} onRetry={handleRefresh} />}

        {/* Error boundary wraps the iframe so host-side errors are caught too */}
        <IframeErrorBoundary onReset={handleRefresh} isDarkMode={isDarkMode}>
          <iframe
            key={key}
            src={src}
            title={`Preview — ${appId}`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className="h-full w-full border-0"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        </IframeErrorBoundary>
      </div>
    </div>
  );
}
