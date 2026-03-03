"use client";

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolRendererProps } from "./DefaultToolRenderer";

/** Renderer for file read/write tools: shows file path + content preview. */
export function FileToolRenderer({ result, isError }: ToolRendererProps) {
  if (isError) {
    return (
      <pre className="text-xs rounded p-2 bg-red-500/10 text-red-300 whitespace-pre-wrap">
        {result}
      </pre>
    );
  }

  // Try to detect file path in the first line
  const lines = result.split("\n");
  const firstLine = lines[0]?.trim() ?? "";
  const looksLikePath = /^[\/~.].*\.\w+/.test(firstLine)
    || firstLine.startsWith("File:");
  const filePath = looksLikePath ? firstLine.replace(/^File:\s*/, "") : null;
  const content = looksLikePath ? lines.slice(1).join("\n").trim() : result;

  return (
    <div className="space-y-1">
      {filePath && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <FileText className="h-3 w-3" />
          <span className="font-mono truncate">{filePath}</span>
        </div>
      )}
      <pre
        className={cn(
          "text-xs rounded p-2 overflow-x-auto max-h-60 font-mono",
          "bg-zinc-950 text-zinc-300 border border-white/5",
        )}
      >
        {content || "(empty)"}
      </pre>
    </div>
  );
}
