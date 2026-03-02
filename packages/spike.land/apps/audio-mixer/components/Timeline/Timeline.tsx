/**
 * Timeline Component - Main timeline container with tracks, ruler, and playhead
 */

"use client";

import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { AudioTrack, SnapGrid } from "../../types";
import { Playhead } from "./Playhead";
import { SelectedTrackPanel } from "./SelectedTrackPanel";
import { TimelineControls } from "./TimelineControls";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineTrack, TRACK_HEIGHT } from "./TimelineTrack";

interface TimelineProps {
  tracks: AudioTrack[];
  playheadTime: number;
  isPlaying: boolean;
  zoom: number;
  snapEnabled: boolean;
  snapGrid: SnapGrid;
  selectedTrackId: string | null;
  onTrackPositionChange: (trackId: string, position: number) => void;
  onPlayheadSeek: (time: number) => void;
  onZoomChange: (zoom: number) => void;
  onSnapToggle: (enabled: boolean) => void;
  onSnapGridChange: (grid: SnapGrid) => void;
  onSelectTrack: (trackId: string | null) => void;
  onVolumeChange: (trackId: string, volume: number) => void;
  onMuteToggle: (trackId: string) => void;
  onSoloToggle: (trackId: string) => void;
  onTrimChange: (trackId: string, trimStart: number, trimEnd: number) => void;
  onRemoveTrack: (trackId: string) => void;
  onScrubAudio?: (time: number) => void;
  onSoloPreview?: (trackId: string) => void;
  onCrossProjectDrop?: (sourceProjectId: string, trackId: string, position: number) => void;
  // Recording preview
  isRecording?: boolean;
  recordingDuration?: number;
  recordingStartPosition?: number;
}

const TRACK_ROW_HEIGHT = TRACK_HEIGHT + 8; // Track height + margin

