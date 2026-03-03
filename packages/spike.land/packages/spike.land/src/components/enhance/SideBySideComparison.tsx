"use client";

import Image from "next/image";
import { useState } from "react";

async function logBrokenImage(imageType: string, url: string) {
  try {
    await fetch("/api/logs/image-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: `SIDE_BY_SIDE_${imageType}_LOAD_ERROR`,
        versionId: "side-by-side-comparison",
        tier: imageType,
        url,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("[Image Error Logging Failed]", e);
  }
}

interface SideBySideComparisonProps {
  originalUrl: string;
  enhancedUrl: string;
  originalLabel?: string;
  enhancedLabel?: string;
  width?: number;
  height?: number;
}

export function SideBySideComparison({
  originalUrl,
  enhancedUrl,
  originalLabel = "Original",
  enhancedLabel = "Enhanced",
  width = 16,
  height = 9,
}: SideBySideComparisonProps) {
  const [enhancedError, setEnhancedError] = useState(false);
  const [originalError, setOriginalError] = useState(false);

  const safeWidth = Math.max(1, Number(width) || 16);
  const safeHeight = Math.max(1, Number(height) || 9);

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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="relative">
        <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded text-sm z-10">
          {originalLabel}
        </div>
        <div
          className="relative bg-muted rounded-lg overflow-hidden w-full"
          style={{ aspectRatio: `${safeWidth} / ${safeHeight}` }}
        >
          {!originalError
            ? (
              <Image
                src={originalUrl}
                alt={originalLabel}
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
        </div>
      </div>
      <div className="relative">
        <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-sm z-10">
          {enhancedLabel}
        </div>
        <div
          className="relative bg-muted rounded-lg overflow-hidden w-full"
          style={{ aspectRatio: `${safeWidth} / ${safeHeight}` }}
        >
          {!enhancedError
            ? (
              <Image
                src={enhancedUrl}
                alt={enhancedLabel}
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
      </div>
    </div>
  );
}
