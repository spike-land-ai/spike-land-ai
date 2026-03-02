"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContentStatusBadge } from "./ContentStatusBadge";
import type { ContentStatus } from "./types";

interface ContentPostCardProps {
  title: string;
  excerpt: string;
  status: ContentStatus;
  publishDate?: string;
  author: string;
  category: string;
  readTime?: string;
}

export function ContentPostCard({
  title,
  excerpt,
  status,
  publishDate,
  author,
  category,
  readTime,
}: ContentPostCardProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
            {category}
          </Badge>
          <ContentStatusBadge status={status} />
        </div>
        <CardTitle className="text-lg text-zinc-100 line-clamp-2">{title}</CardTitle>
        <CardDescription className="text-zinc-400 line-clamp-3">{excerpt}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>{author}</span>
          <div className="flex items-center gap-3">
            {readTime && <span>{readTime}</span>}
            {publishDate && <span>{publishDate}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
