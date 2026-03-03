import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPhotoMetadata, validatePhoto } from "./photo-validation";

// Helper: create a minimal JPEG buffer with no EXIF (just SOI + EOI)
function makeNoExifJpeg(): string {
  const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0xff, 0xd9]);
  return buf.toString("base64");
}

// Helper: create a JPEG buffer with a fake EXIF APP1 segment
// This creates a minimal TIFF structure that exif-reader can parse
function makeExifJpeg(opts: {
  dateTimeOriginal?: Date;
  cameraModel?: string;
  software?: string;
  focalLength?: number;
  exposureTime?: number;
}): string {
  // We mock exif-reader for controlled test output since creating
  // valid TIFF/EXIF structures in raw bytes is complex
  // Instead, we test the logic by mocking the module
  void opts;
  // Return a valid-looking JPEG start
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0xff, 0xd9]).toString(
    "base64",
  );
}

// Since building valid EXIF data in raw bytes is complex, we mock exif-reader
// for tests that need specific EXIF values
vi.mock("exif-reader", () => ({
  default: vi.fn().mockReturnValue(null),
}));

describe("Photo Validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validatePhoto", () => {
    it("rejects photo with no EXIF (screenshot detection)", () => {
      const base64 = makeNoExifJpeg();
      const result = validatePhoto(base64);
      expect(result.valid).toBe(false);
      expect(result.isScreenshot).toBe(true);
      expect(result.rejectionReason).toContain("screenshot");
    });

    it("rejects photo that looks like a screenshot (no focal length or exposure)", async () => {
      const { default: exifReader } = await import("exif-reader");
      (exifReader as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        Image: { Software: "iOS Screenshot" },
        Photo: {},
      });

      // Build a buffer with EXIF marker so extractExif tries to parse
      const exifHeader = Buffer.from("Exif\0\0", "ascii");
      const tiffData = Buffer.alloc(8); // minimal TIFF
      const exifPayload = Buffer.concat([exifHeader, tiffData]);
      const lengthBuf = Buffer.alloc(2);
      lengthBuf.writeUInt16BE(exifPayload.length + 2, 0);
      const jpegBuf = Buffer.concat([
        Buffer.from([0xff, 0xd8]), // SOI
        Buffer.from([0xff, 0xe1]), // APP1 marker
        lengthBuf,
        exifPayload,
        Buffer.from([0xff, 0xd9]), // EOI
      ]);

      const result = validatePhoto(jpegBuf.toString("base64"));
      expect(result.valid).toBe(false);
      expect(result.isScreenshot).toBe(true);
    });

    it("rejects old photo (age > max)", async () => {
      const { default: exifReader } = await import("exif-reader");
      const oldDate = new Date(Date.now() - 600_000); // 10 minutes ago
      (exifReader as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        Image: { Model: "iPhone 15", DateTime: oldDate },
        Photo: {
          DateTimeOriginal: oldDate,
          FocalLength: 4.2,
          ExposureTime: 0.01,
        },
      });

      const exifHeader = Buffer.from("Exif\0\0", "ascii");
      const tiffData = Buffer.alloc(8);
      const exifPayload = Buffer.concat([exifHeader, tiffData]);
      const lengthBuf = Buffer.alloc(2);
      lengthBuf.writeUInt16BE(exifPayload.length + 2, 0);
      const jpegBuf = Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        Buffer.from([0xff, 0xe1]),
        lengthBuf,
        exifPayload,
        Buffer.from([0xff, 0xd9]),
      ]);

      const result = validatePhoto(jpegBuf.toString("base64"));
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toContain("minutes old");
      expect(result.isScreenshot).toBe(false);
    });

    it("rejects photo with future timestamp", async () => {
      const { default: exifReader } = await import("exif-reader");
      const futureDate = new Date(Date.now() + 120_000); // 2 minutes in future
      (exifReader as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        Image: { Model: "Canon EOS", DateTime: futureDate },
        Photo: {
          DateTimeOriginal: futureDate,
          FocalLength: 50,
          ExposureTime: 0.005,
        },
      });

      const exifHeader = Buffer.from("Exif\0\0", "ascii");
      const tiffData = Buffer.alloc(8);
      const exifPayload = Buffer.concat([exifHeader, tiffData]);
      const lengthBuf = Buffer.alloc(2);
      lengthBuf.writeUInt16BE(exifPayload.length + 2, 0);
      const jpegBuf = Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        Buffer.from([0xff, 0xe1]),
        lengthBuf,
        exifPayload,
        Buffer.from([0xff, 0xd9]),
      ]);

      const result = validatePhoto(jpegBuf.toString("base64"));
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toContain("future");
    });

    it("accepts valid fresh photo with EXIF", async () => {
      const { default: exifReader } = await import("exif-reader");
      const freshDate = new Date(Date.now() - 30_000); // 30 seconds ago
      (exifReader as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        Image: { Model: "iPhone 15 Pro", DateTime: freshDate },
        Photo: {
          DateTimeOriginal: freshDate,
          FocalLength: 6.86,
          ExposureTime: 0.008,
        },
      });

      const exifHeader = Buffer.from("Exif\0\0", "ascii");
      const tiffData = Buffer.alloc(8);
      const exifPayload = Buffer.concat([exifHeader, tiffData]);
      const lengthBuf = Buffer.alloc(2);
      lengthBuf.writeUInt16BE(exifPayload.length + 2, 0);
      const jpegBuf = Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        Buffer.from([0xff, 0xe1]),
        lengthBuf,
        exifPayload,
        Buffer.from([0xff, 0xd9]),
      ]);

      const result = validatePhoto(jpegBuf.toString("base64"));
      expect(result.valid).toBe(true);
      expect(result.isScreenshot).toBe(false);
      expect(result.cameraModel).toBe("iPhone 15 Pro");
      expect(result.rejectionReason).toBeNull();
      expect(result.ageSeconds).not.toBeNull();
    });

    it("rejects photo with EXIF but no timestamp", async () => {
      const { default: exifReader } = await import("exif-reader");
      (exifReader as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        Image: { Model: "Camera" },
        Photo: { FocalLength: 50, ExposureTime: 0.01 },
      });

      const exifHeader = Buffer.from("Exif\0\0", "ascii");
      const tiffData = Buffer.alloc(8);
      const exifPayload = Buffer.concat([exifHeader, tiffData]);
      const lengthBuf = Buffer.alloc(2);
      lengthBuf.writeUInt16BE(exifPayload.length + 2, 0);
      const jpegBuf = Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        Buffer.from([0xff, 0xe1]),
        lengthBuf,
        exifPayload,
        Buffer.from([0xff, 0xd9]),
      ]);

      const result = validatePhoto(jpegBuf.toString("base64"));
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toContain("No timestamp");
    });
  });

  describe("extractPhotoMetadata", () => {
    it("returns hasExif: false for no-EXIF JPEG", () => {
      const base64 = makeNoExifJpeg();
      const meta = extractPhotoMetadata(base64);
      expect(meta.hasExif).toBe(false);
      expect(meta.cameraModel).toBeNull();
      expect(meta.timestamp).toBeNull();
      expect(meta.software).toBeNull();
    });

    it("returns metadata from photo with EXIF", async () => {
      const { default: exifReader } = await import("exif-reader");
      const date = new Date(2026, 1, 15, 10, 30);
      (exifReader as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        Image: { Model: "Pixel 8", Software: "Google Camera", DateTime: date },
        Photo: { DateTimeOriginal: date },
      });

      const exifHeader = Buffer.from("Exif\0\0", "ascii");
      const tiffData = Buffer.alloc(8);
      const exifPayload = Buffer.concat([exifHeader, tiffData]);
      const lengthBuf = Buffer.alloc(2);
      lengthBuf.writeUInt16BE(exifPayload.length + 2, 0);
      const jpegBuf = Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        Buffer.from([0xff, 0xe1]),
        lengthBuf,
        exifPayload,
        Buffer.from([0xff, 0xd9]),
      ]);

      const meta = extractPhotoMetadata(jpegBuf.toString("base64"));
      expect(meta.hasExif).toBe(true);
      expect(meta.cameraModel).toBe("Pixel 8");
      expect(meta.software).toBe("Google Camera");
      expect(meta.timestamp).toEqual(date);
    });

    it("handles EXIF with missing fields gracefully", async () => {
      const { default: exifReader } = await import("exif-reader");
      (exifReader as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        Image: {},
        Photo: {},
      });

      const exifHeader = Buffer.from("Exif\0\0", "ascii");
      const tiffData = Buffer.alloc(8);
      const exifPayload = Buffer.concat([exifHeader, tiffData]);
      const lengthBuf = Buffer.alloc(2);
      lengthBuf.writeUInt16BE(exifPayload.length + 2, 0);
      const jpegBuf = Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        Buffer.from([0xff, 0xe1]),
        lengthBuf,
        exifPayload,
        Buffer.from([0xff, 0xd9]),
      ]);

      const meta = extractPhotoMetadata(jpegBuf.toString("base64"));
      expect(meta.hasExif).toBe(true);
      expect(meta.cameraModel).toBeNull();
      expect(meta.timestamp).toBeNull();
      expect(meta.software).toBeNull();
    });
  });

  describe("extractExif edge cases", () => {
    it("handles JPEG with non-0xFF byte before EXIF marker (break branch)", () => {
      const jpegBuf = Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from([0xff, 0xd9]),
      ]);
      const result = validatePhoto(jpegBuf.toString("base64"));
      expect(result.valid).toBe(false);
      expect(result.isScreenshot).toBe(true);
    });

    it("handles JPEG with non-EXIF APP1 segment", () => {
      const fakePayload = Buffer.from("NotExif\0\0data", "ascii");
      const lengthBuf = Buffer.alloc(2);
      lengthBuf.writeUInt16BE(fakePayload.length + 2, 0);
      const jpegBuf = Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        Buffer.from([0xff, 0xe1]),
        lengthBuf,
        fakePayload,
        Buffer.from([0xff, 0xd9]),
      ]);
      const result = validatePhoto(jpegBuf.toString("base64"));
      expect(result.valid).toBe(false);
      expect(result.isScreenshot).toBe(true);
    });
  });
});

// Unused helper reference to avoid lint error
void makeExifJpeg;
