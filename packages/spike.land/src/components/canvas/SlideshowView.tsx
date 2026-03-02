"use client";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  applyHeroTransformStyles,
  calculateHeroTransform,
  clearHeroTransformStyles,
} from "@/lib/canvas/animations";
import type { CanvasRotation, GalleryImage, GalleryTransition } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, RotateCcw, RotateCw } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export interface SlideshowViewProps {
  images: GalleryImage[];
  currentIndex: number;
  isPeeking: boolean;
  onNavigate: (direction: "prev" | "next") => void;
  onExit: () => void;
  transitionState: GalleryTransition;
  rotation?: CanvasRotation;
  onRotate?: (direction: "cw" | "ccw") => void;
}

/**
 * Fullscreen immersive slideshow view for the gallery.
 * Displays enhanced images (or original if no enhanced version exists).
 * Supports hero animation transitions, keyboard navigation, and rotation.
 */
export function SlideshowView({
  images,
  currentIndex,
  isPeeking,
  onNavigate,
  onExit,
  transitionState,
  rotation = 0,
  onRotate,
}: SlideshowViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [animationClass, setAnimationClass] = useState("");
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get current image
  const currentImage = images[currentIndex];

  // Handle hero animation on mount
  useEffect(() => {
    if (!transitionState.isActive || !transitionState.originRect || !containerRef.current) {
      return;
    }

    const transform = calculateHeroTransform(transitionState.originRect);
    applyHeroTransformStyles(containerRef.current, transform);
    setAnimationClass("animate-hero-expand");

    // Clean up after animation completes
    const timer = setTimeout(() => {
      if (containerRef.current) {
        clearHeroTransformStyles(containerRef.current);
      }
      setAnimationClass("");
    }, 400);

    return () => clearTimeout(timer);
  }, [transitionState.isActive, transitionState.originRect]);

  // Show controls on mouse movement
  const handleMouseMove = useCallback(() => {
    setShowControls(true);

    // Clear existing timer
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }

    // Hide controls after 3 seconds of inactivity
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // Handle keyboard events for Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExit();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onExit]);

  // Cleanup controls timer on unmount
  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, []);

  // Calculate rotation transform
  const rotationTransform = rotation !== 0 ? `rotate(${rotation}deg)` : undefined;

  // Check if we should reduce motion (hydration-safe)
  const prefersReducedMotion = useReducedMotion();

  if (!currentImage) {
    return null;
  }

  // Determine which URL to display (computed after null check so displayUrl is guaranteed defined)
  // Use originalUrl as fallback if no enhancedUrl (or when peeking)
  const displayUrl = isPeeking
    ? currentImage.originalUrl
    : (currentImage.enhancedUrl ?? currentImage.originalUrl);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image slideshow"
      className={cn(
        "fixed inset-0 z-50 bg-[#0B0E14] flex items-center justify-center",
        prefersReducedMotion ? "" : animationClass,
      )}
      onMouseMove={handleMouseMove}
      data-testid="slideshow-view"
    >
      {/* Image container */}
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="relative w-full h-full" style={{ transform: rotationTransform }}>
          <Image
            src={displayUrl}
            alt={currentImage.name}
            fill
            className="object-contain"
            priority
            sizes="100vw"
            data-testid="slideshow-image"
          />
        </div>
      </div>

      {/* Image counter - visible */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white/80 text-sm"
        data-testid="image-counter"
      >
        {currentIndex + 1} of {images.length}
      </div>

      {/* Image counter and announcement for screen readers */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Image {currentIndex + 1} of {images.length}: {currentImage.name}
        {isPeeking ? " (showing original)" : ""}
      </div>

      {/* Navigation controls */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-between px-4 pointer-events-none transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0",
        )}
        data-testid="slideshow-controls"
      >
        {/* Previous button */}
        <button
          type="button"
          onClick={() => onNavigate("prev")}
          disabled={images.length <= 1}
          className={cn(
            "pointer-events-auto p-3 rounded-full bg-black/40 backdrop-blur-sm",
            "text-white/80 hover:text-white hover:bg-black/60",
            "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
            "disabled:opacity-30 disabled:cursor-not-allowed",
          )}
          aria-label="Previous image"
          data-testid="slideshow-prev-button"
        >
          <ChevronLeft className="w-6 h-6" aria-hidden="true" />
        </button>

        {/* Next button */}
        <button
          type="button"
          onClick={() => onNavigate("next")}
          disabled={images.length <= 1}
          className={cn(
            "pointer-events-auto p-3 rounded-full bg-black/40 backdrop-blur-sm",
            "text-white/80 hover:text-white hover:bg-black/60",
            "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
            "disabled:opacity-30 disabled:cursor-not-allowed",
          )}
          aria-label="Next image"
          data-testid="slideshow-next-button"
        >
          <ChevronRight className="w-6 h-6" aria-hidden="true" />
        </button>
      </div>

      {/* Top controls: rotation and exit */}
      <div
        className={cn(
          "absolute top-4 right-4 flex items-center gap-2 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0",
        )}
      >
        {/* Rotation buttons */}
        {onRotate && (
          <>
            <button
              type="button"
              onClick={() => onRotate("ccw")}
              className={cn(
                "p-2 rounded-full bg-black/40 backdrop-blur-sm",
                "text-white/80 hover:text-white hover:bg-black/60",
                "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
              )}
              aria-label="Rotate counter-clockwise"
              data-testid="rotate-ccw-button"
            >
              <RotateCcw className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onRotate("cw")}
              className={cn(
                "p-2 rounded-full bg-black/40 backdrop-blur-sm",
                "text-white/80 hover:text-white hover:bg-black/60",
                "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
              )}
              aria-label="Rotate clockwise"
              data-testid="rotate-cw-button"
            >
              <RotateCw className="w-5 h-5" aria-hidden="true" />
            </button>
          </>
        )}

        {/* Exit button */}
        <button
          type="button"
          onClick={onExit}
          className={cn(
            "p-2 rounded-full bg-black/40 backdrop-blur-sm",
            "text-white/80 hover:text-white hover:bg-black/60",
            "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
          )}
          aria-label="Exit slideshow"
          data-testid="slideshow-exit-button"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Touch area for swipe (occupies full screen for gesture detection) */}
      <div
        className="absolute inset-0 pointer-events-none"
        data-testid="slideshow-touch-area"
        aria-hidden="true"
      />
    </div>
  );
}
