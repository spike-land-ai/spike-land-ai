/**
 * TimelineTrack Component - Individual track block on the timeline
 * Draggable, shows waveform, click to select
 * Supports edge trimming by dragging left/right handles
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioTrack } from "../../types";

interface TimelineTrackProps {
  track: AudioTrack;
  zoom: number;
  isSelected: boolean;
  playheadTime: number;
  snapTime: (time: number) => number;
  onPositionChange: (position: number) => void;
  onTrimChange?: ((trimStart: number, trimEnd: number) => void) | undefined;
  onSelect: () => void;
  onClickPlay?: (() => void) | undefined;
}

const TRACK_HEIGHT = 64;
const TRACK_COLORS = [
  "bg-blue-600",
  "bg-green-600",
  "bg-purple-600",
  "bg-orange-600",
  "bg-pink-600",
  "bg-cyan-600",
  "bg-yellow-600",
  "bg-red-600",
];

// Get RGB values from track color class
const COLOR_MAP: Record<string, string> = {
  "bg-blue-600": "0, 229, 255", // Pixel Cyan
  "bg-green-600": "16, 185, 129",
  "bg-purple-600": "168, 85, 247",
  "bg-orange-600": "249, 115, 22",
  "bg-pink-600": "236, 72, 153",
  "bg-cyan-600": "6, 182, 212",
  "bg-yellow-600": "234, 179, 8",
  "bg-red-600": "239, 68, 68",
};

/**
 * Draw the static (unplayed) waveform — called only when waveform data, zoom, or trim changes.
 * Returns the ImageData for fast restoration on each frame.
 */
function drawStaticWaveform(
  canvas: HTMLCanvasElement,
  waveformData: number[],
  trackColor: string,
  trimStart: number,
  trimEnd: number,
  duration: number,
): ImageData | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  if (waveformData.length === 0) return null;

  const startRatio = Math.max(0, trimStart) / duration;
  const endRatio = (trimEnd > 0 ? trimEnd : duration) / duration;
  const visibleDataLength = Math.floor(waveformData.length * (endRatio - startRatio));
  const dataOffset = Math.floor(waveformData.length * startRatio);

  const barCount = Math.min(visibleDataLength, Math.floor(width / 3));
  if (barCount === 0) return null;

  const step = visibleDataLength / barCount;
  const barWidth = Math.max(1, width / barCount - 1);
  const rgb = COLOR_MAP[trackColor] || "0, 229, 255";

  for (let i = 0; i < barCount; i++) {
    const dataIndex = dataOffset + Math.floor(i * step);
    const value = waveformData[dataIndex] || 0;
    const barHeight = Math.max(2, value * height * 0.9);
    const x = i * (barWidth + 1);
    const y = (height - barHeight) / 2;

    const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
    gradient.addColorStop(0, `rgba(${rgb}, 0.3)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0.15)`);
    ctx.fillStyle = gradient;

    const radius = barWidth / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, radius);
    ctx.fill();
  }

  return ctx.getImageData(0, 0, width, height);
}

/**
 * Draw the progress overlay on top of the cached static waveform.
 * Uses `source-atop` compositing so the highlight only paints over existing waveform pixels.
 */
