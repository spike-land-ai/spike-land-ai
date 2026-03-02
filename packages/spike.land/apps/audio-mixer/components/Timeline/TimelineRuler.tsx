/**
 * TimelineRuler Component - Time markers above the timeline tracks
 */

"use client";

import { useMemo } from "react";

interface TimelineRulerProps {
  zoom: number;
  duration: number;
  onSeek?: (time: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getMarkInterval(zoom: number): number {
  // Adjust mark interval based on zoom level
  // Higher zoom = more detailed marks
  if (zoom >= 150) return 0.5; // Every 0.5 seconds when very zoomed in
  if (zoom >= 100) return 1; // Every second
  if (zoom >= 50) return 2; // Every 2 seconds
  if (zoom >= 25) return 5; // Every 5 seconds
  return 10; // Every 10 seconds when zoomed out
}

export function TimelineRuler({ zoom, duration, onSeek }: TimelineRulerProps) {
  const markInterval = getMarkInterval(zoom);

  const marks = useMemo(() => {
    const result: { time: number; isMajor: boolean }[] = [];
    const totalMarks = Math.ceil(duration / markInterval) + 1;

    for (let i = 0; i <= totalMarks; i++) {
      const time = i * markInterval;
      if (time > duration + markInterval) break;

      // Major marks at even intervals (every 5th or 10th mark depending on interval)
      const majorInterval = markInterval <= 1 ? 5 : 2;
      const isMajor = i % majorInterval === 0;

      result.push({ time, isMajor });
    }

    return result;
  }, [duration, markInterval]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / zoom;
    onSeek(Math.max(0, time));
  };

  const width = Math.max(duration * zoom + 100, 500); // Min 500px width

  return (
    <div
      className="relative h-7 bg-black/40 border-b border-white/5 cursor-pointer select-none overflow-hidden"
      style={{ width: `${width}px` }}
      onClick={handleClick}
      onKeyDown={(e) =>
        e.key === "Enter" && handleClick(e as unknown as React.MouseEvent<HTMLDivElement>)
      }
      role="slider"
      tabIndex={0}
      aria-label="Timeline ruler - click to seek"
      aria-valuenow={0}
      aria-valuemin={0}
      aria-valuemax={duration}
    >
      {marks.map(({ time, isMajor }) => (
        <div
          key={time}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${time * zoom}px` }}
        >
          {/* Time label (only for major marks) */}
          {isMajor && (
            <span className="text-[10px] font-mono font-bold text-white/40 mb-1">
              {formatTime(time)}
            </span>
          )}
          {/* Tick mark */}
          <div
            className={`w-px transition-colors duration-300 ${
              isMajor ? "h-4 bg-white/40" : "h-2 bg-white/10"
            }`}
            style={{ marginTop: isMajor ? 0 : "6px" }}
          />
        </div>
      ))}
    </div>
  );
}
