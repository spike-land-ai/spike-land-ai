"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getBestThumbnail } from "@/lib/images/get-best-thumbnail";
import { Download } from "lucide-react";
import Image from "next/image";
import type { PublicImage } from "./types";

interface ImageModalProps {
  image: PublicImage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageModal({ image, open, onOpenChange }: ImageModalProps) {
  if (!image) return null;

  const job = image.enhancementJobs[0];
  const src = getBestThumbnail(image, true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 overflow-hidden bg-black/95 border-white/10">
        <div className="relative h-full w-full flex flex-col md:flex-row">
          {/* Image Area */}
          <div className="flex-1 relative bg-black flex items-center justify-center">
            <div className="relative w-full h-full p-4">
              <Image
                src={src}
                alt={image.description || "Gallery Image"}
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full md:w-80 flex-shrink-0 bg-zinc-900 p-6 border-l border-white/10 flex flex-col gap-6 overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white sr-only">
                Image Details
              </DialogTitle>
            </DialogHeader>

            {/* User Info */}
            <div className="flex items-center gap-3">
              {image.user.image
                ? (
                  <Image
                    src={image.user.image}
                    width={40}
                    height={40}
                    className="rounded-full border border-white/10"
                    alt={image.user.name || "User"}
                  />
                )
                : <div className="w-10 h-10 rounded-full bg-zinc-800" />}
              <div>
                <p className="text-sm font-medium text-white">
                  {image.user.name || "Anonymous"}
                </p>
                <p className="text-xs text-zinc-400">
                  {new Date(image.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Description */}
            {image.description && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Prompt
                </h4>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {image.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {image.tags.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {image.tags.map(tag => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tech Specs */}
            <div className="space-y-3 mt-auto pt-6 border-t border-white/10">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Tier</span>
                <span className="text-zinc-300 font-mono">
                  {job?.tier?.replace("TIER_", "") || "Original"}
                </span>
              </div>
              {job?.enhancementType && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Type</span>
                  <span className="text-zinc-300 font-mono">
                    {job.enhancementType}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Resolution</span>
                <span className="text-zinc-300 font-mono">
                  {job?.enhancedWidth
                    ? `${job.enhancedWidth}x${job.enhancedHeight}`
                    : `${image.originalWidth}x${image.originalHeight}`}
                </span>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => window.open(src, "_blank")}
            >
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
