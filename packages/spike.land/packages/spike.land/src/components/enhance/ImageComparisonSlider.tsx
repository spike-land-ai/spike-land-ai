"use client";

import { GripVertical } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

// Log broken images to server for monitoring
async function logBrokenImage(imageType: string, url: string) {
  try {
    await fetch("/api/logs/image-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: `COMPARISON_${imageType}_LOAD_ERROR`,
        versionId: "comparison-slider",
        tier: imageType,
        url,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("[Image Error Logging Failed]", e);
  }
}

interface ImageComparisonSliderProps {
  originalUrl: string;
  enhancedUrl: string;
  originalLabel?: string;
  enhancedLabel?: string;
  /** Width of the original image. Used to calculate aspect ratio. Omit for auto-detection. */
  width?: number;
  /** Height of the original image. Used to calculate aspect ratio. Omit for auto-detection. */
  height?: number;
  /** Width of the enhanced image. Kept for backward compat; not used for layout. */
  enhancedWidth?: number;
  /** Height of the enhanced image. Kept for backward compat; not used for layout. */
  enhancedHeight?: number;
}

/**
 * A slider component to compare original and enhanced images.
 * Both images use object-cover so they fill the container at the original's AR.
 * Since uploads now resize to exact standard 1K dimensions, both images should
 * share the same AR and object-cover center-crops any sub-pixel rounding difference.
 */
export function ImageComparisonSlider({
  originalUrl,
  enhancedUrl,
  originalLabel = "Original",
  enhancedLabel = "Enhanced",
  width,
  height,
}: ImageComparisonSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [enhancedError, setEnhancedError] = useState(false);
  const [originalError, setOriginalError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [detectedDimensions, setDetectedDimensions] = useState<
    { width: number; height: number; } | null
  >(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-detect original dimensions if not provided (or invalid)
  const shouldAutoDetect = width === undefined || height === undefined
    || !Number.isFinite(width)
    || !Number.isFinite(height) || width <= 0 || height <= 0;

  useEffect(() => {
    if (!shouldAutoDetect) return;

    const img = new window.Image();
    img.onload = () => {
      setDetectedDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.src = originalUrl;
  }, [originalUrl, shouldAutoDetect]);

  // Use provided dimensions if valid, detected dimensions if available, or default 16:9
  const safeWidth = (Number.isFinite(width) && width && width > 0)
    ? width
    : (detectedDimensions?.width ?? 16);
  const safeHeight = (Number.isFinite(height) && height && height > 0)
    ? height
    : (detectedDimensions?.height ?? 9);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleDragStart = useCallback((clientX: number) => {
    setIsDragging(true);
    updatePosition(clientX);
  }, [updatePosition]);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return;
    updatePosition(clientX);
  }, [isDragging, updatePosition]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse event handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  }, [handleDragStart]);

  // Touch event handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      handleDragStart(touch.clientX);
    }
  }, [handleDragStart]);

  // Document-level listeners for drag continuation
  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX);
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        handleDragMove(touch.clientX);
      }
    };

    const onEnd = () => {
      handleDragEnd();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onTouchMove);
    document.addEventListener("touchend", onEnd);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const handleEnhancedError = () => {
    console.error(`[Enhanced Image Load Error] URL: ${enhancedUrl}`);
    setEnhancedError(true);
    logBrokenImage("ENHANCED", enhancedUrl);
  };

  const handleOriginalError = () => {
    console.error(`[Original Image Load Error] URL: ${originalUrl}`);
    setOriginalError(true);
    logBrokenImage("ORIGINAL", originalUrl);
  };

  return (
    <div>
      <div
        ref={containerRef}
        className="relative bg-muted rounded-lg overflow-hidden w-full select-none cursor-ew-resize"
        style={{
          aspectRatio: `${safeWidth} / ${safeHeight}`,
          touchAction: "pan-y pinch-zoom",
        }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        role="slider"
        tabIndex={0}
        aria-label="Image comparison slider"
        aria-valuenow={Math.round(sliderPosition)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Enhanced image (background) */}
        {!enhancedError
          ? (
            <Image
              src={enhancedUrl}
              alt={enhancedLabel}
              className="absolute inset-0 w-full h-full object-cover"
              onError={handleEnhancedError}
              fill
              unoptimized
            />
          )
          : (
            <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
              <p className="text-sm text-destructive">
                Enhanced image failed to load
              </p>
            </div>
          )}

        {/* Original image (clipped overlay) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          {!originalError
            ? (
              <Image
                src={originalUrl}
                alt={originalLabel}
                className="w-full h-full object-cover"
                onError={handleOriginalError}
                fill
                unoptimized
              />
            )
            : (
              <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
                <p className="text-sm text-destructive">
                  Original image failed to load
                </p>
              </div>
            )}
        </div>

        {/* Divider line with cyan glow */}
        <div
          data-testid="slider-divider"
          className="absolute top-0 bottom-0 w-1 bg-primary shadow-[0_0_12px_rgba(0,229,255,0.6)] pointer-events-none"
          style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
        >
          {/* Handle circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-glow-cyan-sm transition-transform hover:scale-110">
            <GripVertical className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>

        {/* Labels with brand styling */}
        <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm text-foreground text-xs font-medium px-3 py-1.5 rounded-full border border-border/50">
          {originalLabel}
        </div>
        <div className="absolute top-4 right-4 bg-card/90 backdrop-blur-sm text-foreground text-xs font-medium px-3 py-1.5 rounded-full border border-border/50">
          {enhancedLabel}
        </div>
      </div>
    </div>
  );
}
