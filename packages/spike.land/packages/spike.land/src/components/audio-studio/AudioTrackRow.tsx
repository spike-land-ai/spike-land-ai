"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

export interface AudioTrack {
  id: string;
  name: string;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  color: string;
}

interface AudioTrackRowProps {
  track: AudioTrack;
  onMuteToggle: (id: string) => void;
  onSoloToggle: (id: string) => void;
}

export function AudioTrackRow({
  track,
  onMuteToggle,
  onSoloToggle,
}: AudioTrackRowProps) {
  const effectiveVolume = track.isMuted ? 0 : track.volume;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
      <div
        className="w-1.5 h-10 rounded-full shrink-0"
        style={{ backgroundColor: track.color }}
        aria-hidden="true"
      />

      <div className="w-28 shrink-0">
        <span className="text-sm font-medium text-zinc-100 truncate block">
          {track.name}
        </span>
        <span className="text-xs text-zinc-500">{track.volume}%</span>
      </div>

      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${effectiveVolume}%`,
              backgroundColor: track.isMuted ? "#52525b" : track.color,
            }}
            role="progressbar"
            aria-valuenow={effectiveVolume}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${track.name} volume: ${effectiveVolume}%`}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-md",
            track.isMuted
              ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
              : "text-zinc-400 hover:text-zinc-100",
          )}
          onClick={() => onMuteToggle(track.id)}
          aria-label={track.isMuted ? `Unmute ${track.name}` : `Mute ${track.name}`}
          aria-pressed={track.isMuted}
        >
          {track.isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-md",
            track.isSolo
              ? "text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20"
              : "text-zinc-400 hover:text-zinc-100",
          )}
          onClick={() => onSoloToggle(track.id)}
          aria-label={track.isSolo ? `Unsolo ${track.name}` : `Solo ${track.name}`}
          aria-pressed={track.isSolo}
        >
          {track.isSolo ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>

        {track.isSolo && (
          <Badge
            variant="outline"
            className="text-xs text-yellow-400 border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0"
          >
            S
          </Badge>
        )}
      </div>
    </div>
  );
}
