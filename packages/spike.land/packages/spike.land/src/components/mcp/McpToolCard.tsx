"use client";

import type React from "react";
import { useCallback } from "react";
import { ArrowRight, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ICON_MAP } from "@/components/mcp/mcp-icon-map";
import type { McpToolDef } from "@/components/mcp/mcp-tool-registry";
import { MCP_CATEGORIES } from "@/components/mcp/mcp-tool-registry";

interface McpToolCardProps {
  tool: McpToolDef;
  onTryIt: (tool: McpToolDef) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (toolName: string) => void;
}

const categoryMap = new Map(MCP_CATEGORIES.map(c => [c.id, c]));

export function McpToolCard(
  { tool, onTryIt, isFavorite, onToggleFavorite }: McpToolCardProps,
) {
  const cat = categoryMap.get(tool.category);
  const Icon = (cat?.icon ? ICON_MAP[cat.icon] : null) as
    | React.ComponentType<{ className?: string; }>
    | null;

  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleFavorite?.(tool.name);
    },
    [tool.name, onToggleFavorite],
  );

  return (
    <div className="group relative flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/[0.10] transition-all duration-300">
      {/* Favorite star */}
      {onToggleFavorite && (
        <button
          type="button"
          onClick={handleToggleFavorite}
          aria-label={isFavorite
            ? `Remove ${tool.displayName} from favorites`
            : `Add ${tool.displayName} to favorites`}
          aria-pressed={isFavorite}
          className="absolute top-3 right-3 p-1.5 rounded-lg transition-all hover:bg-white/[0.06]"
        >
          <Star
            className={`w-4 h-4 transition-colors ${
              isFavorite
                ? "fill-amber-400 text-amber-400"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          />
        </button>
      )}

      {/* Icon + name row */}
      <div className="flex items-start gap-3 pr-8">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
          {Icon
            ? <Icon className="w-5 h-5 text-cyan-400" />
            : (
              <span className="text-cyan-400 text-xs font-bold">
                {tool.displayName[0]}
              </span>
            )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm text-white font-semibold leading-tight truncate">
            {tool.name}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">{tool.displayName}</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 flex-1">
        {tool.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-auto">
        <div className="flex items-center gap-1.5 flex-wrap">
          {cat && (
            <Badge variant="secondary" className="text-[10px] px-2 py-0">
              {cat.name}
            </Badge>
          )}
          <Badge
            variant={tool.tier === "free" ? "outline" : "secondary"}
            className={`text-[10px] px-2 py-0 ${
              tool.tier === "free"
                ? "text-green-400 border-green-400/30"
                : "text-amber-400 border-amber-400/30"
            }`}
          >
            {tool.tier === "free" ? "Free" : "Pro"}
          </Badge>
          {tool.params.length > 0 && (
            <span className="text-[10px] text-zinc-600">
              {tool.params.length} param{tool.params.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onTryIt(tool)}
          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-medium shrink-0 transition-colors group/btn"
        >
          Try it
          <ArrowRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
