"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  UNPLANNED: {
    label: "Unplanned",
    className: "bg-zinc-700/50 text-zinc-300 border-zinc-600",
  },
  PLANNING: {
    label: "Planning",
    className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  PLAN_READY: {
    label: "Plan Ready",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  },
  SENT_TO_JULES: {
    label: "Sent to Jules",
    className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
  JULES_WORKING: {
    label: "Jules Working",
    className: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30 animate-pulse",
  },
  JULES_REVIEW: {
    label: "Jules Review",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  BUILD_FIXING: {
    label: "Build Fixing",
    className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  FAILED: {
    label: "Failed",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

export function WorkflowStatusBadge({
  status,
  className,
}: {
  status: string | null;
  className?: string;
}) {
  const fallback = {
    label: "Unplanned",
    className: "bg-zinc-700/50 text-zinc-300 border-zinc-600",
  };
  const config = STATUS_CONFIG[status || "UNPLANNED"] ?? fallback;

  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium border", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
