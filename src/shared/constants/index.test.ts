import { describe, expect, it } from "vitest";
import {
  API_CONFIG,
  ENHANCEMENT_COSTS,
  IMAGE_CONSTRAINTS,
  MCP_GENERATION_COSTS,
  REFERRAL_CONFIG,
  REVENUECAT_PRODUCTS,
  SUBSCRIPTION_TIERS,
  SUPPORTED_ASPECT_RATIOS,
  TOKEN_REGENERATION,
} from "./index";

describe("constants", () => {
  describe("ENHANCEMENT_COSTS", () => {
    it("should have correct token costs for each tier", () => {
      expect(ENHANCEMENT_COSTS.FREE).toBe(0);
      expect(ENHANCEMENT_COSTS.TIER_1K).toBe(2);
      expect(ENHANCEMENT_COSTS.TIER_2K).toBe(5);
      expect(ENHANCEMENT_COSTS.TIER_4K).toBe(10);
    });

    it("should have costs that increase with tier", () => {
      expect(ENHANCEMENT_COSTS.FREE).toBeLessThan(ENHANCEMENT_COSTS.TIER_1K);
      expect(ENHANCEMENT_COSTS.TIER_1K).toBeLessThan(ENHANCEMENT_COSTS.TIER_2K);
      expect(ENHANCEMENT_COSTS.TIER_2K).toBeLessThan(ENHANCEMENT_COSTS.TIER_4K);
    });
  });

  describe("MCP_GENERATION_COSTS", () => {
    it("should have correct token costs for each tier", () => {
      expect(MCP_GENERATION_COSTS.FREE).toBe(0);
      expect(MCP_GENERATION_COSTS.TIER_1K).toBe(2);
      expect(MCP_GENERATION_COSTS.TIER_2K).toBe(5);
      expect(MCP_GENERATION_COSTS.TIER_4K).toBe(10);
    });
  });

  describe("TOKEN_REGENERATION", () => {
    it("should have valid regeneration configuration", () => {
      expect(TOKEN_REGENERATION.TOKENS_PER_REGEN).toBe(1);
      expect(TOKEN_REGENERATION.REGEN_INTERVAL_MS).toBe(15 * 60 * 1000); // 15 minutes
      expect(TOKEN_REGENERATION.MAX_FREE_TOKENS).toBe(10);
    });

    it("should have regeneration interval in milliseconds", () => {
      expect(TOKEN_REGENERATION.REGEN_INTERVAL_MS).toBeGreaterThan(0);
    });
  });

  describe("IMAGE_CONSTRAINTS", () => {
    it("should have correct max file size (10MB)", () => {
      expect(IMAGE_CONSTRAINTS.MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });

    it("should have valid MIME types", () => {
      expect(IMAGE_CONSTRAINTS.ALLOWED_MIME_TYPES).toContain("image/jpeg");
      expect(IMAGE_CONSTRAINTS.ALLOWED_MIME_TYPES).toContain("image/png");
      expect(IMAGE_CONSTRAINTS.ALLOWED_MIME_TYPES).toContain("image/webp");
      expect(IMAGE_CONSTRAINTS.ALLOWED_MIME_TYPES).toHaveLength(3);
    });

    it("should have correct max batch size", () => {
      expect(IMAGE_CONSTRAINTS.MAX_BATCH_SIZE).toBe(20);
    });

    it("should have correct tier dimensions", () => {
      expect(IMAGE_CONSTRAINTS.TIER_DIMENSIONS.FREE).toBe(1024);
      expect(IMAGE_CONSTRAINTS.TIER_DIMENSIONS.TIER_1K).toBe(1024);
      expect(IMAGE_CONSTRAINTS.TIER_DIMENSIONS.TIER_2K).toBe(2048);
      expect(IMAGE_CONSTRAINTS.TIER_DIMENSIONS.TIER_4K).toBe(4096);
    });
  });

  describe("SUPPORTED_ASPECT_RATIOS", () => {
    it("should include common aspect ratios", () => {
      expect(SUPPORTED_ASPECT_RATIOS).toContain("1:1");
      expect(SUPPORTED_ASPECT_RATIOS).toContain("16:9");
      expect(SUPPORTED_ASPECT_RATIOS).toContain("9:16");
      expect(SUPPORTED_ASPECT_RATIOS).toContain("4:3");
      expect(SUPPORTED_ASPECT_RATIOS).toContain("3:4");
    });

    it("should have valid format (width:height)", () => {
      SUPPORTED_ASPECT_RATIOS.forEach((ratio) => {
        expect(ratio).toMatch(/^\d+:\d+$/);
      });
    });
  });

  describe("REFERRAL_CONFIG", () => {
    it("should have positive token rewards", () => {
      expect(REFERRAL_CONFIG.TOKENS_PER_REFERRAL).toBeGreaterThan(0);
      expect(REFERRAL_CONFIG.SIGNUP_BONUS_TOKENS).toBeGreaterThan(0);
    });

    it("should have referrer reward greater than signup bonus", () => {
      expect(REFERRAL_CONFIG.TOKENS_PER_REFERRAL).toBeGreaterThan(
        REFERRAL_CONFIG.SIGNUP_BONUS_TOKENS,
      );
    });
  });

  describe("API_CONFIG", () => {
    it("should have valid production URL", () => {
      expect(API_CONFIG.PRODUCTION_URL).toBe("https://spike.land");
      expect(API_CONFIG.PRODUCTION_URL).toMatch(/^https:\/\//);
    });

    it("should have reasonable timeout values", () => {
      expect(API_CONFIG.DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
      expect(API_CONFIG.JOB_POLL_INTERVAL_MS).toBeGreaterThan(0);
      expect(API_CONFIG.JOB_POLL_INTERVAL_MS).toBeLessThan(API_CONFIG.DEFAULT_TIMEOUT_MS);
    });
  });

  describe("SUBSCRIPTION_TIERS", () => {
    it("should have correct tier structure", () => {
      expect(SUBSCRIPTION_TIERS.FREE.name).toBe("Free");
      expect(SUBSCRIPTION_TIERS.BASIC.name).toBe("Basic");
      expect(SUBSCRIPTION_TIERS.STANDARD.name).toBe("Standard");
      expect(SUBSCRIPTION_TIERS.PREMIUM.name).toBe("Premium");
    });

    it("should have increasing tokens per month", () => {
      expect(SUBSCRIPTION_TIERS.FREE.tokensPerMonth).toBe(0);
      expect(SUBSCRIPTION_TIERS.BASIC.tokensPerMonth).toBeLessThan(
        SUBSCRIPTION_TIERS.STANDARD.tokensPerMonth,
      );
      expect(SUBSCRIPTION_TIERS.STANDARD.tokensPerMonth).toBeLessThan(
        SUBSCRIPTION_TIERS.PREMIUM.tokensPerMonth,
      );
    });

    it("should have premium tier with API access", () => {
      expect(SUBSCRIPTION_TIERS.FREE.apiAccess).toBe(false);
      expect(SUBSCRIPTION_TIERS.BASIC.apiAccess).toBe(false);
      expect(SUBSCRIPTION_TIERS.PREMIUM.apiAccess).toBe(true);
    });

    it("should have priority for higher tiers", () => {
      expect(SUBSCRIPTION_TIERS.FREE.priority).toBe(false);
      expect(SUBSCRIPTION_TIERS.BASIC.priority).toBe(false);
      expect(SUBSCRIPTION_TIERS.STANDARD.priority).toBe(true);
      expect(SUBSCRIPTION_TIERS.PREMIUM.priority).toBe(true);
    });
  });

  describe("REVENUECAT_PRODUCTS", () => {
    it("should have token package IDs", () => {
      expect(REVENUECAT_PRODUCTS.TOKEN_PACKAGES.STARTER).toBeDefined();
      expect(REVENUECAT_PRODUCTS.TOKEN_PACKAGES.PRO).toBeDefined();
      expect(REVENUECAT_PRODUCTS.TOKEN_PACKAGES.POWER).toBeDefined();
    });

    it("should have subscription IDs", () => {
      expect(REVENUECAT_PRODUCTS.SUBSCRIPTIONS.BASIC_MONTHLY).toBeDefined();
      expect(REVENUECAT_PRODUCTS.SUBSCRIPTIONS.STANDARD_MONTHLY).toBeDefined();
      expect(REVENUECAT_PRODUCTS.SUBSCRIPTIONS.PREMIUM_MONTHLY).toBeDefined();
    });
  });
});
