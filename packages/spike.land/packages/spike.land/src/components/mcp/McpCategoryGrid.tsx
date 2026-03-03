"use client";

import type React from "react";
import { ICON_MAP } from "@/components/mcp/mcp-icon-map";
import { MCP_SUPER_CATEGORIES } from "@/components/mcp/mcp-tool-registry";

interface McpCategoryGridProps {
  selectedCategory: string | null;
  onCategorySelect: (id: string | null) => void;
}

const FALLBACK_COLORS = {
  bg: "bg-zinc-500/10",
  border: "border-zinc-500/20 hover:border-zinc-500/40",
  icon: "text-zinc-400",
  text: "text-zinc-400",
};

const COLOR_CLASSES: Record<
  string,
  { bg: string; border: string; icon: string; text: string; }
> = {
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20 hover:border-blue-500/40",
    icon: "text-blue-400",
    text: "text-blue-400",
  },
  green: {
    bg: "bg-green-500/10",
    border: "border-green-500/20 hover:border-green-500/40",
    icon: "text-green-400",
    text: "text-green-400",
  },
  orange: {
    bg: "bg-orange-500/10",
    border: "border-orange-500/20 hover:border-orange-500/40",
    icon: "text-orange-400",
    text: "text-orange-400",
  },
  fuchsia: {
    bg: "bg-fuchsia-500/10",
    border: "border-fuchsia-500/20 hover:border-fuchsia-500/40",
    icon: "text-fuchsia-400",
    text: "text-fuchsia-400",
  },
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20 hover:border-purple-500/40",
    icon: "text-purple-400",
    text: "text-purple-400",
  },
  pink: {
    bg: "bg-pink-500/10",
    border: "border-pink-500/20 hover:border-pink-500/40",
    icon: "text-pink-400",
    text: "text-pink-400",
  },
  layers: {
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20 hover:border-zinc-500/40",
    icon: "text-zinc-400",
    text: "text-zinc-400",
  },
};

export function McpCategoryGrid(
  { selectedCategory, onCategorySelect }: McpCategoryGridProps,
) {
  return (
    <section className="px-4 pb-12">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-xl font-black text-white mb-6">
          Browse by Category
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {MCP_SUPER_CATEGORIES.map(sup => {
            const colors = COLOR_CLASSES[sup.color] ?? FALLBACK_COLORS;
            const Icon = ICON_MAP[sup.icon] as
              | React.ComponentType<{ className?: string; }>
              | undefined;
            const isSelected = selectedCategory === sup.id;

            return (
              <button
                key={sup.id}
                type="button"
                onClick={() => onCategorySelect(isSelected ? null : sup.id)}
                className={`group text-left rounded-2xl border p-4 transition-all duration-200 ${
                  isSelected
                    ? `${colors.bg} ${colors.border} ring-1 ring-offset-0 ring-offset-transparent`
                    : `bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] ${colors.border}`
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center mb-3`}
                >
                  {Icon && <Icon className={`w-5 h-5 ${colors.icon}`} />}
                </div>

                <p className="font-semibold text-white text-sm leading-tight mb-1">
                  {sup.name}
                </p>
                <p className="text-xs text-zinc-500 leading-snug line-clamp-2 mb-2">
                  {sup.description}
                </p>

                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${colors.text}`}>
                    {sup.toolCount} tools
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {sup.subcategories.slice(0, 2).map(sub => (
                      <span
                        key={sub.id}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-500"
                      >
                        {sub.name}
                      </span>
                    ))}
                    {sup.subcategories.length > 2 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-600">
                        +{sup.subcategories.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
