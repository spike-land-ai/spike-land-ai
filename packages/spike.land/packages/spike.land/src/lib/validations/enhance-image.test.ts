import { describe, expect, it } from "vitest";

import {
  enhanceImageRequestSchema,
  isValidTier,
  VALID_TIERS,
  validateBase64Size,
  validateEnhanceRequest,
} from "./enhance-image";

describe("enhance-image validations", () => {
  describe("VALID_TIERS", () => {
    it("should have 4 tiers", () => {
      expect(VALID_TIERS).toEqual(["FREE", "TIER_1K", "TIER_2K", "TIER_4K"]);
    });
  });

  describe("enhanceImageRequestSchema", () => {
    it("should accept valid request", () => {
      const result = enhanceImageRequestSchema.safeParse({
        imageId: "img-123",
        tier: "FREE",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing imageId", () => {
      const result = enhanceImageRequestSchema.safeParse({ tier: "FREE" });
      expect(result.success).toBe(false);
    });

    it("should reject empty imageId", () => {
      const result = enhanceImageRequestSchema.safeParse({
        imageId: "",
        tier: "FREE",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid tier", () => {
      const result = enhanceImageRequestSchema.safeParse({
        imageId: "img-123",
        tier: "PREMIUM",
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid blendSource with imageId", () => {
      const result = enhanceImageRequestSchema.safeParse({
        imageId: "img-123",
        tier: "TIER_1K",
        blendSource: { imageId: "blend-456" },
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid blendSource with base64", () => {
      const result = enhanceImageRequestSchema.safeParse({
        imageId: "img-123",
        tier: "TIER_2K",
        blendSource: { base64: "abc123==", mimeType: "image/png" },
      });
      expect(result.success).toBe(true);
    });

    it("should reject blendSource with both imageId and base64", () => {
      const result = enhanceImageRequestSchema.safeParse({
        imageId: "img-123",
        tier: "TIER_1K",
        blendSource: {
          imageId: "blend-456",
          base64: "abc123==",
          mimeType: "image/png",
        },
      });
      expect(result.success).toBe(false);
    });

    it("should reject blendSource with neither imageId nor base64", () => {
      const result = enhanceImageRequestSchema.safeParse({
        imageId: "img-123",
        tier: "TIER_1K",
        blendSource: {},
      });
      expect(result.success).toBe(false);
    });

    it("should reject blendSource with base64 but no mimeType", () => {
      const result = enhanceImageRequestSchema.safeParse({
        imageId: "img-123",
        tier: "TIER_1K",
        blendSource: { base64: "abc123==" },
      });
      expect(result.success).toBe(false);
    });

    it("should reject blendSource with non-image mimeType", () => {
      const result = enhanceImageRequestSchema.safeParse({
        imageId: "img-123",
        tier: "TIER_1K",
        blendSource: { base64: "abc123==", mimeType: "text/plain" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("validateEnhanceRequest", () => {
    it("should return success for valid input", () => {
      const result = validateEnhanceRequest({
        imageId: "img-123",
        tier: "FREE",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageId).toBe("img-123");
        expect(result.data.tier).toBe("FREE");
      }
    });

    it("should return error for missing imageId", () => {
      const result = validateEnhanceRequest({ tier: "FREE" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("imageId");
        expect(result.suggestion).toContain("image ID");
      }
    });

    it("should return error for invalid tier", () => {
      const result = validateEnhanceRequest({
        imageId: "img-123",
        tier: "ULTRA",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("tier");
        expect(result.suggestion).toContain("tier");
      }
    });

    it("should return error for invalid blendSource", () => {
      const result = validateEnhanceRequest({
        imageId: "img-123",
        tier: "TIER_1K",
        blendSource: {},
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.suggestion).toContain("blend source");
      }
    });

    it("should return generic error for completely invalid input", () => {
      const result = validateEnhanceRequest("not an object");
      expect(result.success).toBe(false);
    });
  });

  describe("validateBase64Size", () => {
    it("should accept small base64 strings", () => {
      const result = validateBase64Size("abc123==");
      expect(result.valid).toBe(true);
      expect(result.estimatedSize).toBeGreaterThan(0);
      expect(result.maxSize).toBe(20 * 1024 * 1024);
    });

    it("should reject base64 exceeding 20MB estimated size", () => {
      // 20MB decoded ~= 26.67MB base64
      const largeBase64 = "A".repeat(28 * 1024 * 1024);
      const result = validateBase64Size(largeBase64);
      expect(result.valid).toBe(false);
      expect(result.estimatedSize).toBeGreaterThan(result.maxSize);
    });
  });

  describe("isValidTier", () => {
    it("should return true for valid tiers", () => {
      expect(isValidTier("FREE")).toBe(true);
      expect(isValidTier("TIER_1K")).toBe(true);
      expect(isValidTier("TIER_2K")).toBe(true);
      expect(isValidTier("TIER_4K")).toBe(true);
    });

    it("should return false for invalid tiers", () => {
      expect(isValidTier("PREMIUM")).toBe(false);
      expect(isValidTier("free")).toBe(false);
      expect(isValidTier("")).toBe(false);
    });
  });
});
