"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Sentiment = "positive" | "neutral" | "negative";

interface BrandCompetitorCardProps {
  name: string;
  marketShare: number;
  sentiment: Sentiment;
  topKeyword: string;
  logoInitial: string;
}

const sentimentConfig: Record<Sentiment, { label: string; badgeClass: string; barClass: string }> =
  {
    positive: {
      label: "Positive",
      badgeClass: "bg-green-500/10 text-green-400 border-green-500/20",
      barClass: "bg-green-400",
    },
    neutral: {
      label: "Neutral",
      badgeClass: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      barClass: "bg-zinc-400",
    },
    negative: {
      label: "Negative",
      badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
      barClass: "bg-red-400",
    },
  };

export function BrandCompetitorCard({
  name,
  marketShare,
  sentiment,
  topKeyword,
  logoInitial,
}: BrandCompetitorCardProps) {
  const config = sentimentConfig[sentiment];
  const clampedShare = Math.max(0, Math.min(100, marketShare));

  return (
    <Card className="bg-zinc-900 border-zinc-800 h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <span className="text-sm font-bold text-zinc-200 uppercase">{logoInitial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">{name}</p>
            <Badge variant="outline" className={cn("text-xs mt-0.5", config.badgeClass)}>
              {config.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Market share bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Market Share</span>
            <span className="font-mono text-zinc-300">{clampedShare}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-700 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", config.barClass)}
              style={{ width: `${clampedShare}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>Top keyword:</span>
          <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
            {topKeyword}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
