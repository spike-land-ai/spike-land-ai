"use client";

import { Eye, Heart, MessageSquare, Share2 } from "lucide-react";

interface ContentMetricsRowProps {
  views: number;
  comments: number;
  shares: number;
  likes?: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

interface MetricItemProps {
  icon: React.ReactNode;
  value: number;
  label: string;
}

function MetricItem({ icon, value, label }: MetricItemProps) {
  return (
    <div className="flex items-center gap-1.5 text-zinc-400" aria-label={`${value} ${label}`}>
      <span className="text-zinc-500">{icon}</span>
      <span className="text-sm font-mono font-medium text-zinc-300">
        {formatNumber(value)}
      </span>
      <span className="text-xs text-zinc-500 hidden sm:inline">{label}</span>
    </div>
  );
}

export function ContentMetricsRow({
  views,
  comments,
  shares,
  likes,
}: ContentMetricsRowProps) {
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <MetricItem
        icon={<Eye className="h-4 w-4" />}
        value={views}
        label="views"
      />
      <MetricItem
        icon={<MessageSquare className="h-4 w-4" />}
        value={comments}
        label="comments"
      />
      <MetricItem
        icon={<Share2 className="h-4 w-4" />}
        value={shares}
        label="shares"
      />
      {likes !== undefined && (
        <MetricItem
          icon={<Heart className="h-4 w-4" />}
          value={likes}
          label="likes"
        />
      )}
    </div>
  );
}
