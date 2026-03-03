"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

async function logBrokenImage(imageType: string, url: string) {
  try {
    await fetch("/api/logs/image-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: `SPLIT_PREVIEW_${imageType}_LOAD_ERROR`,
        versionId: "split-preview",
        tier: imageType,
        url,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("[Image Error Logging Failed]", e);
  }
}

interface SplitPreviewProps {
  originalUrl: string;
  enhancedUrl: string;
  originalLabel?: string;
  enhancedLabel?: string;
  /** Width of the original image. Used to calculate aspect ratio. Omit for auto-detection. */
  width?: number;
  /** Height of the original image. Used to calculate aspect ratio. Omit for auto-detection. */
  height?: number;
  className?: string;
}

/**
 * A dynamic scroll-based split preview component where the split line
 * is always at the middle of the physical screen. As the user scrolls:
 * - The portion of the image above the screen's center shows the ENHANCED image
 * - The portion below the screen's center shows the ORIGINAL image
 *
 * When width/height are omitted, the component auto-detects dimensions for natural aspect ratio.
 */
export function SplitPreview({
  originalUrl,
  enhancedUrl,
  originalLabel = "Original",
  enhancedLabel = "Enhanced",
  width,
  height,
  className,
}: SplitPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [clipY, setClipY] = useState(50);
  const [enhancedError, setEnhancedError] = useState(false);
  const [originalError, setOriginalError] = useState(false);
  const [detectedDimensions, setDetectedDimensions] = useState<
    { width: number; height: number; } | null
  >(null);

  // Auto-detect dimensions if not provided (or invalid)
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

  useEffect(() => {
    const updateSplit = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const viewportMid = window.innerHeight / 2;
      const imageTop = rect.top;
      const imageHeight = rect.height;

      if (viewportMid < imageTop) {
        setClipY(0);
      } else if (viewportMid > imageTop + imageHeight) {
        setClipY(100);
      } else {
        const splitPercent = ((viewportMid - imageTop) / imageHeight) * 100;
        setClipY(splitPercent);
      }
    };

    window.addEventListener("scroll", updateSplit, { passive: true });
    window.addEventListener("resize", updateSplit);
    updateSplit();

    return () => {
      window.removeEventListener("scroll", updateSplit);
      window.removeEventListener("resize", updateSplit);
    };
  }, []);

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
    <div
      ref={containerRef}
      data-testid="split-preview-container"
      className={cn(
        "relative bg-muted rounded-lg overflow-hidden w-full",
        className,
      )}
      style={{ aspectRatio: `${safeWidth} / ${safeHeight}` }}
    >
      {/* Original image (full, behind) */}
      {!originalError
        ? (
          <Image
            src={originalUrl}
            alt={`${originalLabel}`}
            fill
            className="object-cover"
            priority
            onError={handleOriginalError}
          />
        )
        : (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
            <p className="text-sm text-destructive">
              Original image failed to load
            </p>
          </div>
        )}

      {/* Enhanced image (clipped to top portion based on scroll) */}
      <div
        data-testid="enhanced-clip-container"
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 0 ${100 - clipY}% 0)` }}
      >
        {!enhancedError
          ? (
            <Image
              src={enhancedUrl}
              alt={`${enhancedLabel}`}
              fill
              className="object-cover"
              priority
              onError={handleEnhancedError}
            />
          )
          : (
            <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
              <p className="text-sm text-destructive">
                Enhanced image failed to load
              </p>
            </div>
          )}
      </div>

      {/* Split line indicator */}
      <div
        data-testid="split-line"
        className="absolute left-0 right-0 h-0.5 bg-white/70 shadow-lg pointer-events-none"
        style={{ top: `${clipY}%` }}
      >
        {/* Labels */}
        <span
          data-testid="enhanced-label"
          className="absolute left-2 -top-5 text-xs bg-black/50 text-white px-1 rounded"
        >
          {enhancedLabel}
        </span>
        <span
          data-testid="original-label"
          className="absolute left-2 top-1 text-xs bg-black/50 text-white px-1 rounded"
        >
          {originalLabel}
        </span>
      </div>
    </div>
  );
}
