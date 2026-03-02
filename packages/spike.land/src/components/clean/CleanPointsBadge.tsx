"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface CleanPointsBadgeProps {
  points: number;
  animated?: boolean;
}

export function CleanPointsBadge({ points, animated }: CleanPointsBadgeProps) {
  return (
    <Badge
      variant="success"
      className={cn("gap-1.5 px-3 py-1.5 text-base font-bold", animated && "animate-pulse")}
    >
      <Star className="h-4 w-4" />
      {points.toLocaleString()} pts
    </Badge>
  );
}
