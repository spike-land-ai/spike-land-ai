"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { processImageForUpload } from "@/lib/images/browser-image-processor";
import { cn } from "@/lib/utils";
import { Camera, FolderOpen, Plus, Upload, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";

/** Image selected from gallery (stored image) */
export interface GalleryImage {
  type: "gallery";
  id: string;
  url: string;
  name: string;
  width: number;
  height: number;
}

/** Image uploaded from device (file) */
interface UploadedImage {
  type: "upload";
  id: string; // Generated unique ID
  url: string; // Object URL for preview
  name: string;
  width: number;
  height: number;
  base64: string;
  mimeType: string;
}

export type SelectedImage = GalleryImage | UploadedImage;

interface ImageSlotProps {
  label: string;
  image: SelectedImage | null;
  onImageSelect: (image: SelectedImage) => void;
  onImageClear: () => void;
  /** Optional for anonymous users who can't access gallery */
  onOpenGallery?: () => void;
  disabled?: boolean;
}

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function ImageSlot({
  label,
  image,
  onImageSelect,
  onImageClear,
  onOpenGallery,
  disabled = false,
}: ImageSlotProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      // Validate file type
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        alert("Please use an image file (JPEG, PNG, WebP, or GIF)");
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        alert("Image file is too large. Maximum size is 20MB.");
        return;
      }

      setIsProcessing(true);

      try {
        // Process image: resize to max 1024px, crop to supported aspect ratio, convert to WebP
        const processed = await processImageForUpload(file);

        // Create object URL for preview from processed blob
        const previewUrl = URL.createObjectURL(processed.blob);

        const uploadedImage: UploadedImage = {
          type: "upload",
          id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url: previewUrl,
          name: file.name,
          width: processed.width,
          height: processed.height,
          base64: processed.base64,
          mimeType: processed.mimeType,
        };

        onImageSelect(uploadedImage);
      } catch (error) {
        console.error("Failed to process image:", error);
        alert("Failed to process the image. Please try again.");
      } finally {
        setIsProcessing(false);
      }
    },
    [onImageSelect],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled || isProcessing) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!isDragOver) setIsDragOver(true);
    },
    [disabled, isProcessing, isDragOver],
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled || isProcessing) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    },
    [disabled, isProcessing],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const relatedTarget = e.relatedTarget as Node | null;
      const currentTarget = e.currentTarget as Node;
      if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
        setIsDragOver(false);
      }
    },
    [],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      if (disabled || isProcessing || !e.dataTransfer) return;

      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find(file => ACCEPTED_IMAGE_TYPES.includes(file.type));

      if (imageFile) {
        await processFile(imageFile);
      } else {
        alert("Please drop an image file (JPEG, PNG, WebP, or GIF)");
      }
    },
    [disabled, isProcessing, processFile],
  );

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await processFile(file);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [processFile],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // Revoke object URL if it was an upload
      if (image?.type === "upload") {
        URL.revokeObjectURL(image.url);
      }
      onImageClear();
    },
    [image, onImageClear],
  );

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        onChange={handleFileInputChange}
        className="hidden"
        aria-label={`Upload ${label}`}
      />

      <Card
        variant={image ? "default" : "dashed"}
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          "aspect-square rounded-3xl group/card",
          !image
            && "bg-white/[0.02] border-white/10 hover:bg-white/[0.04] hover:border-emerald-500/50",
          image && "border-white/10 shadow-2xl",
          isDragOver && !disabled
            && "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/5",
          disabled && "opacity-50 cursor-not-allowed",
          isProcessing && "pointer-events-none",
        )}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {image
          ? (
            <>
              <Image
                src={image.url}
                alt={image.name}
                fill
                className="object-cover transition-transform duration-700 group-hover/card:scale-110"
                sizes="(max-width: 768px) 50vw, 300px"
                unoptimized={image.type === "upload"} // Don't optimize blob URLs
              />
              {/* Clear button */}
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className={cn(
                  "absolute top-3 right-3 z-10",
                  "h-9 w-9 rounded-full",
                  "bg-black/60 hover:bg-red-500",
                  "flex items-center justify-center",
                  "text-white transition-all scale-90 group-hover/card:scale-100 shadow-xl border border-white/10",
                )}
                aria-label={`Clear ${label}`}
              >
                <X className="h-5 w-5" />
              </button>
              {/* Image info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-white/10 flex items-center justify-center backdrop-blur-sm">
                    {image.type === "upload"
                      ? <Upload className="h-3 w-3 text-white" />
                      : <FolderOpen className="h-3 w-3 text-white" />}
                  </div>
                  <p className="text-xs font-bold text-white truncate drop-shadow-md">
                    {image.name}
                  </p>
                </div>
              </div>
            </>
          )
          : isProcessing
          ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500/20 border-t-emerald-500" />
              <p className="text-xs font-black uppercase tracking-widest text-emerald-500 animate-pulse">
                Processing
              </p>
            </div>
          )
          : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div
                className={cn(
                  "h-16 w-16 rounded-3xl",
                  "bg-white/5 flex items-center justify-center",
                  "transition-all duration-300 group-hover/card:scale-110 group-hover/card:bg-emerald-500/10",
                  isDragOver && "bg-emerald-500/20",
                )}
              >
                <Plus
                  className={cn(
                    "h-8 w-8 text-zinc-600 transition-colors group-hover/card:text-emerald-500",
                    isDragOver && "text-emerald-500",
                  )}
                />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-400 group-hover/card:text-zinc-200 transition-colors">
                  {isDragOver ? "Release to drop" : "Select image"}
                </p>
                <p className="text-[10px] uppercase tracking-widest font-black text-zinc-600">
                  JPG, PNG, WEBP
                </p>
              </div>

              {!isDragOver && (
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={disabled}
                        className="text-[10px] font-black uppercase tracking-widest h-8 rounded-xl border-white/5 bg-white/5 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all"
                      >
                        Browse
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="center"
                      className="bg-zinc-900 border-white/10 rounded-xl"
                    >
                      <DropdownMenuItem
                        onClick={handleUploadClick}
                        className="text-xs font-bold gap-2 focus:bg-emerald-500"
                      >
                        <Camera className="h-4 w-4" />
                        Upload Device
                      </DropdownMenuItem>
                      {onOpenGallery && (
                        <DropdownMenuItem
                          onClick={onOpenGallery}
                          className="text-xs font-bold gap-2 focus:bg-emerald-500"
                        >
                          <FolderOpen className="h-4 w-4" />
                          Spike Gallery
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          )}
      </Card>
    </div>
  );
}
