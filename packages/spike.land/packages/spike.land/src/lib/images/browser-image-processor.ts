"use client";

/**
 * Browser-side image processing for upload optimization
 *
 * Processes images before upload to:
 * - Resize to max 1024px dimension
 * - Crop to supported aspect ratio
 * - Convert to WebP format (with JPEG fallback)
 */

import {
  type AspectRatio,
  detectAspectRatio,
  getAspectRatioValue,
  STANDARD_1K_DIMENSIONS,
} from "@/lib/ai/aspect-ratio";

// Constants
export const MAX_DIMENSION = 4096;
export const DEFAULT_BASE_DIMENSION = 1024;
export const WEBP_QUALITY = 0.8;
export const FALLBACK_FORMAT = "image/jpeg";
export const FALLBACK_QUALITY = 0.85;

export interface ProcessedImage {
  blob: Blob;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  originalWidth: number;
  originalHeight: number;
}

interface ProcessingOptions {
  maxDimension?: number;
  /** Use standard 1K dimensions (~1024px) matched to the detected aspect ratio */
  useStandard1K?: boolean;
  quality?: number;
  forceAspectRatio?: AspectRatio;
}

interface CropDimensions {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
}

/**
 * Check if browser supports WebP export
 */
function supportsWebP(): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

/**
 * Calculate crop dimensions to match target aspect ratio
 * Trims equal amounts from each side
 */
export function calculateCropDimensions(
  width: number,
  height: number,
  targetRatio: AspectRatio,
): CropDimensions {
  const ratioValue = getAspectRatioValue(targetRatio);
  const currentRatio = width / height;

  let cropWidth: number;
  let cropHeight: number;
  let cropX: number;
  let cropY: number;

  if (Math.abs(currentRatio - ratioValue) < 0.001) {
    // Already at target ratio
    return { cropX: 0, cropY: 0, cropWidth: width, cropHeight: height };
  }

  if (currentRatio > ratioValue) {
    // Image is too wide - crop horizontally
    cropHeight = height;
    cropWidth = Math.round(height * ratioValue);
    cropX = Math.round((width - cropWidth) / 2);
    cropY = 0;
  } else {
    // Image is too tall - crop vertically
    cropWidth = width;
    cropHeight = Math.round(width / ratioValue);
    cropX = 0;
    cropY = Math.round((height - cropHeight) / 2);
  }

  return { cropX, cropY, cropWidth, cropHeight };
}

/**
 * Calculate final dimensions after resize
 * Maintains aspect ratio, max dimension = maxDimension
 * Does not upscale small images
 */
export function calculateFinalDimensions(
  cropWidth: number,
  cropHeight: number,
  maxDimension: number,
): { width: number; height: number; } {
  if (cropWidth <= maxDimension && cropHeight <= maxDimension) {
    // No resize needed
    return { width: cropWidth, height: cropHeight };
  }

  const scale = maxDimension / Math.max(cropWidth, cropHeight);
  return {
    width: Math.round(cropWidth * scale),
    height: Math.round(cropHeight * scale),
  };
}

/**
 * Calculate dimensions so that width × height ≈ baseDimension²,
 * preserving the given aspect ratio. Does not upscale.
 */
export function calculateDimensionsForArea(
  aspectRatio: number,
  baseDimension: number,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number; } {
  const targetArea = baseDimension * baseDimension;
  const sourceArea = sourceWidth * sourceHeight;

  if (sourceArea <= targetArea) {
    return { width: sourceWidth, height: sourceHeight };
  }

  const width = Math.round(Math.sqrt(targetArea * aspectRatio));
  const height = Math.round(Math.sqrt(targetArea / aspectRatio));
  return { width, height };
}

/**
 * Process an image file for upload
 *
 * @param file - Image file to process
 * @param options - Processing options
 * @returns Processed image with blob, base64, and metadata
 */
export async function processImageForUpload(
  file: File,
  options: ProcessingOptions = {},
): Promise<ProcessedImage> {
  const {
    maxDimension = MAX_DIMENSION,
    useStandard1K = false,
    quality = WEBP_QUALITY,
    forceAspectRatio,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      try {
        const { naturalWidth, naturalHeight } = img;

        // Detect or use forced aspect ratio
        const targetRatio = forceAspectRatio
          || detectAspectRatio(naturalWidth, naturalHeight);

        // Calculate crop dimensions
        const { cropX, cropY, cropWidth, cropHeight } = calculateCropDimensions(
          naturalWidth,
          naturalHeight,
          targetRatio,
        );

        // Calculate final dimensions after resize
        let finalWidth: number, finalHeight: number;
        if (useStandard1K) {
          // Use exact standard 1K dimensions for the detected AR
          const standardDims = STANDARD_1K_DIMENSIONS[targetRatio];
          // Don't upscale: if source crop is smaller than standard dims, keep source size
          if (
            cropWidth <= standardDims.width && cropHeight <= standardDims.height
          ) {
            finalWidth = cropWidth;
            finalHeight = cropHeight;
          } else {
            finalWidth = standardDims.width;
            finalHeight = standardDims.height;
          }
        } else {
          ({ width: finalWidth, height: finalHeight } = calculateFinalDimensions(
            cropWidth,
            cropHeight,
            maxDimension,
          ));
        }

        // Create canvas and apply crop + resize
        const canvas = document.createElement("canvas");
        canvas.width = finalWidth;
        canvas.height = finalHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Draw cropped and resized image
        ctx.drawImage(
          img,
          cropX,
          cropY,
          cropWidth,
          cropHeight, // Source rect (crop)
          0,
          0,
          finalWidth,
          finalHeight, // Dest rect (resize)
        );

        // Determine output format
        const useWebP = supportsWebP();
        const mimeType = useWebP ? "image/webp" : FALLBACK_FORMAT;
        const outputQuality = useWebP ? quality : FALLBACK_QUALITY;

        // Convert to blob
        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error("Failed to create image blob"));
              return;
            }

            // Get base64
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              const base64 = dataUrl.split(",")[1];

              if (!base64) {
                reject(new Error("Failed to encode image to base64"));
                return;
              }

              resolve({
                blob,
                base64,
                mimeType,
                width: finalWidth,
                height: finalHeight,
                aspectRatio: targetRatio,
                originalWidth: naturalWidth,
                originalHeight: naturalHeight,
              });
            };
            reader.onerror = () => reject(new Error("Failed to read blob"));
            reader.readAsDataURL(blob);
          },
          mimeType,
          outputQuality,
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    img.src = objectUrl;
  });
}
