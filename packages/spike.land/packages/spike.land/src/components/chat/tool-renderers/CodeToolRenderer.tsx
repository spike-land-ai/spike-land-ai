"use client";

import { cn } from "@/lib/utils";
import type { ToolRendererProps } from "./DefaultToolRenderer";

/** Renderer for tools that return code: syntax-highlighted code blocks. */
export function CodeToolRenderer({ result, isError }: ToolRendererProps) {
  return (
    <pre
      className={cn(
        "text-xs rounded p-2 overflow-x-auto max-h-80 font-mono",
        isError
          ? "bg-red-500/10 text-red-300"
          : "bg-zinc-950 text-emerald-300 border border-emerald-500/10",
      )}
    >
      <code>{result}</code>
    </pre>
  );
}
