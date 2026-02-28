"use client";

import { PixelLogo } from "@/components/brand";
import { ImageComparisonSlider } from "@/components/enhance/ImageComparisonSlider";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { logger } from "@/lib/logger";

interface SharePageClientProps {
  imageName: string;
  description: string | null;
  originalUrl: string;
  enhancedUrl: string;
  originalWidth: number;
  originalHeight: number;
  enhancedWidth: number | null;
  enhancedHeight: number | null;
  shareToken: string;
}

export function SharePageClient({
  imageName,
  description,
  originalUrl,
  enhancedUrl,
  originalWidth,
  originalHeight,
  enhancedWidth,
  enhancedHeight,
  shareToken,
}: SharePageClientProps) {
  const [downloadingOriginal, setDownloadingOriginal] = useState(false);
  const [downloadingEnhanced, setDownloadingEnhanced] = useState(false);

  // Always use original dimensions for the container so both images
  // share the same aspect ratio in the comparison slider
  const displayWidth = originalWidth;
  const displayHeight = originalHeight;

  // Aspect ratio for container calculation
  const aspectRatio = displayWidth / displayHeight;

  const handleDownload = async (type: "original" | "enhanced") => {
    const setLoading = type === "original"
      ? setDownloadingOriginal
      : setDownloadingEnhanced;
    setLoading(true);

    try {
      const response = await fetch(
        `/api/share/${shareToken}/download?type=${type}`,
      );

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `${imageName}_${type}.jpg`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error("Download failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-950/20 via-black to-black pointer-events-none" />

      {/* Header - Floating on mobile, fixed on desktop */}
      <header className="absolute top-0 left-0 right-0 z-50 p-4 md:p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent backdrop-blur-[2px]">
        <Link
          href="/"
          className="inline-flex items-center hover:opacity-80 transition-opacity"
        >
          <PixelLogo size="sm" variant="horizontal" />
        </Link>
        <Link href="/apps/pixel" className="md:hidden">
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
          >
            Try for free <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </Button>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center relative w-full h-full p-0 md:p-6 animate-in fade-in zoom-in-95 duration-700">
        <div
          className="w-full relative z-10 flex flex-col items-center justify-center gap-4"
          style={{
            maxWidth: aspectRatio > 1 ? "1200px" : "800px",
          }}
        >
          {/* Image Name */}
          <h1 className="text-white text-lg md:text-xl font-semibold text-center px-4 truncate max-w-full">
            {imageName}
          </h1>

          {/* Comparison Slider Container */}
          <div className="w-full relative shadow-2xl shadow-cyan-900/10 md:rounded-xl overflow-hidden ring-1 ring-white/10">
            <ImageComparisonSlider
              originalUrl={originalUrl}
              enhancedUrl={enhancedUrl}
              originalLabel="Before"
              enhancedLabel="After"
              width={displayWidth}
              height={displayHeight}
              {...(enhancedWidth != null ? { enhancedWidth } : {})}
              {...(enhancedHeight != null ? { enhancedHeight } : {})}
            />
          </div>

          {/* Description - Desktop only or non-intrusive on mobile */}
          {description && (
            <p className="text-sm text-white/60 text-center max-w-lg px-4 hidden md:block">
              {description}
            </p>
          )}
        </div>
      </main>

      {/* Bottom Actions Bar - Mobile Optimized */}
      <footer className="sticky bottom-0 left-0 right-0 z-50 p-4 border-t border-white/10 bg-black/80 backdrop-blur-xl animate-in slide-in-from-bottom duration-500 delay-200">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          {description && (
            <p className="text-xs text-white/60 text-center md:hidden line-clamp-1 mb-1">
              {description}
            </p>
          )}

          <div className="flex gap-2 sm:justify-center">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white h-12"
              onClick={() => handleDownload("original")}
              disabled={downloadingOriginal}
            >
              {downloadingOriginal
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Download className="mr-2 h-4 w-4" />}
              <span className="hidden sm:inline">Download</span> Original
            </Button>

            <Button
              className="flex-[2] sm:flex-none bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-glow-cyan h-12 text-base font-semibold"
              onClick={() => handleDownload("enhanced")}
              disabled={downloadingEnhanced}
            >
              {downloadingEnhanced
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Download className="mr-2 h-4 w-4" />}
              Download Enhanced
            </Button>
          </div>

          <div className="text-center mt-2 hidden md:block">
            <Link
              href="/apps/pixel"
              className="text-xs text-white/40 hover:text-white transition-colors"
            >
              Enhanced with Pixel ↗
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
