"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock, CloudUpload } from "lucide-react";

type PublishStatus = "draft" | "published" | "scheduled";

interface PagePublishToolbarProps {
  status: PublishStatus;
  lastSaved?: string;
  onPublish?: () => void;
  className?: string;
}

const statusConfig: Record<PublishStatus, { label: string; badgeClass: string }> = {
  draft: {
    label: "Draft",
    badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20",
  },
  published: {
    label: "Published",
    badgeClass: "bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20",
  },
  scheduled: {
    label: "Scheduled",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20",
  },
};

export function PagePublishToolbar({
  status,
  lastSaved,
  onPublish,
  className,
}: PagePublishToolbarProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Badge variant="outline" className={cn("text-xs font-medium", config.badgeClass)}>
          {config.label}
        </Badge>
        {lastSaved && (
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Saved {lastSaved}
          </span>
        )}
      </div>

      <Button
        size="sm"
        onClick={onPublish}
        className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white border-0"
        aria-label="Publish page"
      >
        <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
        Publish
      </Button>
    </div>
  );
}
