"use client";

import { X } from "lucide-react";
import Image from "next/image";

interface McpImagePreviewProps {
  url: string | null;
  onDismiss: () => void;
}

export function McpImagePreview({ url, onDismiss }: McpImagePreviewProps) {
  if (!url) return null;

  return (
    <div className="animate-in slide-in-from-bottom-4 fade-in duration-300 mt-4 glass-1 glass-edge rounded-2xl p-4 relative">
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Dismiss preview"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
        Image Preview
      </div>
      <div className="relative aspect-video rounded-lg overflow-hidden bg-black/20 max-w-md">
        <Image src={url} alt="Tool response image" fill className="object-contain" unoptimized />
      </div>
    </div>
  );
}
