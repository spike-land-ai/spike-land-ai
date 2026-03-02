"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "professional" | "casual" | "bold" | "playful";

interface BrandCopyCardProps {
  headline: string;
  body: string;
  tone: Tone;
  platform: string;
  characterCount: number;
}

const toneConfig: Record<Tone, { label: string; badgeClass: string }> = {
  professional: {
    label: "Professional",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  casual: {
    label: "Casual",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  bold: {
    label: "Bold",
    badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  playful: {
    label: "Playful",
    badgeClass: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  },
};

export function BrandCopyCard({
  headline,
  body,
  tone,
  platform,
  characterCount,
}: BrandCopyCardProps) {
  const config = toneConfig[tone];
  return (
    <Card className="bg-zinc-900 border-zinc-800 h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-xs", config.badgeClass)}>
            {config.label}
          </Badge>
          <span className="text-xs text-zinc-500">{platform}</span>
        </div>
        <p className="text-base font-semibold text-zinc-100 mt-2 leading-snug">{headline}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
        <div className="flex items-center justify-end">
          <span className="text-xs text-zinc-600 font-mono">{characterCount} chars</span>
        </div>
      </CardContent>
    </Card>
  );
}
