import type { CanvasOrder, CanvasRotation } from "./types";

// Masonry layout breakpoints
export const MASONRY_BREAKPOINTS_GALLERY = {
  default: 4, // Desktop: 4 columns
  1024: 3, // Large tablet: 3 columns
  768: 2, // Tablet: 2 columns
  640: 2, // Mobile: 2 columns
};

export const MASONRY_BREAKPOINTS_LANDING = {
  default: 3, // Desktop: 3 columns
  1024: 3, // Large tablet: 3 columns
  768: 2, // Tablet: 2 columns
  640: 1, // Mobile: 1 column
};

// Masonry CSS class configuration (24px gap)
export const MASONRY_CLASSES = {
  container: "flex -ml-6 w-auto",
  column: "pl-6 bg-clip-padding",
} as const;

// Consistent vertical spacing for masonry items (24px)
export const MASONRY_ITEM_MARGIN = "mb-6";

export const DEFAULT_INTERVAL = 10;
export const DEFAULT_ROTATION: CanvasRotation = 0;
export const DEFAULT_ORDER: CanvasOrder = "album";
