/**
 * TimelineControls Component - Zoom and snap controls for the timeline
 */

"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Magnet, ZoomIn, ZoomOut } from "lucide-react";
import type { SnapGrid } from "../../types";

interface TimelineControlsProps {
  zoom: number;
  snapEnabled: boolean;
  snapGrid: SnapGrid;
  onZoomChange: (zoom: number) => void;
  onSnapToggle: (enabled: boolean) => void;
  onSnapGridChange: (grid: SnapGrid) => void;
}

const SNAP_GRID_OPTIONS: { value: SnapGrid; label: string }[] = [
  { value: 0.1, label: "0.1s" },
  { value: 0.25, label: "0.25s" },
  { value: 0.5, label: "0.5s" },
  { value: 1, label: "1s" },
];

export function TimelineControls({
  zoom,
  snapEnabled,
  snapGrid,
  onZoomChange,
  onSnapToggle,
  onSnapGridChange,
}: TimelineControlsProps) {
  const handleZoomIn = () => {
    onZoomChange(Math.min(200, zoom + 10));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(10, zoom - 10));
  };

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-black/20 backdrop-blur-sm border-b border-white/5">
      {/* Zoom controls */}
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Zoom Out (−)</TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-4 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
          <input
            type="range"
            min="10"
            max="200"
            step="5"
            value={zoom}
            onChange={(e) => onZoomChange(parseInt(e.target.value))}
            className="w-28 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
            aria-label="Timeline zoom"
          />
          <span className="text-[10px] font-mono font-bold text-primary/80 w-14 text-right">
            {zoom} px/s
          </span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Zoom In (+)</TooltipContent>
        </Tooltip>
      </div>

      <div className="w-px h-6 bg-white/10" />

      {/* Snap controls */}
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onSnapToggle(!snapEnabled)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border",
                snapEnabled
                  ? "bg-primary/20 text-primary border-primary/30 shadow-glow-cyan-sm"
                  : "bg-white/5 text-gray-400 border-white/10 hover:text-white",
              )}
            >
              <Magnet className="w-3.5 h-3.5" />
              Grid Snap
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Grid Snap (G)</TooltipContent>
        </Tooltip>

        {snapEnabled && (
          <select
            value={snapGrid}
            onChange={(e) => onSnapGridChange(parseFloat(e.target.value) as SnapGrid)}
            className="px-3 py-1.5 text-xs bg-white/5 text-gray-300 rounded-xl border border-white/10 focus:outline-none focus:border-primary/50 transition-colors font-mono"
          >
            {SNAP_GRID_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-gray-900">
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
