"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContentStatus } from "./types";

interface ContentStatusBadgeProps {
  status: ContentStatus;
  className?: string;
}

const statusStyles: Record<ContentStatus, string> = {
  draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  published: "bg-green-500/10 text-green-400 border-green-500/20",
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  archived: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export function ContentStatusBadge({
  status,
  className,
}: ContentStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs capitalize", statusStyles[status], className)}
    >
      {status}
    </Badge>
  );
}
