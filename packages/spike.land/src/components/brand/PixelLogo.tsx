"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface PixelLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "icon" | "horizontal" | "stacked";
  className?: string;
  showText?: boolean;
}

const sizeMap = {
  sm: { grid: 32, text: "text-lg", gap: "gap-2" },
  md: { grid: 48, text: "text-xl", gap: "gap-3" },
  lg: { grid: 64, text: "text-2xl", gap: "gap-3" },
  xl: { grid: 96, text: "text-4xl", gap: "gap-4" },
};

// Constants for grid cell calculations
const GAP_RATIO = 0.12; // 12% gap between cells
const CORNER_RATIO = 0.18; // 18% corner radius for soft pixel aesthetic

// Module-level counter for generating unique IDs after hydration
let instanceCounter = 0;

export function PixelLogo({
  size = "md",
  variant = "horizontal",
  className,
  showText = true,
}: PixelLogoProps) {
  // Start with a stable ID for SSR, then update to unique ID after mount
  // This prevents hydration mismatches while still ensuring unique IDs for multiple instances
  const [uniqueId, setUniqueId] = useState("ssr");

  useEffect(() => {
    setUniqueId(`client-${++instanceCounter}`);
  }, []);

  const glowId = `glow-${uniqueId}`;
  const sparkGradientId = `sparkGradient-${uniqueId}`;
  const sparkShineId = `sparkShine-${uniqueId}`;

  const { grid, text, gap } = sizeMap[size];
  const cellSize = grid / 3;
  const cellGap = cellSize * GAP_RATIO;
  const cornerRadius = cellSize * CORNER_RATIO;

  // Grid icon SVG - inlined to avoid function recreation on each render
  const gridIcon = (
    <svg
      width={grid}
      height={grid}
      viewBox={`0 0 ${grid} ${grid}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
      aria-hidden="true"
    >
      <defs>
        <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={sparkGradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="30%" stopColor="#00E5FF" />
          <stop offset="70%" stopColor="#FF00FF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FF00FF" stopOpacity="0.7" />
        </radialGradient>
        <linearGradient id={sparkShineId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
          <stop offset="40%" stopColor="#00E5FF" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#FF00FF" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => {
          const isCenter = row === 1 && col === 1;
          const x = col * cellSize + cellGap / 2;
          const y = row * cellSize + cellGap / 2;
          const rectSize = cellSize - cellGap;

          if (isCenter) {
            return (
              <g key={`${row}-${col}`}>
                <rect
                  x={x}
                  y={y}
                  width={rectSize}
                  height={rectSize}
                  rx={cornerRadius}
                  fill={`url(#${sparkGradientId})`}
                  filter={`url(#${glowId})`}
                />
                <rect
                  x={x}
                  y={y}
                  width={rectSize}
                  height={rectSize}
                  rx={cornerRadius}
                  fill={`url(#${sparkShineId})`}
                />
              </g>
            );
          }

          return (
            <rect
              key={`${row}-${col}`}
              x={x}
              y={y}
              width={rectSize}
              height={rectSize}
              rx={cornerRadius}
              className="fill-white/10 transition-colors duration-300 hover:fill-white/20"
            />
          );
        }),
      )}
    </svg>
  );

  // Wordmark text - inlined to avoid function recreation on each render
  const wordmark = (
    <span
      className={cn("font-heading font-bold tracking-tight lowercase", text, "text-foreground")}
    >
      pixel
    </span>
  );

  if (variant === "icon" || !showText) {
    return (
      <div className={cn("inline-flex items-center", className)} role="img" aria-label="Pixel logo">
        {gridIcon}
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div
        className={cn("inline-flex flex-col items-center gap-2", className)}
        role="img"
        aria-label="Pixel logo"
      >
        {gridIcon}
        {wordmark}
      </div>
    );
  }

  return (
    <div
      className={cn("inline-flex items-center", gap, className)}
      role="img"
      aria-label="Pixel logo"
    >
      {gridIcon}
      {wordmark}
    </div>
  );
}
