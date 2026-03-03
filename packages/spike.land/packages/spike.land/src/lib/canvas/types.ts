export type CanvasRotation = 0 | 90 | 180 | 270;
export type CanvasOrder = "album" | "random";

export interface CanvasSettings {
  rotation: CanvasRotation;
  order: CanvasOrder;
  interval: number;
}

export interface CanvasImage {
  id: string;
  url: string;
  name: string;
  width: number;
  height: number;
}

/**
 * Extended image type for gallery view with original and enhanced versions.
 */
export interface GalleryImage extends CanvasImage {
  originalUrl: string;
  enhancedUrl: string | null;
}

/**
 * Available view modes for the gallery component.
 */
export type GalleryViewMode = "grid" | "slideshow";

/**
 * State for gallery transition animations between grid and slideshow views.
 */
export interface GalleryTransition {
  isActive: boolean;
  originRect: DOMRect | null;
  direction: "expand" | "collapse";
}
