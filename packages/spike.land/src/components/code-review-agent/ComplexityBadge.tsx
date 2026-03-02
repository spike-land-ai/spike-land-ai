"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ComplexityLevel = "low" | "medium" | "high" | "critical";

interface ComplexityBadgeProps {
  level: ComplexityLevel;
}

const complexityColor: Record<ComplexityLevel, string> = {
  low: "bg-green-500/10 text-green-400 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function ComplexityBadge({ level }: ComplexityBadgeProps) {
  return (
    <Badge variant="outline" className={cn("text-xs font-mono", complexityColor[level])}>
      {level}
    </Badge>
  );
}
