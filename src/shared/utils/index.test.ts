import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateOutputDimensions,
  calculateRegeneratedTokens,
  formatCurrency,
  formatDuration,
  formatFileSize,
  formatRelativeTime,
  getEnhancementCost,
  getTierDimensions,
  getTimeUntilNextRegen,
  isAllowedMimeType,
  parseAspectRatio,
} from "./index";

describe("utils", () => {
  describe("getEnhancementCost", () => {
    it("should return correct cost for each tier", () => {
      expect(getEnhancementCost("FREE")).toBe(0);
      expect(getEnhancementCost("TIER_1K")).toBe(2);
      expect(getEnhancementCost("TIER_2K")).toBe(5);
      expect(getEnhancementCost("TIER_4K")).toBe(10);
    });
  });

  describe("calculateRegeneratedTokens", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return 0 if less than one interval has passed", () => {
      const now = new Date();
      vi.setSystemTime(now);
      const lastRegen = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago

      const tokens = calculateRegeneratedTokens(lastRegen, 5);
      expect(tokens).toBe(0);
    });

    it("should return tokens for complete intervals", () => {
      const now = new Date();
      vi.setSystemTime(now);
      const lastRegen = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago (2 intervals)

      const tokens = calculateRegeneratedTokens(lastRegen, 5);
      expect(tokens).toBe(2); // 2 intervals * 1 token per interval
    });

    it("should cap at max tokens", () => {
      const now = new Date();
      vi.setSystemTime(now);
      const lastRegen = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

      const tokens = calculateRegeneratedTokens(lastRegen, 8, 10);
      expect(tokens).toBe(2); // Can only add 2 more to reach max of 10
    });

    it("should return 0 if already at max", () => {
      const now = new Date();
      vi.setSystemTime(now);
      const lastRegen = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

      const tokens = calculateRegeneratedTokens(lastRegen, 10, 10);
      expect(tokens).toBe(0);
    });
  });

  describe("getTimeUntilNextRegen", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return time until next regeneration", () => {
      const now = new Date();
      vi.setSystemTime(now);
      const lastRegen = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago

      const timeUntil = getTimeUntilNextRegen(lastRegen);
      expect(timeUntil).toBe(10 * 60 * 1000); // 10 minutes remaining
    });

    it("should return full interval if just regenerated", () => {
      const now = new Date();
      vi.setSystemTime(now);
      const lastRegen = now;

      const timeUntil = getTimeUntilNextRegen(lastRegen);
      expect(timeUntil).toBe(15 * 60 * 1000); // Full 15 minutes
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("should format kilobytes", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });

    it("should format megabytes", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1 MB");
      expect(formatFileSize(5.5 * 1024 * 1024)).toBe("5.5 MB");
    });

    it("should format gigabytes", () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
    });

    it("should handle zero", () => {
      expect(formatFileSize(0)).toBe("0 B");
    });

    it("should handle negative bytes", () => {
      expect(formatFileSize(-100)).toBe("0 B");
    });

    it("should handle non-finite values", () => {
      expect(formatFileSize(Infinity)).toBe("Unknown");
      expect(formatFileSize(NaN)).toBe("Unknown");
    });
  });

  describe("formatDuration", () => {
    it("should format seconds", () => {
      expect(formatDuration(5000)).toBe("5s");
      expect(formatDuration(45000)).toBe("45s");
    });

    it("should format minutes and seconds", () => {
      expect(formatDuration(90000)).toBe("1m 30s");
      expect(formatDuration(300000)).toBe("5m 0s");
    });

    it("should format hours and minutes", () => {
      expect(formatDuration(3600000)).toBe("1h 0m");
      expect(formatDuration(5400000)).toBe("1h 30m");
    });
  });

  describe("formatRelativeTime", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return 'Just now' for recent dates", () => {
      const now = new Date();
      vi.setSystemTime(now);

      expect(formatRelativeTime(now)).toBe("Just now");
      expect(formatRelativeTime(new Date(now.getTime() - 30000))).toBe("Just now");
    });

    it("should format minutes ago", () => {
      const now = new Date();
      vi.setSystemTime(now);

      expect(formatRelativeTime(new Date(now.getTime() - 5 * 60 * 1000))).toBe("5m ago");
    });

    it("should format hours ago", () => {
      const now = new Date();
      vi.setSystemTime(now);

      expect(formatRelativeTime(new Date(now.getTime() - 3 * 60 * 60 * 1000))).toBe("3h ago");
    });

    it("should format days ago", () => {
      const now = new Date();
      vi.setSystemTime(now);

      expect(formatRelativeTime(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000))).toBe("5d ago");
    });

    it("should return formatted date for dates older than 7 days", () => {
      const now = new Date("2024-03-15T12:00:00Z");
      vi.setSystemTime(now);

      const oldDate = new Date("2024-03-01T12:00:00Z");
      const result = formatRelativeTime(oldDate);
      // Should be a formatted date string, not relative
      expect(result).not.toContain("ago");
    });

    it("should return 'in the future' for future dates", () => {
      const now = new Date();
      vi.setSystemTime(now);

      expect(formatRelativeTime(new Date(now.getTime() + 60000))).toBe("in the future");
    });
  });

  describe("formatCurrency", () => {
    it("should format GBP by default", () => {
      expect(formatCurrency(10)).toBe("£10.00");
      expect(formatCurrency(99.99)).toBe("£99.99");
    });

    it("should format other currencies", () => {
      expect(formatCurrency(10, "USD")).toContain("10.00");
      expect(formatCurrency(10, "EUR")).toContain("10.00");
    });

    it("should handle decimal values", () => {
      expect(formatCurrency(10.5)).toBe("£10.50");
    });
  });

  describe("getTierDimensions", () => {
    it("should return correct dimensions for each tier", () => {
      expect(getTierDimensions("FREE")).toBe(1024);
      expect(getTierDimensions("TIER_1K")).toBe(1024);
      expect(getTierDimensions("TIER_2K")).toBe(2048);
      expect(getTierDimensions("TIER_4K")).toBe(4096);
    });
  });

  describe("parseAspectRatio", () => {
    it("should parse valid aspect ratios", () => {
      expect(parseAspectRatio("16:9")).toEqual({ width: 16, height: 9 });
      expect(parseAspectRatio("1:1")).toEqual({ width: 1, height: 1 });
      expect(parseAspectRatio("4:3")).toEqual({ width: 4, height: 3 });
    });

    it("should return null for invalid formats", () => {
      expect(parseAspectRatio("16-9")).toBeNull();
      expect(parseAspectRatio("invalid")).toBeNull();
      expect(parseAspectRatio("")).toBeNull();
    });

    it("should return null for non-numeric values", () => {
      expect(parseAspectRatio("a:b")).toBeNull();
      expect(parseAspectRatio("16:x")).toBeNull();
    });

    it("should return null for zero or negative values", () => {
      expect(parseAspectRatio("0:9")).toBeNull();
      expect(parseAspectRatio("16:0")).toBeNull();
      expect(parseAspectRatio("-1:9")).toBeNull();
    });
  });

  describe("calculateOutputDimensions", () => {
    it("should scale landscape images correctly", () => {
      const result = calculateOutputDimensions(1920, 1080, 1024);
      expect(result.width).toBe(1024);
      expect(result.height).toBe(576); // Maintains 16:9 ratio
    });

    it("should scale portrait images correctly", () => {
      const result = calculateOutputDimensions(1080, 1920, 1024);
      expect(result.height).toBe(1024);
      expect(result.width).toBe(576); // Maintains 9:16 ratio
    });

    it("should handle square images", () => {
      const result = calculateOutputDimensions(2000, 2000, 1024);
      expect(result.width).toBe(1024);
      expect(result.height).toBe(1024);
    });

    it("should not upscale images smaller than max dimension", () => {
      const result = calculateOutputDimensions(800, 600, 1024);
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it("should handle exact max dimension", () => {
      const result = calculateOutputDimensions(1024, 768, 1024);
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
    });
  });

  describe("isAllowedMimeType", () => {
    it("should allow valid image MIME types", () => {
      expect(isAllowedMimeType("image/jpeg")).toBe(true);
      expect(isAllowedMimeType("image/png")).toBe(true);
      expect(isAllowedMimeType("image/webp")).toBe(true);
    });

    it("should reject invalid MIME types", () => {
      expect(isAllowedMimeType("image/gif")).toBe(false);
      expect(isAllowedMimeType("image/bmp")).toBe(false);
      expect(isAllowedMimeType("application/pdf")).toBe(false);
      expect(isAllowedMimeType("text/plain")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isAllowedMimeType("")).toBe(false);
    });
  });
});
