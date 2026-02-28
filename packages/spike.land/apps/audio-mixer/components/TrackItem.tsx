/**
 * TrackItem Component - Individual track controls
 * Resolves #332
 */

"use client";

import {
  Clock,
  Mic,
  Pause,
  Play,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { formatTime } from "../lib/audio-engine";
import type { AudioTrack } from "../types";
import { Waveform } from "./Waveform";

interface TrackItemProps {
  track: AudioTrack;
  onPlay: () => void;
  onStop: () => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
  onRemove: () => void;
  onSeek?: ((progress: number) => void) | undefined;
  onDelayChange?: ((delay: number) => void) | undefined;
  onTrimChange?: ((trimStart: number, trimEnd: number) => void) | undefined;
}

export function TrackItem({
  track,
  onPlay,
  onStop,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onRemove,
  onSeek,
  onDelayChange,
  onTrimChange,
}: TrackItemProps) {
  const progress = track.duration > 0 ? track.currentTime / track.duration : 0;

  // Calculate effective duration considering trim
  const effectiveTrimEnd = track.trimEnd > 0 ? track.trimEnd : track.duration;
  const trimmedDuration = Math.max(0, effectiveTrimEnd - track.trimStart);

  // Normalize trim values to 0-1 for waveform display
  const normalizedTrimStart = track.duration > 0
    ? track.trimStart / track.duration
    : 0;
  const normalizedTrimEnd = track.duration > 0
    ? effectiveTrimEnd / track.duration
    : 1;

  const handleTrimStartChange = (normalizedValue: number) => {
    const trimStartSeconds = normalizedValue * track.duration;
    onTrimChange?.(trimStartSeconds, effectiveTrimEnd);
  };

  const handleTrimEndChange = (normalizedValue: number) => {
    const trimEndSeconds = normalizedValue * track.duration;
    onTrimChange?.(track.trimStart, trimEndSeconds);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      {/* Track Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {track.type === "recording" && <Mic className="w-4 h-4 text-red-400" />}
          <span className="text-white font-medium truncate max-w-[200px]">
            {track.name}
          </span>
          <span className="text-gray-400 text-sm">
            {trimmedDuration !== track.duration
              ? (
                <>
                  {formatTime(trimmedDuration)}
                  <span className="text-gray-500 ml-1">
                    (from {formatTime(track.duration)})
                  </span>
                </>
              )
              : (
                formatTime(track.duration)
              )}
          </span>
          {track.delay !== 0 && (
            <span className="text-blue-400 text-sm">
              {track.delay > 0
                ? `+${track.delay.toFixed(1)}s`
                : `${track.delay.toFixed(1)}s`}
            </span>
          )}
        </div>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-400 transition-colors p-1"
          aria-label="Remove track"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Waveform */}
      <div className="bg-gray-900 rounded p-2">
        <Waveform
          data={track.waveformData}
          progress={progress}
          width={400}
          height={50}
          barColor={track.muted ? "#374151" : "#4b5563"}
          progressColor={track.muted ? "#6b7280" : "#3b82f6"}
          onClick={onSeek}
          trimStart={normalizedTrimStart}
          trimEnd={normalizedTrimEnd}
          onTrimStartChange={onTrimChange ? handleTrimStartChange : undefined}
          onTrimEndChange={onTrimChange ? handleTrimEndChange : undefined}
          showTrimHandles={!!onTrimChange}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Play/Stop */}
        <button
          onClick={track.isPlaying ? onStop : onPlay}
          className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          aria-label={track.isPlaying ? "Stop" : "Play"}
        >
          {track.isPlaying
            ? <Pause className="w-4 h-4" />
            : <Play className="w-4 h-4" />}
        </button>

        {/* Mute/Unmute */}
        <button
          onClick={onMuteToggle}
          className={`p-2 rounded transition-colors ${
            track.muted
              ? "bg-red-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          aria-label={track.muted ? "Unmute" : "Mute"}
        >
          {track.muted
            ? <VolumeX className="w-4 h-4" />
            : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Solo */}
        <button
          onClick={onSoloToggle}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            track.solo
              ? "bg-yellow-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          aria-label={track.solo ? "Disable solo" : "Enable solo"}
        >
          S
        </button>

        {/* Volume Slider */}
        <div className="flex items-center gap-2 flex-1">
          <Volume2 className="w-4 h-4 text-gray-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={track.volume}
            onChange={e => onVolumeChange(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            aria-label="Track volume"
          />
          <span className="text-gray-400 text-sm w-10 text-right">
            {Math.round(track.volume * 100)}%
          </span>
        </div>

        {/* Delay Slider */}
        {onDelayChange && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <input
              type="range"
              min="-5"
              max="10"
              step="0.1"
              value={track.delay}
              onChange={e => onDelayChange(parseFloat(e.target.value))}
              className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              aria-label="Track delay"
            />
            <span className="text-gray-400 text-sm w-12 text-right">
              {track.delay > 0
                ? `+${track.delay.toFixed(1)}`
                : track.delay.toFixed(1)}s
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
