/**
 * RecordingPanel Component - Audio recording controls
 * Resolves #332
 */

"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Circle, Pause, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatTime } from "../lib/audio-engine";

interface RecordingPanelProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  permissionError?: Error | null;
  onStart: () => Promise<boolean> | void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
}

export function RecordingPanel({
  isRecording,
  isPaused,
  duration,
  permissionError,
  onStart,
  onPause,
  onResume,
  onStop,
  onCancel,
}: RecordingPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Update error message when permissionError prop changes
  useEffect(() => {
    if (permissionError) {
      if (
        permissionError.name === "NotAllowedError" ||
        permissionError.name === "PermissionDeniedError"
      ) {
        setError(
          "Microphone access denied. Please allow microphone access in your browser settings (click the lock icon in the address bar).",
        );
      } else if (
        permissionError.name === "NotFoundError" ||
        permissionError.name === "DevicesNotFoundError"
      ) {
        setError("No microphone found. Please connect a microphone and try again.");
      } else if (
        permissionError.name === "NotReadableError" ||
        permissionError.name === "TrackStartError"
      ) {
        setError("Microphone is currently in use by another application.");
      } else {
        setError(`Failed to access microphone: ${permissionError.message}`);
      }

      // Temporary debug info for Chrome issues
      if (permissionError.name) {
        setError((prev) => `${prev} (${permissionError.name}: ${permissionError.message})`);
      }
    }
  }, [permissionError]);

  const handleStart = useCallback(async () => {
    setError(null);
    setIsStarting(true);
    try {
      const result = await onStart();
      if (result === false && !permissionError) {
        // Fallback generic error if hook didn't provide specific error
        setError(
          "Microphone access denied. Please allow microphone access in your browser settings.",
        );
      }
    } catch {
      setError("Failed to start recording. Please check microphone permissions.");
    } finally {
      setIsStarting(false);
    }
  }, [onStart, permissionError]);

  if (!isRecording) {
    return (
      <div className="flex flex-col gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleStart}
              disabled={isStarting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-wait text-white rounded-lg transition-colors"
            >
              <Circle className="w-4 h-4 fill-current" />
              {isStarting ? "Starting..." : "Record"}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Record (R)</TooltipContent>
        </Tooltip>
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm max-w-[250px]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 bg-gray-800 rounded-lg p-4">
      {/* Recording indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            isPaused ? "bg-yellow-500" : "bg-red-500 animate-pulse"
          }`}
        />
        <span className="text-white font-mono">{formatTime(duration)}</span>
      </div>

      {/* Pause/Resume */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={isPaused ? onResume : onPause}
            className="p-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
            aria-label={isPaused ? "Resume recording" : "Pause recording"}
          >
            {isPaused ? <Circle className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{isPaused ? "Resume" : "Pause"}</TooltipContent>
      </Tooltip>

      {/* Stop (save) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onStop}
            className="p-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            aria-label="Stop and save recording"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Stop & Save</TooltipContent>
      </Tooltip>

      {/* Cancel */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onCancel}
            className="px-3 py-1 text-gray-400 hover:text-white transition-colors"
            aria-label="Cancel recording"
          >
            Cancel
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Cancel Recording</TooltipContent>
      </Tooltip>
    </div>
  );
}
