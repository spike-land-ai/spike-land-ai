"use client";

import type { ComposerImage } from "@/hooks/useComposerImages";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Plus, X } from "lucide-react";
import Image from "next/image";

interface ComposerImageStripProps {
  images: ComposerImage[];
  onRemove: (id: string) => void;
  onAddClick: () => void;
  maxImages: number;
}

export function ComposerImageStrip({
  images,
  onRemove,
  onAddClick,
  maxImages,
}: ComposerImageStripProps) {
  if (images.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto">
      <AnimatePresence mode="popLayout">
        {images.map(img => (
          <motion.div
            key={img.id}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/10 group"
          >
            <Image
              src={img.previewUrl}
              alt="Attachment"
              className="w-full h-full object-cover"
              fill
              unoptimized
            />
            {img.isUploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
            )}
            {img.error && (
              <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                <span className="text-xs text-white">!</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(img.id)}
              className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove image"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {images.length < maxImages && (
        <button
          type="button"
          onClick={onAddClick}
          className="shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-white/10 hover:border-white/20 flex items-center justify-center text-zinc-500 hover:text-zinc-400 transition-colors"
          aria-label="Add image"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
