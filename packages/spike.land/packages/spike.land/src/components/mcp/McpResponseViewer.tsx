"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Sparkles,
} from "lucide-react";
import Image from "next/image";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface McpResponseViewerProps {
  response: unknown;
  error: string | null;
  isExecuting: boolean;
  responseType: "json" | "image" | "text";
}

const MAX_JSON_DISPLAY_BYTES = 10 * 1024; // 10KB

// Common error patterns and guidance
const ERROR_GUIDANCE: Record<string, string> = {
  "401": "Authentication required. Check your API key or log in at /settings.",
  "403": "Insufficient permissions. This tool may require a workspace-tier subscription.",
  "404": "Resource not found. The requested item may have been deleted or the ID is incorrect.",
  "429": "Rate limit exceeded. Wait a moment and try again.",
  "500": "Internal server error. The server encountered an unexpected issue.",
  "timeout": "Request timed out. The operation may take longer than expected — try again.",
  "network": "Network error. Check your internet connection and try again.",
  "fetch": "Failed to fetch. The server may be temporarily unavailable.",
};

function getErrorGuidance(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [pattern, guidance] of Object.entries(ERROR_GUIDANCE)) {
    if (lower.includes(pattern)) return guidance;
  }
  return null;
}

export function McpResponseViewer({
  response,
  error,
  isExecuting,
  responseType,
}: McpResponseViewerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Response</CardTitle>
      </CardHeader>
      <CardContent>
        {isExecuting
          ? <LoadingSkeleton />
          : error
          ? <ErrorDisplay message={error} />
          : response === null || response === undefined
          ? <EmptyState />
          : <ResponseContent response={response} responseType={responseType} />}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading response">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function ErrorDisplay({ message }: { message: string; }) {
  const guidance = getErrorGuidance(message);

  return (
    <div
      className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 space-y-2"
      role="alert"
    >
      <div className="flex items-center gap-2 text-destructive font-medium">
        <AlertCircle className="h-4 w-4" />
        Error
      </div>
      <p className="text-sm text-destructive/80">{message}</p>
      {guidance && (
        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-destructive/10">
          {guidance}
        </p>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
      <Sparkles className="h-8 w-8 opacity-40" />
      <p className="text-sm">Execute a tool to see the response</p>
    </div>
  );
}

function ResponseContent({
  response,
  responseType,
}: {
  response: unknown;
  responseType: "json" | "image" | "text";
}) {
  if (responseType === "image" && isImageResponse(response)) {
    const url = getImageUrl(response);
    if (url) {
      return (
        <div className="space-y-3">
          <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
            <Image
              src={url}
              alt="Tool response image"
              fill
              className="object-contain"
            />
          </div>
          {typeof response === "object" && <JsonBlock data={response} />}
        </div>
      );
    }
  }

  if (responseType === "text" && typeof response === "string") {
    return (
      <div className="relative">
        <ExportToolbar data={response} format="text" />
        <ScrollArea className="max-h-96">
          <pre className="text-sm font-mono whitespace-pre-wrap p-4 rounded-lg bg-muted">
            {response}
          </pre>
        </ScrollArea>
      </div>
    );
  }

  // Default: JSON
  return <JsonBlock data={response} />;
}

function ExportToolbar(
  { data, format }: { data: unknown; format: "json" | "text"; },
) {
  const text = format === "json" ? JSON.stringify(data, null, 2) : String(data);

  const handleDownload = useCallback(() => {
    const ext = format === "json" ? "json" : "txt";
    const mimeType = format === "json" ? "application/json" : "text/plain";
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcp-response.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [text, format]);

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
      <CopyButton text={text} />
      <button
        type="button"
        onClick={handleDownload}
        aria-label={`Download as ${format.toUpperCase()}`}
        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}

function JsonBlock({ data }: { data: unknown; }) {
  const formatted = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const isTruncated = formatted.length > MAX_JSON_DISPLAY_BYTES;
  const [showFull, setShowFull] = useState(false);

  const displayText = isTruncated && !showFull
    ? formatted.slice(0, MAX_JSON_DISPLAY_BYTES) + "\n\n... (truncated)"
    : formatted;

  return (
    <div className="relative">
      <ExportToolbar data={data} format="json" />
      <ScrollArea className="max-h-96">
        <pre className="text-sm font-mono whitespace-pre-wrap p-4 rounded-lg bg-muted">
          {displayText}
        </pre>
      </ScrollArea>
      {isTruncated && (
        <button
          type="button"
          onClick={() => setShowFull(prev => !prev)}
          className="mt-2 flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {showFull
            ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Show less
              </>
            )
            : (
              <>
                <ChevronDown className="w-3 h-3" />
                Show full response ({(formatted.length / 1024).toFixed(1)} KB)
              </>
            )}
        </button>
      )}
    </div>
  );
}

function isImageResponse(response: unknown): boolean {
  if (typeof response !== "object" || response === null) return false;
  const r = response as Record<string, unknown>;
  return (
    typeof r.outputImageUrl === "string"
    || typeof r.url === "string"
    || typeof r.image_url === "string"
  );
}

function getImageUrl(response: unknown): string | null {
  if (typeof response !== "object" || response === null) return null;
  const r = response as Record<string, unknown>;
  if (typeof r.outputImageUrl === "string") return r.outputImageUrl;
  if (typeof r.url === "string") return r.url;
  if (typeof r.image_url === "string") return r.image_url;
  return null;
}
