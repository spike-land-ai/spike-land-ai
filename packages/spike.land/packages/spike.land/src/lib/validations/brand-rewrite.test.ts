import { describe, expect, it } from "vitest";
import {
  CONTENT_PLATFORMS,
  contentRewriteRequestSchema,
  DIFF_HUNK_TYPES,
  diffHunkSchema,
  exceedsPlatformLimit,
  getPlatformDisplayName,
  getPlatformLimit,
  PLATFORM_LIMITS,
  REWRITE_STATUSES,
} from "./brand-rewrite";

describe("brand-rewrite validations", () => {
  describe("constants", () => {
    it("should have expected platforms", () => {
      expect(CONTENT_PLATFORMS).toContain("TWITTER");
      expect(CONTENT_PLATFORMS).toContain("LINKEDIN");
      expect(CONTENT_PLATFORMS).toContain("INSTAGRAM");
      expect(CONTENT_PLATFORMS).toContain("FACEBOOK");
      expect(CONTENT_PLATFORMS).toContain("GENERAL");
    });

    it("should have character limits for all platforms", () => {
      for (const platform of CONTENT_PLATFORMS) {
        expect(PLATFORM_LIMITS[platform]).toBeGreaterThan(0);
      }
    });

    it("should have expected rewrite statuses", () => {
      expect(REWRITE_STATUSES).toContain("PENDING");
      expect(REWRITE_STATUSES).toContain("PROCESSING");
      expect(REWRITE_STATUSES).toContain("COMPLETED");
      expect(REWRITE_STATUSES).toContain("FAILED");
    });

    it("should have expected diff hunk types", () => {
      expect(DIFF_HUNK_TYPES).toContain("added");
      expect(DIFF_HUNK_TYPES).toContain("removed");
      expect(DIFF_HUNK_TYPES).toContain("unchanged");
    });

    it("Twitter limit should be 280", () => {
      expect(PLATFORM_LIMITS.TWITTER).toBe(280);
    });
  });

  describe("contentRewriteRequestSchema", () => {
    it("should accept valid request", () => {
      const result = contentRewriteRequestSchema.safeParse({
        content: "Hello world",
        platform: "TWITTER",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty content", () => {
      const result = contentRewriteRequestSchema.safeParse({
        content: "",
      });
      expect(result.success).toBe(false);
    });

    it("should default platform to GENERAL", () => {
      const result = contentRewriteRequestSchema.safeParse({
        content: "Hello",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.platform).toBe("GENERAL");
      }
    });

    it("should reject content exceeding 50000 chars", () => {
      const result = contentRewriteRequestSchema.safeParse({
        content: "a".repeat(50001),
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid platform", () => {
      const result = contentRewriteRequestSchema.safeParse({
        content: "Hello",
        platform: "TIKTOK",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("diffHunkSchema", () => {
    it("should accept valid diff hunk", () => {
      const result = diffHunkSchema.safeParse({
        id: "h1",
        type: "added",
        value: "new text",
        lineNumber: 5,
        selected: true,
      });
      expect(result.success).toBe(true);
    });

    it("should default selected to true", () => {
      const result = diffHunkSchema.safeParse({
        id: "h1",
        type: "unchanged",
        value: "text",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selected).toBe(true);
      }
    });

    it("should reject invalid hunk type", () => {
      const result = diffHunkSchema.safeParse({
        id: "h1",
        type: "modified",
        value: "text",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getPlatformLimit", () => {
    it("should return correct limit for each platform", () => {
      expect(getPlatformLimit("TWITTER")).toBe(280);
      expect(getPlatformLimit("LINKEDIN")).toBe(3000);
      expect(getPlatformLimit("INSTAGRAM")).toBe(2200);
      expect(getPlatformLimit("FACEBOOK")).toBe(63206);
      expect(getPlatformLimit("GENERAL")).toBe(50000);
    });
  });

  describe("exceedsPlatformLimit", () => {
    it("should return false when within limit", () => {
      expect(exceedsPlatformLimit("short text", "TWITTER")).toBe(false);
    });

    it("should return true when exceeding limit", () => {
      const longTweet = "a".repeat(281);
      expect(exceedsPlatformLimit(longTweet, "TWITTER")).toBe(true);
    });

    it("should return false at exact limit", () => {
      const exactTweet = "a".repeat(280);
      expect(exceedsPlatformLimit(exactTweet, "TWITTER")).toBe(false);
    });
  });

  describe("getPlatformDisplayName", () => {
    it("should return display name for each platform", () => {
      expect(getPlatformDisplayName("TWITTER")).toBe("Twitter / X");
      expect(getPlatformDisplayName("LINKEDIN")).toBe("LinkedIn");
      expect(getPlatformDisplayName("INSTAGRAM")).toBe("Instagram");
      expect(getPlatformDisplayName("FACEBOOK")).toBe("Facebook");
      expect(getPlatformDisplayName("GENERAL")).toBe("General");
    });
  });
});
