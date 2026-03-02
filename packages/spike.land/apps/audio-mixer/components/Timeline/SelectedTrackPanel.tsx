/**
 * SelectedTrackPanel Component - Controls panel for the currently selected track
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Headphones, Scissors, Trash2, Volume2, VolumeX } from "lucide-react";
import type { AudioTrack } from "../../types";

function formatTime(seconds: number): string {
  const mins = Math.floor(Math.abs(seconds) / 60);
  const secs = Math.abs(seconds) % 60;
  const sign = seconds < 0 ? "-" : "";
  return `${sign}${mins}:${secs.toFixed(1).padStart(4, "0")}`;
}

interface SelectedTrackPanelProps {
  track: AudioTrack | null;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
  onTrimChange: (trimStart: number, trimEnd: number) => void;
  onRemove: () => void;
}

export function SelectedTrackPanel({
  track,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onTrimChange,
  onRemove,
}: SelectedTrackPanelProps) {
  if (!track) {
    return (
      <div className="h-8 px-4 flex items-center bg-black/30 border-t border-white/5 text-gray-500 text-xs">
        Select a track to edit
      </div>
    );
  }

  const effectiveTrimEnd = track.trimEnd > 0 ? track.trimEnd : track.duration;
  const trimmedDuration = effectiveTrimEnd - track.trimStart;

  return (
    <div className="h-8 px-3 flex items-center gap-3 bg-black/30 border-t border-white/5">
      {/* Track name */}
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-bold text-white truncate max-w-[100px]">{track.name}</span>
        <span className="text-[9px] font-mono text-white/40">{formatTime(trimmedDuration)}</span>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded">
        <Volume2 className="w-3 h-3 text-primary/80" />
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(track.volume * 100)}
          onChange={(e) => onVolumeChange(parseInt(e.target.value) / 100)}
          className="w-16 h-0.5 bg-white/10 rounded appearance-none cursor-pointer accent-primary"
          aria-label="Track volume"
        />
        <span className="text-[9px] font-mono text-white/60 w-6">
          {Math.round(track.volume * 100)}%
        </span>
      </div>

      {/* Mute/Solo buttons */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onMuteToggle}
              className={cn(
                "p-1 rounded transition-all",
                track.muted
                  ? "bg-red-500/20 text-red-400"
                  : "text-gray-400 hover:text-white hover:bg-white/10",
              )}
            >
              <VolumeX className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{track.muted ? "Unmute (M)" : "Mute (M)"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onSoloToggle}
              className={cn(
                "p-1 rounded transition-all",
                track.solo
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "text-gray-400 hover:text-white hover:bg-white/10",
              )}
            >
              <Headphones className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{track.solo ? "Unsolo (S)" : "Solo (S)"}</TooltipContent>
        </Tooltip>
      </div>

      {/* Trim controls */}
      <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded">
        <Scissors className="w-3 h-3 text-primary/60" />
        <input
          type="number"
          min="-30"
          max={effectiveTrimEnd - 0.1}
          step="0.1"
          value={track.trimStart.toFixed(1)}
          onChange={(e) => onTrimChange(parseFloat(e.target.value) || 0, effectiveTrimEnd)}
          className="w-12 h-5 text-[10px] bg-black/40 text-primary font-mono rounded border border-white/5 text-center"
          aria-label="Trim start"
        />
        <span className="text-[9px] text-white/30">–</span>
        <input
          type="number"
          min={Math.max(0.1, track.trimStart + 0.1)}
          max={track.duration}
          step="0.1"
          value={effectiveTrimEnd.toFixed(1)}
          onChange={(e) =>
            onTrimChange(track.trimStart, parseFloat(e.target.value) || track.duration)
          }
          className="w-12 h-5 text-[10px] bg-black/40 text-primary font-mono rounded border border-white/5 text-center"
          aria-label="Trim end"
        />
        {track.trimStart < 0 && (
          <Badge
            variant="outline"
            className="h-4 px-1 text-[8px] bg-primary/10 text-primary border-primary/20"
          >
            +{Math.abs(track.trimStart).toFixed(1)}s
          </Badge>
        )}
      </div>

      <div className="flex-1" />

      {/* Delete button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onRemove}
            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Delete Track (Del)</TooltipContent>
      </Tooltip>
    </div>
  );
}
