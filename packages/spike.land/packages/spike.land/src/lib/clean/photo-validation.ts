/**
 * Photo Validation — EXIF Parsing & Freshness Check
 * Pure functions, no DB. Uses exif-reader for EXIF parsing.
 */

import exifReader from "exif-reader";

export interface PhotoValidationResult {
  valid: boolean;
  ageSeconds: number | null;
  cameraModel: string | null;
  rejectionReason: string | null;
  isScreenshot: boolean;
}

/** Parse EXIF data from a JPEG buffer */
function extractExif(buffer: Buffer): Record<string, unknown> | null {
  try {
    // Find EXIF marker (0xFFE1) in JPEG
    let offset = 2; // Skip SOI marker
    while (offset < buffer.length - 1) {
      if (buffer[offset] === 0xff && buffer[offset + 1] === 0xe1) {
        const length = buffer.readUInt16BE(offset + 2);
        const exifData = buffer.subarray(offset + 4, offset + 2 + length);
        // Skip "Exif\0\0" header (6 bytes)
        if (
          exifData.length > 6 && exifData.toString("ascii", 0, 4) === "Exif"
        ) {
          return exifReader(exifData.subarray(6)) as Record<string, unknown>;
        }
      }
      if (buffer[offset] === 0xff) {
        const segLen = buffer.readUInt16BE(offset + 2);
        offset += 2 + segLen;
      } else {
        break;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Detect if photo is a screenshot based on EXIF data */
function detectScreenshot(exif: Record<string, unknown> | null): boolean {
  if (!exif) return true; // No EXIF = likely screenshot

  const image = exif.Image as Record<string, unknown> | undefined;
  const photo = exif.Photo as Record<string, unknown> | undefined;

  // Check software field
  const software = (image?.Software ?? "") as string;
  if (software.toLowerCase().includes("screenshot")) return true;

  // No focal length or exposure = likely screenshot
  const focalLength = photo?.FocalLength;
  const exposureTime = photo?.ExposureTime;
  if (!focalLength && !exposureTime) return true;

  return false;
}

const MAX_AGE_SECONDS = 300; // 5 minutes

/** Validate a photo buffer. Returns validation result. Buffer is NOT stored. */
export function validatePhoto(
  base64Data: string,
  maxAgeSeconds: number = MAX_AGE_SECONDS,
): PhotoValidationResult {
  const buffer = Buffer.from(base64Data, "base64");

  const exif = extractExif(buffer);
  const isScreenshot = detectScreenshot(exif);

  if (isScreenshot) {
    return {
      valid: false,
      ageSeconds: null,
      cameraModel: null,
      rejectionReason:
        "Photo appears to be a screenshot. Please take a live photo with your camera.",
      isScreenshot: true,
    };
  }

  // Extract timestamp
  const photo = exif?.Photo as Record<string, unknown> | undefined;
  const image = exif?.Image as Record<string, unknown> | undefined;
  const dateTimeOriginal = photo?.DateTimeOriginal as Date | undefined;
  const dateTime = image?.DateTime as Date | undefined;
  const timestamp = dateTimeOriginal ?? dateTime;

  if (!timestamp) {
    return {
      valid: false,
      ageSeconds: null,
      cameraModel: null,
      rejectionReason: "No timestamp found in photo. Please take a fresh photo.",
      isScreenshot: false,
    };
  }

  const ageSeconds = Math.floor(
    (Date.now() - new Date(timestamp).getTime()) / 1000,
  );
  const cameraModel = (image?.Model ?? null) as string | null;

  if (ageSeconds > maxAgeSeconds) {
    return {
      valid: false,
      ageSeconds,
      cameraModel,
      rejectionReason: `Photo is ${
        Math.floor(ageSeconds / 60)
      } minutes old. Please take a fresh photo (max ${Math.floor(maxAgeSeconds / 60)} minutes).`,
      isScreenshot: false,
    };
  }

  if (ageSeconds < -60) {
    return {
      valid: false,
      ageSeconds,
      cameraModel,
      rejectionReason: "Photo timestamp is in the future. Please check your device clock.",
      isScreenshot: false,
    };
  }

  return {
    valid: true,
    ageSeconds,
    cameraModel,
    rejectionReason: null,
    isScreenshot: false,
  };
}

/** Extract metadata from photo without validation */
export function extractPhotoMetadata(base64Data: string): {
  hasExif: boolean;
  cameraModel: string | null;
  timestamp: Date | null;
  software: string | null;
} {
  const buffer = Buffer.from(base64Data, "base64");
  const exif = extractExif(buffer);

  if (!exif) {
    return {
      hasExif: false,
      cameraModel: null,
      timestamp: null,
      software: null,
    };
  }

  const image = exif.Image as Record<string, unknown> | undefined;
  const photo = exif.Photo as Record<string, unknown> | undefined;

  return {
    hasExif: true,
    cameraModel: (image?.Model ?? null) as string | null,
    timestamp: (photo?.DateTimeOriginal ?? image?.DateTime ?? null) as
      | Date
      | null,
    software: (image?.Software ?? null) as string | null,
  };
}
