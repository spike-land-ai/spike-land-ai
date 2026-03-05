import { useCallback, useState, useEffect } from "react";
import { RefreshCw, Maximize, Minimize, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

interface LivePreviewProps {
  appId: string;
  edgeUrl?: string;
}

export function LivePreview({ appId, edgeUrl = "https://edge.spike.land" }: LivePreviewProps) {
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

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [fullscreen]);

  return (
    <div 
      className={cn(
        "flex flex-col border border-border bg-card shadow-lg transition-all overflow-hidden",
        fullscreen ? "fixed inset-0 z-[100] rounded-none" : "relative rounded-xl"
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex gap-1.5 shrink-0">
            <div className="h-2.5 w-2.5 rounded-full bg-border" />
            <div className="h-2.5 w-2.5 rounded-full bg-border" />
            <div className="h-2.5 w-2.5 rounded-full bg-border" />
          </div>
          <span className="truncate text-[11px] font-medium text-muted-foreground/70 bg-muted px-2 py-0.5 rounded border border-border/50">
            {src}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={handleRefresh}
            title="Refresh preview"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            asChild
            title="Open in new tab"
          >
            <a href={src} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => setFullscreen((f) => !f)}
            title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {fullscreen ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
          </Button>
        </div>
      </div>

      {/* Iframe */}
      <div className={cn("relative bg-white", fullscreen ? "flex-1" : "h-[600px]")}>
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-[2px] transition-all">
            <div className="relative flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary/20" />
              <div className="absolute h-4 w-4 animate-pulse rounded-full bg-primary/40" />
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground animate-pulse">Loading preview...</p>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background text-muted-foreground p-6 text-center">
            <div className="p-3 rounded-full bg-destructive/10 text-destructive mb-4">
              <AlertCircle className="size-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Preview Failed to Load</h3>
            <p className="mt-1 text-xs max-w-[240px]">We couldn't reach the edge runtime for this application.</p>
            <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-6">
              <RefreshCw className="mr-2 size-3.5" />
              Try Again
            </Button>
          </div>
        )}
        
        <iframe
          key={key}
          src={src}
          title={`Preview ${appId}`}
          sandbox="allow-scripts allow-same-origin"
          className="h-full w-full border-0"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      </div>
    </div>
  );
}

export type { LivePreviewProps };
