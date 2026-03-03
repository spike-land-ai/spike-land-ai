"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Children, isValidElement, useMemo } from "react";

// Zoom level constants for type safety and consistency
export const ZOOM_LEVEL = {
  MIN: 1,
  DEFAULT: 3,
  MAX: 5,
} as const;

export type ZoomLevel = 1 | 2 | 3 | 4 | 5;

// Type guard to validate zoom level
export function isValidZoomLevel(value: number): value is ZoomLevel {
  return value >= ZOOM_LEVEL.MIN && value <= ZOOM_LEVEL.MAX
    && Number.isInteger(value);
}

// Clamp zoom level to valid range
export function clampZoomLevel(value: number): ZoomLevel {
  const clamped = Math.max(
    ZOOM_LEVEL.MIN,
    Math.min(ZOOM_LEVEL.MAX, Math.round(value)),
  );
  return clamped as ZoomLevel;
}

interface MasonryGridProps {
  children: ReactNode;
  zoomLevel?: ZoomLevel;
  className?: string;
}

// Explicit class mappings for Tailwind JIT compatibility
// Tailwind cannot detect dynamically constructed class names like `grid-cols-${n}`
// so we must use explicit strings that Tailwind can find at build time
const SM_GRID_COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

const MD_GRID_COLS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
};

const LG_GRID_COLS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

const XL_GRID_COLS: Record<number, string> = {
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
  8: "xl:grid-cols-8",
};

const SM_COLUMNS: Record<number, string> = {
  1: "sm:columns-1",
  2: "sm:columns-2",
  3: "sm:columns-3",
  4: "sm:columns-4",
};

const MD_COLUMNS: Record<number, string> = {
  2: "md:columns-2",
  3: "md:columns-3",
  4: "md:columns-4",
  5: "md:columns-5",
};

const LG_COLUMNS: Record<number, string> = {
  2: "lg:columns-2",
  3: "lg:columns-3",
  4: "lg:columns-4",
  5: "lg:columns-5",
  6: "lg:columns-6",
};

const XL_COLUMNS: Record<number, string> = {
  3: "xl:columns-3",
  4: "xl:columns-4",
  5: "xl:columns-5",
  6: "xl:columns-6",
  8: "xl:columns-8",
};

// Column counts based on zoom level and breakpoint
// Higher zoom = fewer columns (bigger items)
const COLUMN_CONFIG: Record<
  ZoomLevel,
  { sm: number; md: number; lg: number; xl: number; }
> = {
  1: { sm: 4, md: 5, lg: 6, xl: 8 }, // Smallest items, most columns
  2: { sm: 3, md: 4, lg: 5, xl: 6 },
  3: { sm: 2, md: 3, lg: 4, xl: 5 }, // Default
  4: { sm: 2, md: 2, lg: 3, xl: 4 },
  5: { sm: 1, md: 2, lg: 2, xl: 3 }, // Largest items, fewest columns
};

export function MasonryGrid({
  children,
  zoomLevel = ZOOM_LEVEL.DEFAULT,
  className,
}: MasonryGridProps) {
  const childArray = Children.toArray(children);
  // Ensure zoom level is valid
  const safeZoomLevel = isValidZoomLevel(zoomLevel)
    ? zoomLevel
    : ZOOM_LEVEL.DEFAULT;
  const config = COLUMN_CONFIG[safeZoomLevel];

  // Memoize column classes based on zoom level
  const columnClasses = useMemo(() => {
    return cn(
      "columns-1",
      SM_COLUMNS[config.sm],
      MD_COLUMNS[config.md],
      LG_COLUMNS[config.lg],
      XL_COLUMNS[config.xl],
    );
  }, [config]);

  return (
    <div
      className={cn(
        // Use CSS columns for masonry effect
        columnClasses,
        "gap-4 space-y-4",
        className,
      )}
      style={{
        columnGap: "1rem",
      }}
    >
      {childArray.map((child, index) => (
        <div
          key={isValidElement(child) && child.key ? child.key : index}
          className="break-inside-avoid mb-4"
        >
          {child}
        </div>
      ))}
    </div>
  );
}

// Grid-based variant for when aspect ratios are uniform
export function MasonryGridUniform({
  children,
  zoomLevel = ZOOM_LEVEL.DEFAULT,
  className,
}: MasonryGridProps) {
  // Ensure zoom level is valid
  const safeZoomLevel = isValidZoomLevel(zoomLevel)
    ? zoomLevel
    : ZOOM_LEVEL.DEFAULT;
  const config = COLUMN_CONFIG[safeZoomLevel];

  // Build responsive grid classes using explicit mappings
  const gridClasses = cn(
    "grid gap-4",
    "grid-cols-1",
    SM_GRID_COLS[config.sm],
    MD_GRID_COLS[config.md],
    LG_GRID_COLS[config.lg],
    XL_GRID_COLS[config.xl],
  );

  return (
    <div className={cn(gridClasses, className)}>
      {children}
    </div>
  );
}