export function Timeline({
  tracks,
  playheadTime,
  isPlaying,
  zoom,
  snapEnabled,
  snapGrid,
  selectedTrackId,
  onTrackPositionChange,
  onPlayheadSeek,
  onZoomChange,
  onSnapToggle,
  onSnapGridChange,
  onSelectTrack,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onTrimChange,
  onRemoveTrack,
  onScrubAudio,
  onSoloPreview,
  onCrossProjectDrop,
  isRecording = false,
  recordingDuration = 0,
  recordingStartPosition = 0,
}: TimelineProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const isScrubbing = useRef(false);
  const scrubStartX = useRef(0);
  const scrubStartTime = useRef(0);

  // Cross-project drag and drop handlers
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!onCrossProjectDrop) return;
      if (e.dataTransfer.types.includes("application/x-audio-track")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    },
    [onCrossProjectDrop],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!onCrossProjectDrop) return;
      const data = e.dataTransfer.getData("application/x-audio-track");
      if (!data) return;

      e.preventDefault();
      try {
        const { sourceProjectId, trackId } = JSON.parse(data);
        const rect = e.currentTarget.getBoundingClientRect();
        const scrollLeft = viewportRef.current?.scrollLeft || 0;
        const x = e.clientX - rect.left + scrollLeft;
        const position = Math.max(0, x / zoom);
        onCrossProjectDrop(sourceProjectId, trackId, position);
      } catch {
        // Invalid drag data
      }
    },
    [onCrossProjectDrop, zoom],
  );

  // Calculate total duration (including track positions and recording preview)
  const totalDuration = Math.max(
    10, // Minimum 10 seconds
    ...tracks.map((t) => {
      const effectiveTrimEnd = t.trimEnd > 0 ? t.trimEnd : t.duration;
      const trimmedDuration = effectiveTrimEnd - t.trimStart;
      return (t.position ?? t.delay ?? 0) + trimmedDuration;
    }),
    isRecording ? recordingStartPosition + recordingDuration + 2 : 0, // Add recording preview
  );

  // Content width with some padding
  const contentWidth = (totalDuration + 5) * zoom;

  // Tracks viewport height
  const tracksHeight = Math.max(200, tracks.length * TRACK_ROW_HEIGHT + 40);

  // Snap time helper
  const snapTime = useCallback(
    (time: number) => {
      if (!snapEnabled) return time;
      return Math.round(time / snapGrid) * snapGrid;
    },
    [snapEnabled, snapGrid],
  );

  // Auto-scroll to follow playhead during playback
  useEffect(() => {
    if (!isPlaying || !viewportRef.current) return;

    const viewport = viewportRef.current;
    const playheadPixels = playheadTime * zoom;
    const viewportWidth = viewport.clientWidth;
    const currentScroll = viewport.scrollLeft;

    // Keep playhead in view (with some margin)
    const margin = viewportWidth * 0.2;
    if (playheadPixels > currentScroll + viewportWidth - margin) {
      viewport.scrollLeft = playheadPixels - margin;
    } else if (playheadPixels < currentScroll + margin) {
      viewport.scrollLeft = Math.max(0, playheadPixels - margin);
    }
  }, [playheadTime, zoom, isPlaying]);

  // Handle scrubbing (stage drag)
  const handleViewportMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle clicks on the background, not on tracks
      if (
        e.target !== e.currentTarget &&
        (e.target as HTMLElement).closest("[data-timeline-track]")
      ) {
        return;
      }

      // Shift+click to scrub
      if (!e.shiftKey) {
        // Regular click: deselect track and seek
        onSelectTrack(null);
        const rect = e.currentTarget.getBoundingClientRect();
        const scrollLeft = viewportRef.current?.scrollLeft || 0;
        const x = e.clientX - rect.left + scrollLeft;
        const time = x / zoom;
        onPlayheadSeek(Math.max(0, time));
        return;
      }

      // Shift+drag to scrub
      e.preventDefault();
      isScrubbing.current = true;
      scrubStartX.current = e.clientX;
      scrubStartTime.current = playheadTime;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isScrubbing.current) return;

        const deltaX = moveEvent.clientX - scrubStartX.current;
        const deltaTime = deltaX / zoom;
        const newTime = Math.max(0, scrubStartTime.current + deltaTime);
        onPlayheadSeek(newTime);

        // Play audio snippet for scrub feedback
        if (onScrubAudio) {
          onScrubAudio(newTime);
        }
      };

      const handleMouseUp = () => {
        isScrubbing.current = false;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [zoom, playheadTime, onPlayheadSeek, onSelectTrack, onScrubAudio],
  );

  // Selected track
  const selectedTrack = selectedTrackId
    ? tracks.find((t) => t.id === selectedTrackId) || null
    : null;

  return (
    <div className="flex flex-col h-full bg-black/20 backdrop-blur-sm overflow-hidden">
      {/* Controls */}
      <div className="bg-white/5 border-b border-white/5">
        <TimelineControls
          zoom={zoom}
          snapEnabled={snapEnabled}
          snapGrid={snapGrid}
          onZoomChange={onZoomChange}
          onSnapToggle={onSnapToggle}
          onSnapGridChange={onSnapGridChange}
        />
      </div>

      {/* Ruler */}
      <div className="overflow-x-hidden border-b border-white/5">
        <div
          className="overflow-x-auto scrollbar-none"
          style={{ overflowY: "hidden" }}
          ref={(el) => {
            // Sync scroll with tracks viewport
            if (el) {
              el.addEventListener("scroll", () => {
                if (viewportRef.current) {
                  viewportRef.current.scrollLeft = el.scrollLeft;
                }
              });
            }
          }}
        >
          <div className="bg-black/20">
            <TimelineRuler zoom={zoom} duration={totalDuration} onSeek={onPlayheadSeek} />
          </div>
        </div>
      </div>

      {/* Tracks viewport - uses role="application" for complex widget with custom keyboard handling */}
      <div
        ref={viewportRef}
        className="relative overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20 transition-all"
        style={{ height: "100%", minHeight: "200px" }}
        onMouseDown={handleViewportMouseDown}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        role="application"
        aria-label="Timeline tracks editor"
        tabIndex={0}
      >
        {/* Content container */}
        <div
          className="relative bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,0.03)_1px,transparent_0)] bg-[size:40px_40px]"
          style={{
            width: `${contentWidth}px`,
            height: `${tracksHeight}px`,
            minWidth: "100%",
          }}
        >
          {/* Track rows */}
          <div className="pt-4">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className="absolute left-0 right-0 group"
                style={{
                  top: `${index * TRACK_ROW_HEIGHT + 12}px`,
                  height: `${TRACK_HEIGHT}px`,
                }}
                data-timeline-track
              >
                {/* Track Row Background Highlight */}
                <div
                  className={cn(
                    "absolute inset-0 mx-2 rounded-xl transition-colors pointer-events-none",
                    track.id === selectedTrackId
                      ? "bg-primary/10 border border-primary/20"
                      : "group-hover:bg-white/5",
                  )}
                />

                <TimelineTrack
                  track={track}
                  zoom={zoom}
                  isSelected={track.id === selectedTrackId}
                  playheadTime={playheadTime}
                  snapTime={snapTime}
                  onPositionChange={(position) => onTrackPositionChange(track.id, position)}
                  onTrimChange={(trimStart, trimEnd) => onTrimChange(track.id, trimStart, trimEnd)}
                  onSelect={() => onSelectTrack(track.id)}
                  onClickPlay={onSoloPreview ? () => onSoloPreview(track.id) : undefined}
                />
              </div>
            ))}

            {/* Recording Preview Track */}
            {isRecording && recordingDuration > 0 && (
              <div
                className="absolute left-0 right-0 group"
                style={{
                  top: `${tracks.length * TRACK_ROW_HEIGHT + 12}px`,
                  height: `${TRACK_HEIGHT}px`,
                }}
              >
                {/* Recording Track Background */}
                <div className="absolute inset-0 mx-2 rounded-xl bg-red-500/10 border border-red-500/30 animate-pulse" />

                {/* Recording Track Block */}
                <div
                  className="absolute h-full bg-gradient-to-r from-red-500/40 to-red-600/40 rounded-md border border-red-500/50 shadow-lg flex items-center gap-2 px-2 overflow-hidden"
                  style={{
                    left: `${recordingStartPosition * zoom}px`,
                    width: `${Math.max(recordingDuration * zoom, 20)}px`,
                  }}
                >
                  {/* Recording indicator dot */}
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  <span className="text-[10px] font-mono text-white/80 truncate">
                    Recording... {Math.floor(recordingDuration / 60)}:
                    {String(Math.floor(recordingDuration % 60)).padStart(2, "0")}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Playhead */}
          <Playhead time={playheadTime} zoom={zoom} height={tracksHeight} onSeek={onPlayheadSeek} />

          {/* Empty state */}
          {tracks.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <Plus className="w-8 h-8 opacity-20" />
              </div>
              <p className="font-medium">No tracks in project</p>
              <p className="text-sm opacity-60">Add audio files or record to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected track panel */}
      {selectedTrack && (
        <div className="border-t border-primary/20 bg-primary/5 backdrop-blur-md">
          <SelectedTrackPanel
            track={selectedTrack}
            onVolumeChange={(volume) => selectedTrackId && onVolumeChange(selectedTrackId, volume)}
            onMuteToggle={() => selectedTrackId && onMuteToggle(selectedTrackId)}
            onSoloToggle={() => selectedTrackId && onSoloToggle(selectedTrackId)}
            onTrimChange={(start, end) =>
              selectedTrackId && onTrimChange(selectedTrackId, start, end)
            }
            onRemove={() => selectedTrackId && onRemoveTrack(selectedTrackId)}
          />
        </div>
      )}
    </div>
  );
}
