import { describe, expect, it } from "vitest";
import {
  detectAspectRatio,
  getAspectRatioValue,
  isValidAspectRatio,
  STANDARD_1K_DIMENSIONS,
  SUPPORTED_ASPECT_RATIOS,
} from "./aspect-ratio";

describe("aspect-ratio", () => {
  describe("detectAspectRatio", () => {
    it("should detect exact aspect ratios", () => {
      expect(detectAspectRatio(1024, 1024)).toBe("1:1");
      expect(detectAspectRatio(1920, 1080)).toBe("16:9");
      expect(detectAspectRatio(1080, 1920)).toBe("9:16");
      expect(detectAspectRatio(800, 600)).toBe("4:3");
    });

    it("should detect the closest aspect ratio for inexact dimensions", () => {
      // 1000x1000 is closest to 1:1
      expect(detectAspectRatio(1000, 1000)).toBe("1:1");
      // 1920x1200 is 1.6 (closest to 1.5 = 3:2 or 1.77 = 16:9? 1.5 is closer)
      expect(detectAspectRatio(1920, 1200)).toBe("3:2");
      // 480x600 is 0.8 which is exactly 4:5
      expect(detectAspectRatio(480, 600)).toBe("4:5");
    });

    it("should return a default for invalid dimensions", () => {
      expect(detectAspectRatio(0, 100)).toBe("1:1");
      expect(detectAspectRatio(100, -50)).toBe("1:1");
      expect(detectAspectRatio(0, 0)).toBe("1:1");
    });
  });

  describe("isValidAspectRatio", () => {
    it("should return true for all supported aspect ratios", () => {
      for (const ratio of SUPPORTED_ASPECT_RATIOS) {
        expect(isValidAspectRatio(ratio)).toBe(true);
      }
    });

    it("should return false for unsupported or invalid strings", () => {
      expect(isValidAspectRatio("10:10")).toBe(false);
      expect(isValidAspectRatio("invalid")).toBe(false);
      expect(isValidAspectRatio("")).toBe(false);
    });
  });

  describe("getAspectRatioValue", () => {
    it("should return the correct numeric value for a ratio", () => {
      expect(getAspectRatioValue("1:1")).toBe(1.0);
      expect(getAspectRatioValue("16:9")).toBe(16 / 9);
      expect(getAspectRatioValue("9:16")).toBe(9 / 16);
      expect(getAspectRatioValue("4:3")).toBe(4 / 3);
      expect(getAspectRatioValue("3:4")).toBe(0.75);
    });
  });

  describe("STANDARD_1K_DIMENSIONS", () => {
    it("should have an entry for each supported ratio", () => {
      for (const ratio of SUPPORTED_ASPECT_RATIOS) {
        expect(STANDARD_1K_DIMENSIONS[ratio]).toBeDefined();
        expect(STANDARD_1K_DIMENSIONS[ratio].width).toBeGreaterThan(0);
        expect(STANDARD_1K_DIMENSIONS[ratio].height).toBeGreaterThan(0);

        // Ensure the dimensions roughly match the theoretical ratio
        const actualRatio =
          STANDARD_1K_DIMENSIONS[ratio].width / STANDARD_1K_DIMENSIONS[ratio].height;
        const expectedRatio = getAspectRatioValue(ratio);
        // within ~5% tolerance due to pixel rounding
        expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(0.05);
      }
    });
  });
});
