"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface BlockType {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

interface PageBlockPaletteProps {
  blocks: BlockType[];
  onAdd?: (id: string) => void;
  className?: string;
}

export function PageBlockPalette({ blocks, onAdd, className }: PageBlockPaletteProps) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3", className)}>
      {blocks.map((block) => {
        const Icon = block.icon;
        return (
          <Card
            key={block.id}
            className="bg-zinc-900 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/80 transition-colors cursor-pointer"
            onClick={() => onAdd?.(block.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onAdd?.(block.id);
              }
            }}
            aria-label={`Add ${block.label} block`}
          >
            <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
              <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                <Icon className="h-5 w-5 text-zinc-300" />
              </div>
              <span className="text-xs font-medium text-zinc-200 leading-tight">{block.label}</span>
              <span className="text-[11px] text-zinc-500 leading-snug line-clamp-2">
                {block.description}
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
