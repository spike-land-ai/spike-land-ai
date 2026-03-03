/**
 * Lightweight image dimension reader
 *
 * Reads image dimensions from file headers without loading the full image.
 * Works with JPEG, PNG, WebP, and GIF formats.
 *
 * This replaces server-side sharp usage for dimension detection,
 * enabling Yarn PnP zero-install without native dependencies.
 */

export interface ImageDimensions {
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp" | "gif" | "unknown";
}

/**
 * Read dimensions from a PNG image
 * PNG stores dimensions in IHDR chunk at fixed offset
 */
function readPngDimensions(buffer: Buffer): ImageDimensions | null {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.length < 24) return null;

  // Check PNG magic bytes
  const isPng = buffer.readUInt8(0) === 0x89
    && buffer.readUInt8(1) === 0x50
    && buffer.readUInt8(2) === 0x4e
    && buffer.readUInt8(3) === 0x47;

  if (!isPng) return null;

  // IHDR chunk is at bytes 8-24, dimensions at 16-24
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  return { width, height, format: "png" };
}

/**
 * Read dimensions from a JPEG image
 * JPEG stores dimensions in SOF0/SOF2 markers
 */
function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  // JPEG signature: FF D8 FF
  if (
    buffer.length < 4 || buffer.readUInt8(0) !== 0xff
    || buffer.readUInt8(1) !== 0xd8
  ) {
    return null;
  }

  let offset = 2;
  while (offset < buffer.length - 1) {
    // Look for marker
    const firstByte = buffer.readUInt8(offset);
    if (firstByte !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer.readUInt8(offset + 1);

    // SOF0 (Baseline) or SOF2 (Progressive)
    if (marker === 0xc0 || marker === 0xc2) {
      if (offset + 9 > buffer.length) return null;
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height, format: "jpeg" };
    }

    // Skip other markers
    if (marker >= 0xc0 && marker <= 0xfe) {
      if (offset + 4 > buffer.length) return null;
      const length = buffer.readUInt16BE(offset + 2);
      offset += 2 + length;
    } else {
      offset += 2;
    }
  }

  return null;
}

/**
 * Read dimensions from a WebP image
 * WebP has multiple formats: VP8, VP8L, VP8X
 */
function readWebpDimensions(buffer: Buffer): ImageDimensions | null {
  // RIFF....WEBP signature
  if (buffer.length < 30) return null;

  // Check RIFF and WEBP magic bytes
  const isWebp = buffer.toString("ascii", 0, 4) === "RIFF"
    && buffer.toString("ascii", 8, 12) === "WEBP";

  if (!isWebp) return null;

  // Check chunk type at offset 12
  const chunkType = buffer.toString("ascii", 12, 16);

  if (chunkType === "VP8 ") {
    // Lossy VP8
    // Frame header starts at offset 23 (12 + 4 chunk type + 4 size + 3 frame tag)
    if (buffer.length < 30) return null;
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height, format: "webp" };
  }

  if (chunkType === "VP8L") {
    // Lossless VP8L
    if (buffer.length < 25) return null;
    // Dimensions are packed in 4 bytes starting at offset 21
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height, format: "webp" };
  }

  if (chunkType === "VP8X") {
    // Extended VP8X
    if (buffer.length < 30) return null;
    // Canvas size at offset 24-30 (24-bit width-1, 24-bit height-1)
    const width = buffer.readUIntLE(24, 3) + 1;
    const height = buffer.readUIntLE(27, 3) + 1;
    return { width, height, format: "webp" };
  }

  return null;
}

/**
 * Read dimensions from a GIF image
 */
function readGifDimensions(buffer: Buffer): ImageDimensions | null {
  // GIF signature: GIF87a or GIF89a
  if (buffer.length < 10) return null;

  // Check GIF magic bytes
  const signature = buffer.toString("ascii", 0, 3);
  if (signature !== "GIF") return null;

  // Dimensions at offset 6-10 (little-endian)
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);

  return { width, height, format: "gif" };
}

/**
 * Read image dimensions from a buffer
 *
 * @param buffer - Image data buffer
 * @returns Image dimensions and format, or null if format is not supported
 */
export function getImageDimensionsFromBuffer(
  buffer: Buffer,
): ImageDimensions | null {
  // Try each format detector
  const png = readPngDimensions(buffer);
  if (png) return png;

  const jpeg = readJpegDimensions(buffer);
  if (jpeg) return jpeg;

  const webp = readWebpDimensions(buffer);
  if (webp) return webp;

  const gif = readGifDimensions(buffer);
  if (gif) return gif;

  return null;
}

/**
 * Get default dimensions if detection fails
 * Used as a fallback for processing pipelines
 */
export function getDefaultDimensions(): ImageDimensions {
  return { width: 1024, height: 1024, format: "unknown" };
}

/**
 * Detect MIME type from buffer
 */
export function detectMimeType(buffer: Buffer): string {
  const dims = getImageDimensionsFromBuffer(buffer);
  if (!dims) return "image/jpeg"; // Default fallback

  switch (dims.format) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "jpeg":
    default:
      return "image/jpeg";
  }
}
