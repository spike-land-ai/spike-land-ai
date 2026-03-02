"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Platform = "twitter" | "linkedin" | "instagram" | "facebook";
type PostStatus = "scheduled" | "published" | "failed";
type MediaType = "text" | "image" | "video";

interface ScheduledPostCardProps {
  platform: Platform;
  scheduledTime: string;
  status: PostStatus;
  content: string;
  mediaType?: MediaType;
}

const platformConfig: Record<Platform, { abbr: string; color: string; bg: string }> = {
  twitter: { abbr: "TW", color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
  linkedin: { abbr: "LI", color: "text-blue-400", bg: "bg-blue-700/10 border-blue-700/20" },
  instagram: { abbr: "IG", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
  facebook: { abbr: "FB", color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
};

const statusConfig: Record<PostStatus, { label: string; className: string }> = {
  scheduled: {
    label: "Scheduled",
    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  published: {
    label: "Published",
    className: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

const mediaTypeLabel: Record<MediaType, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
};

export function ScheduledPostCard({
  platform,
  scheduledTime,
  status,
  content,
  mediaType = "text",
}: ScheduledPostCardProps) {
  const pConfig = platformConfig[platform];
  const sConfig = statusConfig[status];

  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold",
                pConfig.bg,
                pConfig.color,
              )}
            >
              {pConfig.abbr}
            </div>
            <div>
              <p className={cn("text-sm font-semibold capitalize", pConfig.color)}>{platform}</p>
              <p className="text-xs text-zinc-500">{scheduledTime}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {mediaType !== "text" && (
              <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
                {mediaTypeLabel[mediaType]}
              </Badge>
            )}
            <Badge variant="outline" className={cn("text-xs", sConfig.className)}>
              {sConfig.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-sm text-zinc-300 line-clamp-3 leading-relaxed">{content}</p>
      </CardContent>
    </Card>
  );
}
