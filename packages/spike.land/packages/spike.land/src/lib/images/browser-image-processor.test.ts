import { describe, expect, it, vi } from "vitest";

// Mock the aspect-ratio module since it's a dependency
vi.mock("@/lib/ai/aspect-ratio", () => ({
  detectAspectRatio: vi.fn(),
  getAspectRatioValue: (ratio: string) => {
    const values: Record<string, number> = {
      "1:1": 1.0,
      "3:2": 1.5,
      "2:3": 2 / 3,
      "3:4": 0.75,
      "4:3": 4 / 3,
      "4:5": 0.8,
      "5:4": 1.25,
      "9:16": 9 / 16,
      "16:9": 16 / 9,
      "21:9": 21 / 9,
    };
    return values[ratio] ?? 1.0;
  },
  STANDARD_1K_DIMENSIONS: {
    "1:1": { width: 1024, height: 1024 },
    "16:9": { width: 1376, height: 768 },
    "9:16": { width: 768, height: 1376 },
  },
}));

import {
  calculateCropDimensions,
  calculateDimensionsForArea,
  calculateFinalDimensions,
  DEFAULT_BASE_DIMENSION,
  FALLBACK_FORMAT,
  FALLBACK_QUALITY,
  MAX_DIMENSION,
  WEBP_QUALITY,
} from "./browser-image-processor";

describe("browser-image-processor constants", () => {
  it("MAX_DIMENSION is 4096", () => {
    expect(MAX_DIMENSION).toBe(4096);
  });

  it("DEFAULT_BASE_DIMENSION is 1024", () => {
    expect(DEFAULT_BASE_DIMENSION).toBe(1024);
  });

  it("WEBP_QUALITY is 0.8", () => {
    expect(WEBP_QUALITY).toBe(0.8);
  });

  it("FALLBACK_FORMAT is image/jpeg", () => {
    expect(FALLBACK_FORMAT).toBe("image/jpeg");
  });

  it("FALLBACK_QUALITY is 0.85", () => {
    expect(FALLBACK_QUALITY).toBe(0.85);
  });
});

describe("calculateCropDimensions", () => {
  it("returns no-crop for image already at target ratio", () => {
    // 1:1 ratio, 1000x1000
    const result = calculateCropDimensions(1000, 1000, "1:1");
    expect(result.cropX).toBe(0);
    expect(result.cropY).toBe(0);
    expect(result.cropWidth).toBe(1000);
    expect(result.cropHeight).toBe(1000);
  });

  it("crops horizontally when image is too wide", () => {
    // 2000x1000 image, target 1:1 ratio (1.0)
    // currentRatio = 2.0 > 1.0, so crop horizontally
    const result = calculateCropDimensions(2000, 1000, "1:1");
    expect(result.cropHeight).toBe(1000);
    expect(result.cropWidth).toBe(1000); // height * ratio = 1000 * 1.0
    expect(result.cropX).toBe(500); // (2000 - 1000) / 2
    expect(result.cropY).toBe(0);
  });

  it("crops vertically when image is too tall", () => {
    // 1000x2000 image, target 1:1 ratio (1.0)
    // currentRatio = 0.5 < 1.0, so crop vertically
    const result = calculateCropDimensions(1000, 2000, "1:1");
    expect(result.cropWidth).toBe(1000);
    expect(result.cropHeight).toBe(1000); // width / ratio = 1000 / 1.0
    expect(result.cropX).toBe(0);
    expect(result.cropY).toBe(500); // (2000 - 1000) / 2
  });

  it("handles 16:9 target ratio on wide image", () => {
    // 1920x1080 should be approximately 16:9 already
    const result = calculateCropDimensions(1920, 1080, "16:9");
    // 16/9 = 1.778, 1920/1080 = 1.778 - should be close enough for no crop
    expect(result.cropX).toBe(0);
    expect(result.cropY).toBe(0);
    expect(result.cropWidth).toBe(1920);
    expect(result.cropHeight).toBe(1080);
  });

  it("handles 4:3 target ratio", () => {
    // 1600x1200 is exactly 4:3
    const result = calculateCropDimensions(1600, 1200, "4:3");
    expect(result.cropX).toBe(0);
    expect(result.cropY).toBe(0);
    expect(result.cropWidth).toBe(1600);
    expect(result.cropHeight).toBe(1200);
  });

  it("crops a square image to 16:9", () => {
    // 1000x1000, target 16:9 (1.778)
    // currentRatio = 1.0 < 1.778, so crop vertically
    const result = calculateCropDimensions(1000, 1000, "16:9");
    expect(result.cropWidth).toBe(1000);
    expect(result.cropHeight).toBe(Math.round(1000 / (16 / 9)));
    expect(result.cropX).toBe(0);
    expect(result.cropY).toBeGreaterThan(0);
  });

  it("crops a square image to 9:16", () => {
    // 1000x1000, target 9:16 (0.5625)
    // currentRatio = 1.0 > 0.5625, so crop horizontally
    const result = calculateCropDimensions(1000, 1000, "9:16");
    expect(result.cropHeight).toBe(1000);
    expect(result.cropWidth).toBe(Math.round(1000 * (9 / 16)));
    expect(result.cropY).toBe(0);
    expect(result.cropX).toBeGreaterThan(0);
  });
});

