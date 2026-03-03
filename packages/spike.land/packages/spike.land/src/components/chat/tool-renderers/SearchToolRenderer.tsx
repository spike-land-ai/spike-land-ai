"use client";

import type { ToolRendererProps } from "./DefaultToolRenderer";
import { ChatMarkdown } from "../ChatMarkdown";

/** Renderer for search/query tools: attempts to parse result items. */
export function SearchToolRenderer({ result, isError }: ToolRendererProps) {
  if (isError) {
    return (
      <pre className="text-xs rounded p-2 bg-red-500/10 text-red-300 whitespace-pre-wrap">
        {result}
      </pre>
    );
  }

  // Try to parse as JSON array of items
  const items = tryParseItems(result);
  if (items && items.length > 0) {
    return (
      <div className="space-y-1">
        {items.map((item, i) => (
          <div
            key={i}
            className="text-xs rounded bg-black/20 px-2 py-1.5 text-zinc-300"
          >
            {item.title && <span className="font-medium text-zinc-200">{item.title}</span>}
            {item.description && <p className="text-zinc-500 mt-0.5">{item.description}</p>}
            {!item.title && <span>{item.text ?? JSON.stringify(item)}</span>}
          </div>
        ))}
      </div>
    );
  }

  // Fallback to plain text
  return (
    <div className="bg-black/20 rounded-lg p-3 overflow-x-auto max-h-96">
      <ChatMarkdown content={result} />
    </div>
  );
}

interface ParsedItem {
  title?: string;
  description?: string;
  text?: string;
}

function tryParseItems(text: string): ParsedItem[] | null {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed as ParsedItem[];
    }
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
      return parsed.items as ParsedItem[];
    }
    return null;
  } catch {
    return null;
  }
}
