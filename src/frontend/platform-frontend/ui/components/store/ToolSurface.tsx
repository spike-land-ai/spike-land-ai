/**
 * Store-scoped ToolSurface
 *
 * Wraps the base ToolSurface with store-specific chrome: a copy-result button,
 * an install call-to-action, and accessible keyboard interaction. This component
 * is used inside MDX app detail pages rendered by MdxSurface.
 */

import { useState, useCallback, useRef } from "react";
import { Suspense, lazy } from "react";
import { Copy, Check, Loader2, ExternalLink } from "lucide-react";

const BaseToolSurface = lazy(() =>
  import("../tool-surface/ToolSurface").then((m) => ({ default: m.ToolSurface })),
);

export interface StoreToolSurfaceProps {
  /** The MCP tool name to render (e.g. `"hn_get_top_stories"`). */
  toolName: string;
  /** Optional app slug used for the install link. */
  appSlug?: string;
  /** Whether the tool is available for the current user. Defaults to true. */
  isAvailable?: boolean;
  /** Pre-populated form data. */
  initialData?: Record<string, unknown>;
}

/**
 * Renders a single MCP tool as a fully-interactive store card.
 *
 * - Input form auto-generated from the tool's JSON Schema
 * - Execute button with loading state
 * - Result panel with copy-to-clipboard action
 * - Links to the app's detail page for install
 */
export function StoreToolSurface({
  toolName,
  appSlug,
  isAvailable = true,
  initialData,
}: StoreToolSurfaceProps) {
  const [lastResultText, setLastResultText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleResultCopy = useCallback(() => {
    if (!lastResultText) return;
    void navigator.clipboard.writeText(lastResultText).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [lastResultText]);

  const handleToolResult = useCallback(
    (_tool: string, _input: Record<string, unknown>, result: unknown) => {
      // Capture result text for copy button
      try {
        const text =
          typeof result === "string"
            ? result
            : JSON.stringify(result, null, 2);
        setLastResultText(text);
      } catch {
        setLastResultText(null);
      }
    },
    [],
  );

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Tool surface chrome */}
      <Suspense
        fallback={
          <div className="flex items-center gap-2 p-5 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading tool...</span>
          </div>
        }
      >
        <BaseToolSurface
          toolName={toolName}
          appSlug={appSlug}
          isAvailable={isAvailable}
          defaultExpanded
          initialData={initialData}
          recordToolResult={handleToolResult}
        />
      </Suspense>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {lastResultText && (
            <button
              type="button"
              onClick={handleResultCopy}
              aria-label="Copy result to clipboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy result
                </>
              )}
            </button>
          )}
        </div>

        {appSlug && (
          <a
            href={`/apps/${appSlug}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Open full app page for ${appSlug}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Full app
          </a>
        )}
      </div>
    </div>
  );
}
