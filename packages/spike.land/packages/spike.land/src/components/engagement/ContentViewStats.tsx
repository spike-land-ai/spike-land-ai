"use client";

import { Eye, Users } from "lucide-react";
import { useEffect, useState } from "react";

interface ContentViewStatsProps {
  /** The URL path to fetch stats for, e.g. "/blog/my-post" */
  path: string;
  /** Compact mode shows only icons, no labels. Default: false */
  compact?: boolean;
}

interface ViewStats {
  totalViews: number;
  uniqueVisitors: number;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Client component that displays total page views and unique visitors
 * for a given URL path. Fetches stats from /api/content/stats.
 */
export function ContentViewStats(
  { path, compact = false }: ContentViewStatsProps,
) {
  const [stats, setStats] = useState<ViewStats | null>(null);

  useEffect(() => {
    fetch(`/api/content/stats?path=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then((data: ViewStats) => setStats(data))
      .catch(() => {
        /* silently fail — stats are non-critical */
      });
  }, [path]);

  if (!stats) {
    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground/50">
        <span className="animate-pulse">···</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 text-xs font-medium text-muted-foreground"
      aria-label={`${stats.totalViews} views, ${stats.uniqueVisitors} unique visitors`}
    >
      <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded-full">
        <Eye className="h-3 w-3" aria-hidden="true" />
        <span className="tabular-nums">{formatCount(stats.totalViews)}</span>
        {!compact && <span className="hidden sm:inline">views</span>}
      </div>
      <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded-full">
        <Users className="h-3 w-3" aria-hidden="true" />
        <span className="tabular-nums">
          {formatCount(stats.uniqueVisitors)}
        </span>
        {!compact && <span className="hidden sm:inline">visitors</span>}
      </div>
    </div>
  );
}
