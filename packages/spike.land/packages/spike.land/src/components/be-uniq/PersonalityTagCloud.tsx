"use client";

import { cn } from "@/lib/utils";

interface PersonalityTag {
  label: string;
  weight: number;
  color?: string;
}

interface PersonalityTagCloudProps {
  tags: PersonalityTag[];
}

const defaultColors = [
  "bg-violet-500/15 text-violet-300 border-violet-500/30",
  "bg-blue-500/15 text-blue-300 border-blue-500/30",
  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "bg-rose-500/15 text-rose-300 border-rose-500/30",
  "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  "bg-orange-500/15 text-orange-300 border-orange-500/30",
];

function weightToFontSize(weight: number): string {
  if (weight >= 9) return "text-2xl font-bold";
  if (weight >= 7) return "text-xl font-semibold";
  if (weight >= 5) return "text-base font-medium";
  if (weight >= 3) return "text-sm font-normal";
  return "text-xs font-normal";
}

function weightToPadding(weight: number): string {
  if (weight >= 9) return "px-4 py-2";
  if (weight >= 7) return "px-3 py-1.5";
  if (weight >= 5) return "px-3 py-1";
  return "px-2 py-0.5";
}

export function PersonalityTagCloud({ tags }: PersonalityTagCloudProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center items-center">
      {tags.map((tag, index) => (
        <span
          key={tag.label}
          className={cn(
            "inline-flex items-center rounded-full border transition-all duration-200 hover:scale-105",
            weightToFontSize(tag.weight),
            weightToPadding(tag.weight),
            tag.color ?? defaultColors[index % defaultColors.length],
          )}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}
