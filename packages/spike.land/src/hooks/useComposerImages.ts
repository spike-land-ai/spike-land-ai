"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ComposerImage {
  id: string;
  file: File;
  previewUrl: string; // objectURL
  uploadedUrl?: string; // R2 URL after upload
  isUploading: boolean;
  error?: string;
}

interface UseComposerImagesOptions {
  maxImages?: number; // default: 4
  maxSizeBytes?: number; // default: 10MB
  uploadEndpoint?: string; // default: "/api/create/upload-image"
}

interface UseComposerImagesReturn {
  images: ComposerImage[];
  addImages: (files: FileList | File[]) => void;
  removeImage: (id: string) => void;
  clearAll: () => void;
  isDragging: boolean;
  dragHandlers: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
  uploadedUrls: string[]; // convenience: all successfully uploaded URLs
}

let idCounter = 0;
function generateId(): string {
  return `img-${Date.now()}-${idCounter++}`;
}

export function useComposerImages(options?: UseComposerImagesOptions): UseComposerImagesReturn {
  const {
    maxImages = 4,
    maxSizeBytes = 10 * 1024 * 1024,
    uploadEndpoint = "/api/create/upload-image",
  } = options ?? {};
  const [images, setImages] = useState<ComposerImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const objectUrlsRef = useRef<string[]>([]);

  // Cleanup objectURLs on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const uploadImage = useCallback(
    async (image: ComposerImage) => {
      const formData = new FormData();
      formData.append("file", image.file);

      try {
        const res = await fetch(uploadEndpoint, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(data.error || "Upload failed");
        }

        const data = await res.json();
        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id ? { ...img, uploadedUrl: data.url, isUploading: false } : img,
          ),
        );
      } catch (error) {
        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? {
                  ...img,
                  isUploading: false,
                  error: error instanceof Error ? error.message : "Upload failed",
                }
              : img,
          ),
        );
      }
    },
    [uploadEndpoint],
  );

  const addImages = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      setImages((prev) => {
        const remaining = maxImages - prev.length;
        if (remaining <= 0) return prev;

        const validFiles = fileArray
          .filter((f) => f.type.startsWith("image/"))
          .filter((f) => f.size <= maxSizeBytes)
          .slice(0, remaining);

        const newImages: ComposerImage[] = validFiles.map((file) => {
          const previewUrl = URL.createObjectURL(file);
          objectUrlsRef.current.push(previewUrl);
          return {
            id: generateId(),
            file,
            previewUrl,
            isUploading: true,
          };
        });

        // Start uploads (fire-and-forget from state update)
        setTimeout(() => {
          newImages.forEach((img) => uploadImage(img));
        }, 0);

        return [...prev, ...newImages];
      });
    },
    [maxImages, maxSizeBytes, uploadImage],
  );

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) {
        URL.revokeObjectURL(img.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
  }, []);

  const dragHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addImages(e.dataTransfer.files);
      }
    },
  };

  const uploadedUrls = images.filter((img) => img.uploadedUrl).map((img) => img.uploadedUrl!);

  return {
    images,
    addImages,
    removeImage,
    clearAll,
    isDragging,
    dragHandlers,
    uploadedUrls,
  };
}
