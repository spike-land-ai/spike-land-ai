"use client";

import { MasonryGridUniform } from "@/components/ui/masonry-grid";
import { memo, useCallback, useState } from "react";
import { GalleryItem } from "./GalleryItem";
import { ImageModal } from "./ImageModal";
import type { PublicImage } from "./types";

interface GalleryGridProps {
  images: PublicImage[];
}

export const GalleryGrid = memo(function GalleryGrid({
  images,
}: GalleryGridProps) {
  const [selectedImage, setSelectedImage] = useState<PublicImage | null>(null);

  const handleSelect = useCallback((image: PublicImage) => {
    setSelectedImage(image);
  }, []);

  if (images.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-lg">No public images found.</p>
      </div>
    );
  }

  return (
    <>
      <MasonryGridUniform zoomLevel={3}>
        {images.map(image => <GalleryItem key={image.id} image={image} onSelect={handleSelect} />)}
      </MasonryGridUniform>

      <ImageModal
        image={selectedImage}
        open={!!selectedImage}
        onOpenChange={open => !open && setSelectedImage(null)}
      />
    </>
  );
});
