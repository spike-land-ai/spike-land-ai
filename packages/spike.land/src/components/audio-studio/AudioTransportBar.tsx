"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Circle, Pause, Play, Square } from "lucide-react";

interface AudioTransportBarProps {
  currentTime: string;
  totalTime: string;
  isPlaying: boolean;
  isRecording: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onRecord?: () => void;
}

export function AudioTransportBar({
  currentTime,
  totalTime,
  isPlaying,
  isRecording,
  onPlay,
  onPause,
  onStop,
  onRecord,
}: AudioTransportBarProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9 rounded-md",
            isPlaying
              ? "text-green-400 bg-green-500/10 hover:bg-green-500/20"
              : "text-zinc-400 hover:text-zinc-100",
          )}
          onClick={isPlaying ? onPause : onPlay}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-md text-zinc-400 hover:text-zinc-100"
          onClick={onStop}
          aria-label="Stop"
        >
          <Square className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9 rounded-md",
            isRecording
              ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
              : "text-zinc-400 hover:text-zinc-100",
          )}
          onClick={onRecord}
          aria-label={isRecording ? "Stop recording" : "Record"}
          aria-pressed={isRecording}
        >
          <Circle className={cn("h-4 w-4", isRecording && "fill-red-400 animate-pulse")} />
        </Button>
      </div>

      <div
        className="font-mono text-sm text-zinc-100 tabular-nums"
        aria-label={`Current time: ${currentTime} of ${totalTime}`}
      >
        <span>{currentTime}</span>
        <span className="text-zinc-600 mx-1">/</span>
        <span className="text-zinc-500">{totalTime}</span>
      </div>

      {isRecording && (
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
          <span className="text-xs text-red-400 font-medium">REC</span>
        </div>
      )}
    </div>
  );
}
