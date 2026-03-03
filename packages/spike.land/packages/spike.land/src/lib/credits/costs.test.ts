/**
 * Tests for AI credit cost definitions
 *
 * Verifies the single source of truth for credit costs
 * across enhancement tiers and MCP generation.
 */
import { describe, expect, it } from "vitest";

import {
  ENHANCEMENT_COSTS,
  type EnhancementTier,
  getEnhancementCost,
  getMcpGenerationCost,
  MCP_GENERATION_COSTS,
} from "./costs";

describe("ENHANCEMENT_COSTS", () => {
  it("should have zero cost for FREE tier", () => {
    expect(ENHANCEMENT_COSTS.FREE).toBe(0);
  });

  it("should have increasing costs for higher resolution tiers", () => {
    expect(ENHANCEMENT_COSTS.TIER_1K).toBeLessThan(ENHANCEMENT_COSTS.TIER_2K);
    expect(ENHANCEMENT_COSTS.TIER_2K).toBeLessThan(ENHANCEMENT_COSTS.TIER_4K);
  });

  it("should have expected cost values", () => {
    expect(ENHANCEMENT_COSTS.TIER_1K).toBe(2);
    expect(ENHANCEMENT_COSTS.TIER_2K).toBe(5);
    expect(ENHANCEMENT_COSTS.TIER_4K).toBe(10);
  });

  it("should have all four tier keys defined", () => {
    const keys = Object.keys(ENHANCEMENT_COSTS);
    expect(keys).toContain("FREE");
    expect(keys).toContain("TIER_1K");
    expect(keys).toContain("TIER_2K");
    expect(keys).toContain("TIER_4K");
  });

  it("should have non-negative costs for all tiers", () => {
    for (const cost of Object.values(ENHANCEMENT_COSTS)) {
      expect(cost).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("MCP_GENERATION_COSTS", () => {
  it("should have zero cost for FREE tier", () => {
    expect(MCP_GENERATION_COSTS.FREE).toBe(0);
  });

  it("should mirror ENHANCEMENT_COSTS pricing structure", () => {
    expect(MCP_GENERATION_COSTS.FREE).toBe(ENHANCEMENT_COSTS.FREE);
    expect(MCP_GENERATION_COSTS.TIER_1K).toBe(ENHANCEMENT_COSTS.TIER_1K);
    expect(MCP_GENERATION_COSTS.TIER_2K).toBe(ENHANCEMENT_COSTS.TIER_2K);
    expect(MCP_GENERATION_COSTS.TIER_4K).toBe(ENHANCEMENT_COSTS.TIER_4K);
  });

  it("should have all four tier keys defined", () => {
    const keys = Object.keys(MCP_GENERATION_COSTS);
    expect(keys).toContain("FREE");
    expect(keys).toContain("TIER_1K");
    expect(keys).toContain("TIER_2K");
    expect(keys).toContain("TIER_4K");
  });
});

describe("getEnhancementCost", () => {
  it("should return 0 for FREE tier", () => {
    expect(getEnhancementCost("FREE")).toBe(0);
  });

  it("should return 2 for TIER_1K", () => {
    expect(getEnhancementCost("TIER_1K")).toBe(2);
  });

  it("should return 5 for TIER_2K", () => {
    expect(getEnhancementCost("TIER_2K")).toBe(5);
  });

  it("should return 10 for TIER_4K", () => {
    expect(getEnhancementCost("TIER_4K")).toBe(10);
  });

  it("should match ENHANCEMENT_COSTS lookup for all tiers", () => {
    const tiers: EnhancementTier[] = ["FREE", "TIER_1K", "TIER_2K", "TIER_4K"];
    for (const tier of tiers) {
      expect(getEnhancementCost(tier)).toBe(ENHANCEMENT_COSTS[tier]);
    }
  });
});

describe("getMcpGenerationCost", () => {
  it("should return 0 for FREE tier", () => {
    expect(getMcpGenerationCost("FREE")).toBe(0);
  });

  it("should return 2 for TIER_1K", () => {
    expect(getMcpGenerationCost("TIER_1K")).toBe(2);
  });

  it("should return 5 for TIER_2K", () => {
    expect(getMcpGenerationCost("TIER_2K")).toBe(5);
  });

  it("should return 10 for TIER_4K", () => {
    expect(getMcpGenerationCost("TIER_4K")).toBe(10);
  });

  it("should return the same cost as getEnhancementCost for all tiers", () => {
    const tiers: EnhancementTier[] = ["FREE", "TIER_1K", "TIER_2K", "TIER_4K"];
    for (const tier of tiers) {
      expect(getMcpGenerationCost(tier)).toBe(getEnhancementCost(tier));
    }
  });
});
