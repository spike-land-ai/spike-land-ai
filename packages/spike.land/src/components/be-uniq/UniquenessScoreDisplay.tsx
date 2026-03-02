"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface UniquenessScoreDisplayProps {
  score: number;
  category: string;
  description: string;
  isRevealing?: boolean;
}

export function UniquenessScoreDisplay({
  score,
  category,
  description,
  isRevealing = false,
}: UniquenessScoreDisplayProps) {
  const formattedScore = score.toLocaleString();

  return (
    <Card className="bg-zinc-900 border-zinc-800 w-full overflow-hidden">
      <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
        <Badge
          variant="outline"
          className="text-xs text-violet-400 border-violet-500/40 bg-violet-500/10"
        >
          {category}
        </Badge>

        <div
          className={cn("space-y-1 transition-all duration-700", isRevealing && "animate-pulse")}
        >
          <p className="text-sm text-zinc-500 uppercase tracking-widest font-mono">You are</p>
          <p className="text-5xl md:text-6xl font-bold text-zinc-100 font-mono leading-none">
            1 in {formattedScore}
          </p>
          <p className="text-sm text-zinc-500">people</p>
        </div>

        <p className="text-zinc-400 text-sm max-w-xs leading-relaxed">{description}</p>

        <div className="w-full h-px bg-zinc-800 mt-2" />

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-xs text-zinc-500">
            Rarer than {Math.round((1 / score) * 100 * 10000) / 100}% of the population
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
