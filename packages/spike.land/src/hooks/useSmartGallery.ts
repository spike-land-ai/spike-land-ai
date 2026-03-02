import type { GalleryImage, GalleryViewMode } from "@/lib/canvas/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UseSmartGalleryOptions {
  images: GalleryImage[];
  initialSelectedId?: string | null;
  autoSelectInterval?: number; // For grid auto-cycle (in milliseconds)
}

interface UseSmartGalleryReturn {
  // View state
  viewMode: GalleryViewMode;

  // Selection state
  selectedImageId: string | null;
  selectedImage: GalleryImage | null;
  currentIndex: number;

  // Peek state (showing original)
  isPeeking: boolean;

  // Transition state
  isTransitioning: boolean;

  // Actions
  selectImage: (id: string, element?: HTMLElement) => void;
  enterSlideshow: () => void;
  exitSlideshow: () => void;
  goToNext: () => void;
  goToPrev: () => void;
  startPeek: () => void;
  endPeek: () => void;

  // For FLIP animation
  getTransitionOrigin: () => DOMRect | null;
  setTransitionOrigin: (rect: DOMRect | null) => void;
}

export function useSmartGallery({
  images,
  initialSelectedId = null,
  autoSelectInterval,
}: UseSmartGalleryOptions): UseSmartGalleryReturn {
  // View state
  const [viewMode, setViewMode] = useState<GalleryViewMode>("grid");

  // Selection state
  const [selectedImageId, setSelectedImageId] = useState<string | null>(initialSelectedId);

  // Peek state
  const [isPeeking, setIsPeeking] = useState(false);

  // Transition state
  const [isTransitioning, setIsTransitioning] = useState(false);

  // FLIP animation origin
  const transitionOriginRef = useRef<DOMRect | null>(null);

  // Auto-cycle timer ref
  const autoCycleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Transition timeout ref
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Compute selected image and current index
  const { selectedImage, currentIndex } = useMemo(() => {
    if (!selectedImageId || images.length === 0) {
      return { selectedImage: null, currentIndex: -1 };
    }

    const index = images.findIndex((img) => img.id === selectedImageId);
    if (index === -1) {
      return { selectedImage: null, currentIndex: -1 };
    }

    const image = images[index];
    return { selectedImage: image ?? null, currentIndex: index };
  }, [selectedImageId, images]);

  // Clear auto-cycle timer helper
  const clearAutoCycleTimer = useCallback(() => {
    if (autoCycleTimerRef.current) {
      clearInterval(autoCycleTimerRef.current);
      autoCycleTimerRef.current = null;
    }
  }, []);

  // Start auto-cycle timer helper
  const startAutoCycleTimer = useCallback(() => {
    if (!autoSelectInterval || autoSelectInterval <= 0 || images.length === 0) {
      return;
    }

    clearAutoCycleTimer();

    autoCycleTimerRef.current = setInterval(() => {
      setSelectedImageId((prevId) => {
        if (!prevId) {
          // Select first image if nothing selected
          return images[0]?.id ?? null;
        }

        const currentIdx = images.findIndex((img) => img.id === prevId);
        if (currentIdx === -1) {
          return images[0]?.id ?? null;
        }

        // Move to next image, wrapping around
        const nextIdx = (currentIdx + 1) % images.length;
        return images[nextIdx]?.id ?? null;
      });
    }, autoSelectInterval);
  }, [autoSelectInterval, images, clearAutoCycleTimer]);

  // Select image action
  const selectImage = useCallback((id: string, element?: HTMLElement) => {
    if (element) {
      transitionOriginRef.current = element.getBoundingClientRect();
    }
    setSelectedImageId(id);
  }, []);

  // Enter slideshow action
  const enterSlideshow = useCallback(() => {
    setIsTransitioning(true);
    setViewMode("slideshow");

    // Clear any existing transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
      transitionTimeoutRef.current = null;
    }, 300);
  }, []);

  // Exit slideshow action
  const exitSlideshow = useCallback(() => {
    setIsTransitioning(true);
    setViewMode("grid");

    // Clear any existing transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
      transitionTimeoutRef.current = null;
    }, 300);
  }, []);

  // Go to next image
  const goToNext = useCallback(() => {
    if (images.length === 0) return;

    setSelectedImageId((prevId) => {
      if (!prevId) {
        return images[0]?.id ?? null;
      }

      const currentIdx = images.findIndex((img) => img.id === prevId);
      if (currentIdx === -1) {
        return images[0]?.id ?? null;
      }

      const nextIdx = (currentIdx + 1) % images.length;
      return images[nextIdx]?.id ?? null;
    });
  }, [images]);

  // Go to previous image
  const goToPrev = useCallback(() => {
    if (images.length === 0) return;

    setSelectedImageId((prevId) => {
      if (!prevId) {
        return images[images.length - 1]?.id ?? null;
      }

      const currentIdx = images.findIndex((img) => img.id === prevId);
      if (currentIdx === -1) {
        return images[images.length - 1]?.id ?? null;
      }

      const prevIdx = currentIdx === 0 ? images.length - 1 : currentIdx - 1;
      return images[prevIdx]?.id ?? null;
    });
  }, [images]);

  // Start peek (show original)
  const startPeek = useCallback(() => {
    setIsPeeking(true);
  }, []);

  // End peek
  const endPeek = useCallback(() => {
    setIsPeeking(false);
  }, []);

  // Get transition origin
  const getTransitionOrigin = useCallback(() => {
    return transitionOriginRef.current;
  }, []);

  // Set transition origin
  const setTransitionOrigin = useCallback((rect: DOMRect | null) => {
    transitionOriginRef.current = rect;
  }, []);

  // Initialize auto-cycle in both grid and slideshow modes
  useEffect(() => {
    if (autoSelectInterval && autoSelectInterval > 0 && images.length > 1) {
      startAutoCycleTimer();
    } else {
      clearAutoCycleTimer();
    }

    return clearAutoCycleTimer;
  }, [autoSelectInterval, images.length, startAutoCycleTimer, clearAutoCycleTimer]);

  // Handle images prop changes
  useEffect(() => {
    if (images.length === 0) {
      setSelectedImageId(null);
      return;
    }

    // If current selection is invalid, reset to null
    if (selectedImageId && !images.some((img) => img.id === selectedImageId)) {
      setSelectedImageId(null);
    }
  }, [images, selectedImageId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoCycleTimerRef.current) {
        clearInterval(autoCycleTimerRef.current);
      }
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  return {
    viewMode,
    selectedImageId,
    selectedImage,
    currentIndex,
    isPeeking,
    isTransitioning,
    selectImage,
    enterSlideshow,
    exitSlideshow,
    goToNext,
    goToPrev,
    startPeek,
    endPeek,
    getTransitionOrigin,
    setTransitionOrigin,
  };
}
