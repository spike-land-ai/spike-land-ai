"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FileText, Image as ImageIcon } from "lucide-react";
import NextImage from "next/image";

type PublishStatus = "draft" | "published" | "scheduled";

interface PageProjectCardProps {
  projectName: string;
  pageCount: number;
  publishStatus: PublishStatus;
  lastModified: string;
  thumbnailUrl?: string;
  className?: string;
}

const statusConfig: Record<PublishStatus, { label: string; badgeClass: string }> = {
  draft: {
    label: "Draft",
    badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  },
  published: {
    label: "Published",
    badgeClass: "bg-green-500/10 text-green-400 border-green-500/30",
  },
  scheduled: {
    label: "Scheduled",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
};

export function PageProjectCard({
  projectName,
  pageCount,
  publishStatus,
  lastModified,
  thumbnailUrl,
  className,
}: PageProjectCardProps) {
  const config = statusConfig[publishStatus];

  return (
    <Card
      className={cn(
        "bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors h-full",
        className,
      )}
    >
      {/* Thumbnail area */}
      <div className="relative w-full h-36 rounded-t-lg overflow-hidden bg-zinc-800">
        {thumbnailUrl ? (
          <NextImage
            src={thumbnailUrl}
            alt={`${projectName} thumbnail`}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-zinc-600">
            <ImageIcon className="h-8 w-8" aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <Badge variant="outline" className={cn("text-xs font-medium", config.badgeClass)}>
            {config.label}
          </Badge>
        </div>
      </div>

      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base text-zinc-100 truncate">{projectName}</CardTitle>
      </CardHeader>

      <CardContent className="pt-0 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {pageCount} page{pageCount !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="text-xs text-zinc-600">Modified {lastModified}</p>
      </CardContent>
    </Card>
  );
}
