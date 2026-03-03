"use client";

import { Badge } from "@/components/ui/badge";
import { type MixHistoryItem, useMixHistory } from "@/hooks/useMixHistory";
import { cn } from "@/lib/utils";
import { ArrowRight, Loader2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo } from "react";

const tierLabels: Record<string, string> = {
  TIER_1K: "1K",
  TIER_2K: "2K",
  TIER_4K: "4K",
  FREE: "Free",
};

const tierStyles: Record<string, string> = {
  TIER_1K: "bg-green-500/20 text-green-400 border-green-500/30",
  TIER_2K: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  TIER_4K: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  FREE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

interface MixHistoryProps {
  onMixClick?: (mix: MixHistoryItem) => void;
  activeMix?: MixHistoryItem | null;
}

export function MixHistory({ onMixClick, activeMix }: MixHistoryProps) {
  const { mixes, isLoading, error, refetch } = useMixHistory(20);

  const displayMixes = useMemo(() => {
    if (activeMix) {
      // Avoid duplicates if the active mix is already in the list
      const filtered = mixes.filter(m => m.id !== activeMix.id);
      return [activeMix, ...filtered];
    }
    return mixes;
  }, [mixes, activeMix]);

  const handleMixClick = useCallback(
    (mix: MixHistoryItem) => {
      onMixClick?.(mix);
    },
    [onMixClick],
  );

  if (isLoading && !activeMix) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white/80">History</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error && !activeMix && mixes.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white/80">History</h3>
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm text-primary hover:underline mt-2"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (displayMixes.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white/80">History</h3>
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            No mixes yet. Create your first blend above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-white/80 pl-1">History</h3>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
        {displayMixes.map(mix => (
          <button
            key={mix.id}
            type="button"
            onClick={() => handleMixClick(mix)}
            className={cn(
              "flex-shrink-0 rounded-xl overflow-hidden group",
              "border hover:border-primary/50",
              "transition-all focus:outline-none focus:ring-2 focus:ring-primary",
              "bg-black/40 backdrop-blur-sm",
              mix.id === activeMix?.id
                ? "border-primary/50 ring-1 ring-primary/20"
                : "border-white/10",
            )}
          >
            <div className="flex items-center gap-1.5 p-2.5">
              {/* Source 1 thumbnail */}
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                {mix.targetImage
                  ? (
                    <Image
                      src={mix.targetImage.url}
                      alt={mix.targetImage.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  )
                  : <div className="absolute inset-0 bg-white/5" />}
              </div>

              {/* Arrow */}
              <ArrowRight className="h-3 w-3 text-white/20 flex-shrink-0" />

              {/* Source 2 thumbnail */}
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                {mix.sourceImage
                  ? (
                    <Image
                      src={mix.sourceImage.url}
                      alt={mix.sourceImage.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  )
                  : <div className="absolute inset-0 bg-white/5" />}
              </div>

              {/* Result thumbnail */}
              <span className="text-white/20 mx-0.5">=</span>
              <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-white/5 border border-white/10 shadow-inner">
                {mix.resultUrl
                  ? (
                    <Image
                      src={mix.resultUrl}
                      alt="Mix result"
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  )
                  : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      {/* Pulse Cyan Animation */}
                      <div className="w-full h-full animate-pulse-cyan bg-cyan-500/20" />
                    </div>
                  )}
              </div>
            </div>

            {/* Footer with date and tier */}
            <div className="px-2.5 pb-2.5 flex items-center justify-between gap-2">
              <span className="text-[10px] text-white/40 font-medium">
                {new Date(mix.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] h-4 px-1 border tracking-wider font-normal",
                  tierStyles[mix.tier],
                )}
              >
                {tierLabels[mix.tier] || mix.tier}
              </Badge>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
