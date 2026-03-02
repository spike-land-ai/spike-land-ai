import type { RenderedApp } from "@/lib/interfaces";
import { renderApp } from "@/lib/render-app";
import { cn } from "@/lib/utils";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface WrapperProps {
  codeSpace?: string;
  code?: string;
  transpiled?: string;
  scale?: number;
  className?: string;
}

export const Wrapper: React.FC<WrapperProps> = ({
  codeSpace,
  transpiled,
  code,
  scale,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<Error | null>(null);
  const renderedAppRef = useRef<RenderedApp | null>(null);
  const autoRetryCountRef = useRef(0);
  const autoRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);

  const renderContent = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      // Clean up previous render if it exists
      if (renderedAppRef.current) {
        renderedAppRef.current.cleanup();
        renderedAppRef.current = null;
      }

      // Render the new app
      const rendered = await renderApp({
        rootElement: containerRef.current,
        codeSpace,
        transpiled,
        code,
        App: undefined,
      });

      if (abortRef.current) return;

      renderedAppRef.current = rendered;
      setError(null);
      autoRetryCountRef.current = 0;
    } catch (err) {
      if (abortRef.current) return;

      console.error("Failed to render app:", err);
      const renderError = err instanceof Error ? err : new Error(String(err));
      setError(renderError);

      // Auto-retry once after 2 seconds on first failure
      if (autoRetryCountRef.current < 1) {
        autoRetryCountRef.current += 1;
        autoRetryTimerRef.current = setTimeout(() => {
          setError(null);
          renderContent();
        }, 2000);
      }
    }
  }, [codeSpace, transpiled, code]);

  const handleRetry = useCallback(() => {
    setError(null);
    renderContent();
  }, [renderContent]);

  useEffect(() => {
    if (!containerRef.current) return;

    abortRef.current = false;
    autoRetryCountRef.current = 0;
    renderContent();

    return () => {
      abortRef.current = true;
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
      if (renderedAppRef.current) {
        renderedAppRef.current.cleanup();
        renderedAppRef.current = null;
      }
    };
  }, [renderContent]);

  // Calculate style based on scale prop
  const containerStyle = scale
    ? { transform: `scale(${scale})`, transformOrigin: "0 0" }
    : undefined;

  return (
    <>
      {error && (
        <div className="text-red-500 p-4 border border-red-300 rounded mb-4">
          <h3 className="font-bold">Render Error</h3>
          <p>{error.message}</p>
          <button
            onClick={handleRetry}
            className="mt-2 px-4 py-1.5 text-sm font-medium bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
            data-testid="retry-button"
          >
            Retry
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        style={containerStyle}
        data-testid="wrapper-container"
        className={cn("w-full h-full", className)}
      />
    </>
  );
};
