"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useSession } from "@/lib/auth/client/hooks";
import { useCallback, useEffect, useRef, useState } from "react";

interface CodespaceAppEmbedProps {
  appSlug: string;
  codespaceId: string;
  variantId: string;
  className?: string;
}

interface IframeErrorMessage {
  type: "iframe-error";
  source: "spike-land-bundle";
  codeSpace: string;
}

interface IframeClickMessage {
  type: "iframe-click";
  source: "spike-land-bundle";
}

function isIframeErrorMessage(data: unknown): data is IframeErrorMessage {
  if (typeof data !== "object" || data === null) return false;
  const msg = data as Record<string, unknown>;
  return (
    msg.type === "iframe-error" && msg.source === "spike-land-bundle"
  );
}

function isIframeClickMessage(data: unknown): data is IframeClickMessage {
  if (typeof data !== "object" || data === null) return false;
  const msg = data as Record<string, unknown>;
  return (
    msg.type === "iframe-click" && msg.source === "spike-land-bundle"
  );
}

/** Fire-and-forget metrics POST. Failures are silently ignored. */
function trackMetric(
  endpoint: "impression" | "error" | "engagement",
  variantId: string,
): void {
  fetch(`/api/store-app/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variantId }),
  }).catch(() => {
    // Metrics are best-effort; do not block user experience on failure.
  });
}

export function CodespaceAppEmbed({
  appSlug,
  codespaceId,
  variantId,
  className,
}: CodespaceAppEmbedProps) {
  const { data: session } = useSession();

  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [useRebuildSrc, setUseRebuildSrc] = useState(false);

  const rebuildAttemptedRef = useRef(false);
  const impressionTrackedRef = useRef(false);
  const engagementTrackedRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // ── Retry / full reset ───────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setLoading(true);
    setHasError(false);
    setIsRebuilding(false);
    setUseRebuildSrc(false);
    rebuildAttemptedRef.current = false;
    impressionTrackedRef.current = false;
    engagementTrackedRef.current = false;
    setIframeKey(prev => prev + 1);
  }, []);

  // ── Iframe load handler ──────────────────────────────────────────────
  const handleIframeLoad = useCallback(() => {
    setLoading(false);

    // Track impression once per mount cycle
    if (!impressionTrackedRef.current) {
      impressionTrackedRef.current = true;
      trackMetric("impression", variantId);
    }

    // Inject auth context into the iframe
    if (session?.user?.id && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "auth-token", userId: session.user.id },
        "*",
      );
    }
  }, [session?.user?.id, variantId]);

  // ── PostMessage listener for errors and clicks ───────────────────────
  useEffect(() => {
    function handleMessage(event: MessageEvent<unknown>): void {
      const data = event.data;

      // Error handling with auto-rebuild on first failure
      if (isIframeErrorMessage(data) && data.codeSpace === codespaceId) {
        trackMetric("error", variantId);

        if (!rebuildAttemptedRef.current) {
          // First failure: auto-rebuild with cache bust
          rebuildAttemptedRef.current = true;
          setIsRebuilding(true);
          setLoading(true);
          setUseRebuildSrc(true);
          setIframeKey(prev => prev + 1);
        } else {
          // Rebuild also failed: surface error UI
          setIsRebuilding(false);
          setLoading(false);
          setHasError(true);
        }
        return;
      }

      // Engagement tracking (once per session)
      if (isIframeClickMessage(data) && !engagementTrackedRef.current) {
        engagementTrackedRef.current = true;
        trackMetric("engagement", variantId);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [codespaceId, variantId]);

  const iframeSrc = `/api/codespace/${codespaceId}/bundle${useRebuildSrc ? "?rebuild=true" : ""}`;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border bg-muted/20",
        className,
      )}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            {isRebuilding && (
              <span className="text-sm text-muted-foreground">
                Rebuilding app...
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error overlay */}
      {hasError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/90 backdrop-blur-sm">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            This app failed to render. The bundle may contain errors.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      )}

      {/* Embedded codespace iframe */}
      <iframe
        ref={iframeRef}
        key={iframeKey}
        src={iframeSrc}
        className="aspect-video w-full border-none"
        title={`${appSlug} app`}
        sandbox="allow-scripts allow-popups allow-forms"
        allow="autoplay"
        onLoad={handleIframeLoad}
        onError={() => {
          setLoading(false);
          setHasError(true);
          trackMetric("error", variantId);
        }}
      />
    </div>
  );
}
