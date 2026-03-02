"use client";

import { ExternalLink, Eye } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AppCard } from "./app-card";
import { LiveAppPreview } from "./live-app-preview";

interface LiveAppCardProps {
  title: string;
  description: string;
  slug: string;
  codespaceId?: string | null;
  viewCount?: number;
}

export function LiveAppCard({
  title,
  description,
  slug,
  codespaceId,
  viewCount,
}: LiveAppCardProps) {
  const [isHealthy, setIsHealthy] = useState(true);

  if (!codespaceId || !isHealthy) {
    return <AppCard title={title} description={description} slug={slug} viewCount={viewCount} />;
  }

  return (
    <Link
      href={`/create/${slug}`}
      className="block rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-zinc-700 shadow-sm"
      style={{ viewTransitionName: `app-card-${slug}` }}
    >
      {/* Live preview — 4:3 aspect ratio, no pointer events */}
      <div className="relative aspect-[4/3] overflow-hidden pointer-events-none bg-zinc-950">
        <LiveAppPreview
          codespaceId={codespaceId}
          scale={0.35}
          className="w-full h-full"
          fallbackTitle={title}
          onHealthStatus={setIsHealthy}
        />
        {/* Subtle top-edge vignette to ground the preview in the card */}
        <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-zinc-900/60 to-transparent" />
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* Metadata row */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
        <h3 className="text-zinc-100 font-semibold text-base leading-snug truncate">{title}</h3>
        <ExternalLink className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
      </div>

      {/* Description + view count */}
      <div className="px-4 pb-4">
        <p className="text-zinc-400 text-sm line-clamp-2 leading-relaxed">{description}</p>
        {viewCount !== undefined && (
          <span className="inline-flex items-center gap-1 text-zinc-500 text-xs mt-2">
            <Eye className="w-3 h-3" />
            {viewCount.toLocaleString()}
          </span>
        )}
      </div>
    </Link>
  );
}
