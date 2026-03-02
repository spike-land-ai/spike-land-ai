/**
 * Waveform Component - Visual display of audio waveform with trim handles
 * Resolves #332
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawWaveform } from "../lib/audio-engine";
import type { WaveformOptions } from "../types";

interface WaveformProps {
  data: number[];
  progress: number;
  width?: number | undefined;
  height?: number | undefined;
  barColor?: string | undefined;
  progressColor?: string | undefined;
  onClick?: ((progress: number) => void) | undefined;
  /** Trim start point (0-1 normalized) */
  trimStart?: number | undefined;
  /** Trim end point (0-1 normalized) */
  trimEnd?: number | undefined;
  /** Callback when trim start changes */
  onTrimStartChange?: ((value: number) => void) | undefined;
  /** Callback when trim end changes */
  onTrimEndChange?: ((value: number) => void) | undefined;
  /** Show trim handles */
  showTrimHandles?: boolean | undefined;
}

export function Waveform({
  data,
  progress,
  width = 300,
  height = 60,
  barColor = "#4b5563",
  progressColor = "#3b82f6",
  onClick,
  trimStart = 0,
  trimEnd = 1,
  onTrimStartChange,
  onTrimEndChange,
  showTrimHandles = false,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const options: WaveformOptions = {
      width,
      height,
      barWidth: Math.max(2, Math.floor(width / data.length) - 1),
      barGap: 1,
      barColor,
      progressColor,
    };

    drawWaveform(canvas, data, progress, options);
  }, [data, progress, width, height, barColor, progressColor]);

  const calculatePosition = useCallback(
    (clientX: number): number => {
      const container = containerRef.current;
      if (!container) return 0;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      return Math.max(0, Math.min(1, x / width));
    },
    [width],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const pos = calculatePosition(e.clientX);

      if (isDraggingStart && onTrimStartChange) {
        // Ensure start doesn't go past end - 1%
        const maxStart = (trimEnd || 1) - 0.01;
        onTrimStartChange(Math.min(pos, maxStart));
      }
      if (isDraggingEnd && onTrimEndChange) {
        // Ensure end doesn't go before start + 1%
        const minEnd = (trimStart || 0) + 0.01;
        onTrimEndChange(Math.max(pos, minEnd));
      }
    },
    [
      isDraggingStart,
      isDraggingEnd,
      trimStart,
      trimEnd,
      onTrimStartChange,
      onTrimEndChange,
      calculatePosition,
    ],
  );

  const handleMouseUp = useCallback(() => {
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
  }, []);

  useEffect(() => {
    if (isDraggingStart || isDraggingEnd) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
    return undefined;
  }, [isDraggingStart, isDraggingEnd, handleMouseMove, handleMouseUp]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Don't trigger click when dragging trim handles
    if (isDraggingStart || isDraggingEnd) return;
    if (!onClick || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickProgress = x / width;
    onClick(Math.max(0, Math.min(1, clickProgress)));
  };

  const handleStartMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingStart(true);
  };

  const handleEndMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEnd(true);
  };

  return (
    <div ref={containerRef} className="relative" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleClick}
        className={onClick ? "cursor-pointer" : ""}
        aria-label="Audio waveform visualization"
      />

      {showTrimHandles && (
        <>
          {/* Dimmed region before trim start */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-black/50 pointer-events-none"
            style={{ width: `${trimStart * 100}%` }}
          />

          {/* Dimmed region after trim end */}
          <div
            className="absolute top-0 bottom-0 right-0 bg-black/50 pointer-events-none"
            style={{ width: `${(1 - trimEnd) * 100}%` }}
          />

          {/* Trim start handle */}
          <div
            className={`absolute top-0 bottom-0 w-2 bg-yellow-500 cursor-ew-resize hover:bg-yellow-400 transition-colors ${
              isDraggingStart ? "bg-yellow-400" : ""
            }`}
            style={{ left: `calc(${trimStart * 100}% - 4px)` }}
            onMouseDown={handleStartMouseDown}
            aria-label="Trim start handle"
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(trimStart * 100)}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-4 bg-yellow-700 rounded" />
          </div>

          {/* Trim end handle */}
          <div
            className={`absolute top-0 bottom-0 w-2 bg-yellow-500 cursor-ew-resize hover:bg-yellow-400 transition-colors ${
              isDraggingEnd ? "bg-yellow-400" : ""
            }`}
            style={{ left: `calc(${trimEnd * 100}% - 4px)` }}
            onMouseDown={handleEndMouseDown}
            aria-label="Trim end handle"
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(trimEnd * 100)}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-4 bg-yellow-700 rounded" />
          </div>
        </>
      )}
    </div>
  );
}