describe("calculateFinalDimensions", () => {
  it("returns original dimensions if within max", () => {
    const result = calculateFinalDimensions(800, 600, 1024);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it("returns exact dimensions when both equal to max", () => {
    const result = calculateFinalDimensions(1024, 1024, 1024);
    expect(result.width).toBe(1024);
    expect(result.height).toBe(1024);
  });

  it("scales down when width exceeds max", () => {
    const result = calculateFinalDimensions(2048, 1024, 1024);
    expect(result.width).toBe(1024);
    expect(result.height).toBe(512);
  });

  it("scales down when height exceeds max", () => {
    const result = calculateFinalDimensions(1024, 2048, 1024);
    expect(result.width).toBe(512);
    expect(result.height).toBe(1024);
  });

  it("scales down when both exceed max", () => {
    const result = calculateFinalDimensions(4096, 4096, 1024);
    expect(result.width).toBe(1024);
    expect(result.height).toBe(1024);
  });

  it("does not upscale small images", () => {
    const result = calculateFinalDimensions(100, 50, 1024);
    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
  });

  it("preserves aspect ratio when scaling down", () => {
    const result = calculateFinalDimensions(3000, 2000, 1500);
    const originalRatio = 3000 / 2000;
    const resultRatio = result.width / result.height;
    expect(Math.abs(originalRatio - resultRatio)).toBeLessThan(0.01);
  });
});

describe("calculateDimensionsForArea", () => {
  it("does not upscale when source area is smaller than target", () => {
    const result = calculateDimensionsForArea(1.0, 1024, 500, 500);
    expect(result.width).toBe(500);
    expect(result.height).toBe(500);
  });

  it("scales down when source area exceeds target area", () => {
    const result = calculateDimensionsForArea(1.0, 1024, 4096, 4096);
    expect(result.width).toBe(1024);
    expect(result.height).toBe(1024);
  });

  it("preserves aspect ratio for 16:9 when scaling down", () => {
    const aspectRatio = 16 / 9;
    const result = calculateDimensionsForArea(aspectRatio, 1024, 3840, 2160);
    const resultRatio = result.width / result.height;
    expect(Math.abs(resultRatio - aspectRatio)).toBeLessThan(0.05);
  });

  it("does not upscale small 16:9 image", () => {
    const result = calculateDimensionsForArea(16 / 9, 1024, 800, 450);
    expect(result.width).toBe(800);
    expect(result.height).toBe(450);
  });

  it("targets approximately baseDimension^2 total pixels", () => {
    const base = 1024;
    const targetArea = base * base;
    const result = calculateDimensionsForArea(1.0, base, 5000, 5000);
    const resultArea = result.width * result.height;
    // Should be close to targetArea
    expect(Math.abs(resultArea - targetArea)).toBeLessThan(targetArea * 0.05);
  });
});
