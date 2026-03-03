"use client";

import type React from "react";
import { memo, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface JsonViewProps {
  data: unknown;
  className?: string;
  /** Max depth before auto-collapsing. Default: 3 */
  maxExpandDepth?: number;
}

/**
 * Beautiful, interactive JSON viewer with syntax colouring.
 * Renders objects/arrays as collapsible trees; primitives inline.
 */
export const JsonView = memo(
  function JsonView({ data, className, maxExpandDepth = 3 }: JsonViewProps) {
    return (
      <div
        className={cn(
          "rounded-lg bg-black/30 border border-white/[0.06] p-3 overflow-x-auto text-xs font-mono leading-relaxed max-h-60 overflow-y-auto",
          className,
        )}
      >
        <JsonNode
          value={data}
          depth={0}
          maxExpandDepth={maxExpandDepth}
          isLast
        />
      </div>
    );
  },
);

/* ── Primitives ─────────────────────────────────────────── */

function renderPrimitive(value: unknown): React.JSX.Element {
  if (value === null) return <span className="text-zinc-500 italic">null</span>;
  if (value === undefined) {
    return <span className="text-zinc-500 italic">undefined</span>;
  }

  switch (typeof value) {
    case "string":
      return (
        <span className="text-emerald-400">
          &quot;<span className="text-emerald-300">{value}</span>&quot;
        </span>
      );
    case "number":
      return <span className="text-amber-300">{String(value)}</span>;
    case "boolean":
      return <span className="text-sky-400">{String(value)}</span>;
    default:
      return <span className="text-zinc-400">{String(value)}</span>;
  }
}

/* ── Recursive node ─────────────────────────────────────── */

const JsonNode = memo(function JsonNode({
  value,
  depth,
  maxExpandDepth,
  keyName,
  isLast,
}: {
  value: unknown;
  depth: number;
  maxExpandDepth: number;
  keyName?: string;
  isLast: boolean;
}) {
  const isObject = value !== null && typeof value === "object"
    && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const [expanded, setExpanded] = useState(depth < maxExpandDepth);

  // Memoize entries calculation to avoid re-computation on re-renders.
  // Must be called unconditionally to satisfy Rules of Hooks.
  const entries = useMemo(() => {
    if (!isExpandable) return [];
    return isArray
      ? (value as unknown[]).map((v, i) => ({ key: String(i), value: v }))
      : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
        key: k,
        value: v,
      }));
  }, [value, isArray, isExpandable]);

  const comma = isLast ? "" : ",";

  if (!isExpandable) {
    return (
      <div className="flex" style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        {keyName !== undefined && (
          <>
            <span className="text-violet-400">&quot;{keyName}&quot;</span>
            <span className="text-zinc-600 mr-1">:</span>
            {" "}
          </>
        )}
        {renderPrimitive(value)}
        <span className="text-zinc-600">{comma}</span>
      </div>
    );
  }

  const openBrace = isArray ? "[" : "{";
  const closeBrace = isArray ? "]" : "}";

  if (!expanded) {
    return (
      <div
        className="flex items-center group"
        style={{ paddingLeft: depth > 0 ? 16 : 0 }}
      >
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-0.5 hover:bg-white/5 rounded px-0.5 -mx-0.5 transition-colors"
        >
          <ChevronRight className="h-3 w-3 text-zinc-600 transition-transform" />
          {keyName !== undefined && (
            <>
              <span className="text-violet-400">&quot;{keyName}&quot;</span>
              <span className="text-zinc-600 mr-1">:</span>
              {" "}
            </>
          )}
          <span className="text-zinc-500">
            {openBrace}
            <span className="text-zinc-600 mx-0.5">
              {entries.length} {entries.length === 1 ? "item" : "items"}
            </span>
            {closeBrace}
          </span>
        </button>
        <span className="text-zinc-600">{comma}</span>
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      <div className="flex items-center group">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex items-center gap-0.5 hover:bg-white/5 rounded px-0.5 -mx-0.5 transition-colors"
        >
          <ChevronRight className="h-3 w-3 text-zinc-600 rotate-90 transition-transform" />
          {keyName !== undefined && (
            <>
              <span className="text-violet-400">&quot;{keyName}&quot;</span>
              <span className="text-zinc-600 mr-1">:</span>
              {" "}
            </>
          )}
          <span className="text-zinc-500">{openBrace}</span>
        </button>
      </div>
      {entries.map((entry, i) => (
        <JsonNode
          key={entry.key}
          keyName={isArray ? undefined : entry.key}
          value={entry.value}
          depth={depth + 1}
          maxExpandDepth={maxExpandDepth}
          isLast={i === entries.length - 1}
        />
      ))}
      <div className="flex">
        <span className="text-zinc-500">{closeBrace}</span>
        <span className="text-zinc-600">{comma}</span>
      </div>
    </div>
  );
});
