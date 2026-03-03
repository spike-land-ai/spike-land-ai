"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { SelectedImage } from "./ImageSlot";

interface UserImage {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  hasEnhancement: boolean;
}

interface ImageSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (image: SelectedImage) => void;
  excludeImageId?: string;
  title?: string;
}

export function ImageSelectorDialog({
  open,
  onOpenChange,
  onSelect,
  excludeImageId,
  title = "Select Image",
}: ImageSelectorDialogProps) {
  const [images, setImages] = useState<UserImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetchImages = useCallback(async (cursorParam?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (cursorParam) {
        params.set("cursor", cursorParam);
      }

      const response = await fetch(`/api/images?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch images");
      }

      const data = await response.json();

      if (cursorParam) {
        setImages(prev => [...prev, ...data.images]);
      } else {
        setImages(data.images);
      }

      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
    } catch (err) {
      console.error("Failed to fetch images:", err);
      setError("Failed to load images. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchImages();
    } else {
      // Reset state when dialog closes
      setImages([]);
      setCursor(null);
      setHasMore(false);
    }
  }, [open, fetchImages]);

  const handleLoadMore = useCallback(() => {
    if (cursor && !isLoading) {
      fetchImages(cursor);
    }
  }, [cursor, isLoading, fetchImages]);

  const handleSelect = useCallback(
    (image: UserImage) => {
      onSelect({
        type: "gallery",
        id: image.id,
        url: image.url,
        name: image.name,
        width: image.width,
        height: image.height,
      });
      onOpenChange(false);
    },
    [onSelect, onOpenChange],
  );

  const filteredImages = excludeImageId
    ? images.filter(img => img.id !== excludeImageId)
    : images;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Choose an image from your gallery to use in the mix
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {error
            ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" onClick={() => fetchImages()}>
                  Try Again
                </Button>
              </div>
            )
            : isLoading && images.length === 0
            ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )
            : filteredImages.length === 0
            ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <p className="text-muted-foreground">No images found</p>
                <p className="text-sm text-muted-foreground">
                  Upload some images to your gallery first
                </p>
              </div>
            )
            : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
                  {filteredImages.map(image => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => handleSelect(image)}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden",
                        "border border-transparent hover:border-primary",
                        "transition-all focus:outline-none focus:ring-2 focus:ring-primary",
                        "group",
                      )}
                    >
                      <Image
                        src={image.url}
                        alt={image.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      />
                      {/* Hover overlay */}
                      <div
                        className={cn(
                          "absolute inset-0 bg-black/0 group-hover:bg-black/30",
                          "transition-colors flex items-end",
                        )}
                      >
                        <div
                          className={cn(
                            "w-full p-2 bg-gradient-to-t from-black/60 to-transparent",
                            "opacity-0 group-hover:opacity-100 transition-opacity",
                          )}
                        >
                          <p className="text-xs text-white truncate">
                            {image.name}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {hasMore && (
                  <div className="flex justify-center py-4">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={isLoading}
                    >
                      {isLoading
                        ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        )
                        : (
                          "Load More"
                        )}
                    </Button>
                  </div>
                )}
              </>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
