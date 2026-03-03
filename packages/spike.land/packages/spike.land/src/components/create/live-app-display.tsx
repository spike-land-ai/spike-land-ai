"use client";

import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface LiveAppDisplayProps {
  codespaceId: string;
  codespaceUrl: string;
  title: string;
  slug: string;
  className?: string;
}

export function LiveAppDisplay({
  codespaceId,
  title,
  slug,
  className,
}: LiveAppDisplayProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const rebuildAttemptedRef = useRef(false);
  const [useRebuildSrc, setUseRebuildSrc] = useState(false);

  const handleRefresh = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setLoading(true);
    setHasError(false);
    setIsRebuilding(false);
    rebuildAttemptedRef.current = false;
    setUseRebuildSrc(false);
    setIframeKey(prev => prev + 1);
  }, []);

  // Listen for error messages from the sandboxed bundle iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent): void {
      if (
        event.data?.type !== "iframe-error"
        || event.data?.source !== "spike-land-bundle"
        || event.data?.codeSpace !== codespaceId
      ) {
        return;
      }

      if (!rebuildAttemptedRef.current) {
        // First failure: auto-rebuild
        rebuildAttemptedRef.current = true;
        window.getSelection()?.removeAllRanges();
        setIsRebuilding(true);
        setLoading(true);
        setUseRebuildSrc(true);
        setIframeKey(prev => prev + 1);
      } else {
        // Rebuild also failed: show error UI
        setIsRebuilding(false);
        setLoading(false);
        setHasError(true);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [codespaceId]);

  const iframeSrc = `/api/codespace/${codespaceId}/bundle${useRebuildSrc ? "?rebuild=true" : ""}`;

  return (
    <div
      className={cn("flex flex-col h-[calc(100dvh-4rem)] w-full", className)}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-card">
        <div className="flex items-center gap-4">
          <Link
            href="/create"
            className="group/back inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base shadow-sm hover:shadow-md transition-all duration-200"
          >
            <ArrowLeft className="w-5 h-5 transition-transform duration-200 group-hover/back:-translate-x-0.5" />
            <span className="flex flex-col leading-tight">
              <span>All Apps</span>
              <span className="text-[10px] font-normal opacity-75">
                /create
              </span>
            </span>
          </Link>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-lg">{title}</h1>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full font-mono">
              {slug}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-xs font-semibold hover:from-cyan-400 hover:to-purple-400 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Create Your Own
          </Link>
          <div className="h-5 w-px bg-border" />
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title="Reload App"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
          <a
            href={`/api/codespace/${codespaceId}/bundle`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href={`/api/codespace/${codespaceId}/bundle?download=true`}
            download={`${codespaceId}.html`}
            className="p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title="Download as HTML"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div className="flex-1 relative bg-muted/20">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              {isRebuilding && (
                <span className="text-sm text-muted-foreground">
                  Rebuilding app...
                </span>
              )}
            </div>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/90 backdrop-blur-sm z-20">
            <AlertTriangle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              This app failed to render. The bundle may contain errors.
            </p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={iframeSrc}
          className="w-full h-full border-none"
          title={title}
          sandbox="allow-scripts allow-popups allow-forms"
          allow="autoplay"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setHasError(true);
          }}
        />
      </div>
    </div>
  );
}
