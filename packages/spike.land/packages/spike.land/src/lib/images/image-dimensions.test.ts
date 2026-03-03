import { describe, expect, it } from "vitest";

import {
  detectMimeType,
  getDefaultDimensions,
  getImageDimensionsFromBuffer,
} from "./image-dimensions";

// Helper to create a minimal PNG buffer
function createPngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  // PNG signature
  buf.writeUInt8(0x89, 0);
  buf.writeUInt8(0x50, 1);
  buf.writeUInt8(0x4e, 2);
  buf.writeUInt8(0x47, 3);
  buf.writeUInt8(0x0d, 4);
  buf.writeUInt8(0x0a, 5);
  buf.writeUInt8(0x1a, 6);
  buf.writeUInt8(0x0a, 7);
  // IHDR chunk (skipping length and type bytes 8-15)
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

// Helper to create a minimal JPEG buffer with SOF0 marker
function createJpegBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(11);
  // JPEG signature
  buf.writeUInt8(0xff, 0);
  buf.writeUInt8(0xd8, 1);
  // SOF0 marker
  buf.writeUInt8(0xff, 2);
  buf.writeUInt8(0xc0, 3);
  // Segment length (dummy)
  buf.writeUInt16BE(8, 4);
  // Precision (dummy)
  buf.writeUInt8(8, 6);
  // Height and width
  buf.writeUInt16BE(height, 7);
  buf.writeUInt16BE(width, 9);
  return buf;
}

// Helper to create a minimal GIF buffer
function createGifBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(10);
  // GIF signature
  buf.write("GIF89a", 0, 6, "ascii");
  // Width and height (little-endian)
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

// Helper to create a minimal WebP VP8 buffer
function createWebpVP8Buffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  // RIFF signature
  buf.write("RIFF", 0, 4, "ascii");
  // File size (dummy)
  buf.writeUInt32LE(22, 4);
  // WEBP signature
  buf.write("WEBP", 8, 4, "ascii");
  // VP8 chunk type
  buf.write("VP8 ", 12, 4, "ascii");
  // Chunk size (dummy)
  buf.writeUInt32LE(10, 16);
  // Frame tag (3 bytes, dummy)
  buf.writeUInt8(0x9d, 20);
  buf.writeUInt8(0x01, 21);
  buf.writeUInt8(0x2a, 22);
  // Padding byte
  buf.writeUInt8(0, 23);
  // Padding bytes for frame header start at 23, dims at 26-30
  buf.writeUInt16LE(width & 0x3fff, 26);
  buf.writeUInt16LE(height & 0x3fff, 28);
  return buf;
}

describe("getImageDimensionsFromBuffer", () => {
  it("reads PNG dimensions", () => {
    const buf = createPngBuffer(800, 600);
    const dims = getImageDimensionsFromBuffer(buf);
    expect(dims).toEqual({ width: 800, height: 600, format: "png" });
  });

  it("reads JPEG dimensions", () => {
    const buf = createJpegBuffer(1920, 1080);
    const dims = getImageDimensionsFromBuffer(buf);
    expect(dims).toEqual({ width: 1920, height: 1080, format: "jpeg" });
  });

  it("reads GIF dimensions", () => {
    const buf = createGifBuffer(320, 240);
    const dims = getImageDimensionsFromBuffer(buf);
    expect(dims).toEqual({ width: 320, height: 240, format: "gif" });
  });

  it("reads WebP VP8 dimensions", () => {
    const buf = createWebpVP8Buffer(640, 480);
    const dims = getImageDimensionsFromBuffer(buf);
    expect(dims).toEqual({ width: 640, height: 480, format: "webp" });
  });

  it("returns null for unrecognized format", () => {
    const buf = Buffer.from("not an image");
    expect(getImageDimensionsFromBuffer(buf)).toBeNull();
  });

  it("returns null for empty buffer", () => {
    const buf = Buffer.alloc(0);
    expect(getImageDimensionsFromBuffer(buf)).toBeNull();
  });

  it("returns null for too-short PNG buffer", () => {
    const buf = Buffer.alloc(10);
    buf.writeUInt8(0x89, 0);
    buf.writeUInt8(0x50, 1);
    expect(getImageDimensionsFromBuffer(buf)).toBeNull();
  });

  it("returns null for too-short JPEG buffer", () => {
    const buf = Buffer.alloc(3);
    buf.writeUInt8(0xff, 0);
    buf.writeUInt8(0xd8, 1);
    expect(getImageDimensionsFromBuffer(buf)).toBeNull();
  });

  it("returns null for too-short GIF buffer", () => {
    const buf = Buffer.alloc(5);
    buf.write("GIF89", 0, 5, "ascii");
    expect(getImageDimensionsFromBuffer(buf)).toBeNull();
  });
});

describe("getDefaultDimensions", () => {
  it("returns 1024x1024 unknown format", () => {
    const dims = getDefaultDimensions();
    expect(dims).toEqual({ width: 1024, height: 1024, format: "unknown" });
  });
});

describe("detectMimeType", () => {
  it("returns image/png for PNG buffer", () => {
    expect(detectMimeType(createPngBuffer(100, 100))).toBe("image/png");
  });

  it("returns image/jpeg for JPEG buffer", () => {
    expect(detectMimeType(createJpegBuffer(100, 100))).toBe("image/jpeg");
  });

  it("returns image/gif for GIF buffer", () => {
    expect(detectMimeType(createGifBuffer(100, 100))).toBe("image/gif");
  });

  it("returns image/webp for WebP buffer", () => {
    expect(detectMimeType(createWebpVP8Buffer(100, 100))).toBe("image/webp");
  });

  it("returns image/jpeg as default for unknown format", () => {
    expect(detectMimeType(Buffer.from("unknown"))).toBe("image/jpeg");
  });
});
