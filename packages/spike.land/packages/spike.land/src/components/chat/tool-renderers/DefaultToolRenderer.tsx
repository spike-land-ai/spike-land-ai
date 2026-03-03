"use client";

import { cn } from "@/lib/utils";
import { JsonView } from "../JsonView";
import { ChatMarkdown } from "../ChatMarkdown";

export interface ToolRendererProps {
  result: string;
  isError: boolean;
  name: string;
}

/** Default renderer: interactive JSON tree for JSON, formatted text for everything else. */
export function DefaultToolRenderer({ result, isError }: ToolRendererProps) {
  const parsed = tryParseJson(result);

  if (parsed !== undefined) {
    return (
      <JsonView
        data={parsed}
        className={isError ? "border-red-500/20 bg-red-500/5" : ""}
      />
    );
  }
  if (isError) {
    return (
      <pre
        className={cn(
          "text-xs rounded-lg p-2 overflow-x-auto max-h-60 whitespace-pre-wrap break-words font-mono",
          "bg-red-500/10 text-red-300 border border-red-500/20",
        )}
      >
        {result}
      </pre>
    );
  }

  return (
    <div className="bg-black/30 border border-white/[0.06] rounded-lg p-3 overflow-x-auto max-h-96">
      <ChatMarkdown content={result} />
    </div>
  );
}

function tryParseJson(text: string): unknown | undefined {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}