function drawProgressOverlay(
  canvas: HTMLCanvasElement,
  cachedImage: ImageData,
  progress: number,
  trackColor: string,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height } = canvas;
  const rgb = COLOR_MAP[trackColor] || "0, 229, 255";

  // Restore the cached static waveform
  ctx.putImageData(cachedImage, 0, 0);

  if (progress <= 0) return;

  // Draw played highlight using source-atop — only fills where waveform pixels exist
  const progressX = Math.floor(progress * width);
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, `rgba(${rgb}, 1)`);
  gradient.addColorStop(1, `rgba(${rgb}, 0.6)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, progressX, height);

  // Add glow effect for played region
  ctx.shadowBlur = 10;
  ctx.shadowColor = `rgba(${rgb}, 0.5)`;
  ctx.fillRect(0, 0, progressX, height);

  ctx.restore();
}

type DragMode = "move" | "trim-start" | "trim-end" | null;

export function TimelineTrack({
  track,
  zoom,
  isSelected,
  playheadTime,
  snapTime,
  onPositionChange,
  onTrimChange,
  onSelect,
  onClickPlay,
}: TimelineTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformCacheRef = useRef<ImageData | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [isHoveringHandle, setIsHoveringHandle] = useState<"start" | "end" | null>(null);

  // Calculate dimensions
  const effectiveTrimStart = track.trimStart;
  const effectiveTrimEnd = track.trimEnd > 0 ? track.trimEnd : track.duration;

  const silenceBefore = effectiveTrimStart < 0 ? Math.abs(effectiveTrimStart) : 0;
  const actualAudioStart = Math.max(0, effectiveTrimStart);
  const actualAudioDuration = effectiveTrimEnd - actualAudioStart;

  const totalVisualDuration = silenceBefore + actualAudioDuration;
  const trackWidth = totalVisualDuration * zoom;
  const trackLeft = (track.position ?? track.delay ?? 0) * zoom;

  const trackPosition = track.position ?? track.delay ?? 0;
  const relativeTime = playheadTime - trackPosition - silenceBefore;
  const progress = Math.max(0, Math.min(1, relativeTime / actualAudioDuration));

  const colorIndex =
    Math.abs(track.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % TRACK_COLORS.length;
  const trackColor = TRACK_COLORS[colorIndex] ?? "bg-blue-600";

  // Static effect: re-draw & cache waveform only when shape changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const audioWidth = actualAudioDuration * zoom;
    canvas.width = Math.max(1, Math.floor(audioWidth));
    canvas.height = TRACK_HEIGHT - 24;

    waveformCacheRef.current = drawStaticWaveform(
      canvas,
      track.waveformData,
      trackColor,
      actualAudioStart,
      effectiveTrimEnd,
      track.duration,
    );
  }, [
    track.waveformData,
    actualAudioDuration,
    zoom,
    trackColor,
    actualAudioStart,
    effectiveTrimEnd,
    track.duration,
  ]);

  // Progress effect: cheap overlay using cached ImageData
  useEffect(() => {
    const canvas = canvasRef.current;
    const cached = waveformCacheRef.current;
    if (!canvas || !cached) return;

    drawProgressOverlay(canvas, cached, track.isPlaying ? progress : 0, trackColor);
  }, [progress, track.isPlaying, trackColor]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, mode: DragMode) => {
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();
      onSelect();

      const mouseDownX = e.clientX;
      const mouseDownY = e.clientY;
      const savedPosition = track.position ?? track.delay ?? 0;
      const savedTrimStart = track.trimStart;
      const savedTrimEnd = track.trimEnd > 0 ? track.trimEnd : track.duration;
      let dragActivated = false;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - mouseDownX;
        const deltaY = moveEvent.clientY - mouseDownY;

        if (!dragActivated) {
          if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) < 5) return;
          dragActivated = true;
          setDragMode(mode);
        }

        const deltaTime = deltaX / zoom;

        if (mode === "move") {
          const newPosition = Math.max(0, savedPosition + deltaTime);
          const snappedPosition = snapTime(newPosition);
          onPositionChange(snappedPosition);
        } else if (mode === "trim-start" && onTrimChange) {
          const newTrimStart = savedTrimStart + deltaTime;
          const maxTrimStart = savedTrimEnd - 0.1;
          const clampedTrimStart = Math.min(newTrimStart, maxTrimStart);
          const snappedTrimStart = snapTime(clampedTrimStart);
          onTrimChange(snappedTrimStart, savedTrimEnd);
        } else if (mode === "trim-end" && onTrimChange) {
          const newTrimEnd = savedTrimEnd + deltaTime;
          const minTrimEnd = Math.max(0, savedTrimStart) + 0.1;
          const maxTrimEnd = track.duration;
          const clampedTrimEnd = Math.max(minTrimEnd, Math.min(maxTrimEnd, newTrimEnd));
          const snappedTrimEnd = snapTime(clampedTrimEnd);
          onTrimChange(savedTrimStart, snappedTrimEnd);
        }
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);

        if (!dragActivated && mode === "move" && onClickPlay) {
          onClickPlay();
        }
        setDragMode(null);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [
      track.position,
      track.delay,
      track.trimStart,
      track.trimEnd,
      track.duration,
      zoom,
      snapTime,
      onSelect,
      onPositionChange,
      onTrimChange,
      onClickPlay,
    ],
  );

  const silenceWidth = silenceBefore * zoom;

  return (
    <div
      className={`absolute rounded-xl transition-all duration-300 ${
        isSelected ? "glass-edge shadow-glow-cyan-sm z-30" : "hover:shadow-lg z-20"
      } ${track.muted ? "opacity-40 grayscale-[0.5]" : "opacity-100"}`}
      style={{
        left: `${trackLeft}px`,
        width: `${Math.max(trackWidth, 24)}px`,
        height: `${TRACK_HEIGHT}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Select track ${track.name}`}
      aria-pressed={isSelected}
    >
      {/* Selection Border Glow */}
      {isSelected && (
        <div className="absolute -inset-[2px] rounded-[14px] bg-gradient-to-r from-primary/50 to-secondary/50 -z-10 animate-pulse" />
      )}

      {/* Left trim handle */}
      {onTrimChange && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-40 group ${
            dragMode === "trim-start" ? "bg-white/20" : ""
          }`}
          onMouseDown={(e) => handleMouseDown(e, "trim-start")}
          onMouseEnter={() => setIsHoveringHandle("start")}
          onMouseLeave={() => setIsHoveringHandle(null)}
          role="slider"
          tabIndex={0}
          aria-label="Trim start handle"
          aria-valuenow={effectiveTrimStart}
        >
          <div
            className={`absolute inset-y-1.5 left-1 w-1 rounded-full transition-all ${
              isHoveringHandle === "start" || dragMode === "trim-start"
                ? "bg-white shadow-glow-cyan-sm scale-y-110"
                : "bg-white/40 group-hover:bg-white/80"
            }`}
          />
          {(isHoveringHandle === "start" || dragMode === "trim-start") && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 glass-2 border-white/10 rounded text-[10px] text-white font-mono z-50">
              {effectiveTrimStart < 0
                ? `+${(-effectiveTrimStart).toFixed(2)}s`
                : `${effectiveTrimStart.toFixed(2)}s`}
            </div>
          )}
        </div>
      )}

      {/* Right trim handle */}
      {onTrimChange && (
        <div
          className={`absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-40 group ${
            dragMode === "trim-end" ? "bg-white/20" : ""
          }`}
          onMouseDown={(e) => handleMouseDown(e, "trim-end")}
          onMouseEnter={() => setIsHoveringHandle("end")}
          onMouseLeave={() => setIsHoveringHandle(null)}
          role="slider"
          tabIndex={0}
          aria-label="Trim end handle"
          aria-valuenow={effectiveTrimEnd}
        >
          <div
            className={`absolute inset-y-1.5 right-1 w-1 rounded-full transition-all ${
              isHoveringHandle === "end" || dragMode === "trim-end"
                ? "bg-white shadow-glow-cyan-sm scale-y-110"
                : "bg-white/40 group-hover:bg-white/80"
            }`}
          />
          {(isHoveringHandle === "end" || dragMode === "trim-end") && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 glass-2 border-white/10 rounded text-[10px] text-white font-mono z-50">
              {effectiveTrimEnd.toFixed(2)}s
            </div>
          )}
        </div>
      )}

      {/* Silence region */}
      {silenceBefore > 0 && (
        <div
          className="absolute top-0 bottom-0 bg-white/5 border-r border-dashed border-white/20 overflow-hidden"
          style={{
            left: 0,
            width: `${silenceWidth}px`,
          }}
        >
          <div className="h-full flex items-center justify-center bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.05)_10px,rgba(255,255,255,0.05)_20px)]">
            <span className="text-[9px] text-white/30 font-bold uppercase tracking-tighter">
              Silence
            </span>
          </div>
        </div>
      )}

      {/* Main track content */}
      <div
        className={`absolute top-0 bottom-0 ${trackColor} glass-edge rounded-xl cursor-move shadow-inner transition-colors duration-300`}
        style={{
          left: `${silenceWidth}px`,
          right: 0,
        }}
        onMouseDown={(e) => handleMouseDown(e, "move")}
        role="button"
        tabIndex={0}
        aria-label={`Move track ${track.name}`}
      >
        <div className="h-full p-2.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-white font-bold truncate tracking-wide flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
              {track.name}
            </div>
            <div className="flex gap-1">
              {track.muted && (
                <div className="w-2 h-2 rounded-full bg-red-400/80 shadow-[0_0_5px_red]" />
              )}
              {track.solo && (
                <div className="w-2 h-2 rounded-full bg-yellow-300 shadow-[0_0_5px_yellow]" />
              )}
            </div>
          </div>

          <canvas
            ref={canvasRef}
            className="flex-1 w-full rounded-md"
            style={{ imageRendering: "auto" }}
          />
        </div>
      </div>

      {/* Playing pulse effect */}
      {track.isPlaying && (
        <div className="absolute inset-0 rounded-xl border border-white/20 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}

export { TRACK_HEIGHT };
