/**
 * Tests for Workspace Subscription Tier Configuration
 */
import { describe, expect, it } from "vitest";

import {
  getNextTier,
  getTierIndex,
  getTierLimits,
  isDowngrade,
  isUnlimited,
  isUpgrade,
  WORKSPACE_TIER_DISPLAY_NAMES,
  WORKSPACE_TIER_LIMITS,
  WORKSPACE_TIER_ORDER,
} from "./tier-config";

describe("isUnlimited", () => {
  it("returns true for -1", () => {
    expect(isUnlimited(-1)).toBe(true);
  });
  it("returns false for 0", () => {
    expect(isUnlimited(0)).toBe(false);
  });
  it("returns false for positive numbers", () => {
    expect(isUnlimited(100)).toBe(false);
  });
});

describe("WORKSPACE_TIER_ORDER", () => {
  it("contains all three tiers", () => {
    expect(WORKSPACE_TIER_ORDER).toContain("FREE");
    expect(WORKSPACE_TIER_ORDER).toContain("PRO");
    expect(WORKSPACE_TIER_ORDER).toContain("BUSINESS");
  });
  it("has FREE first", () => {
    expect(WORKSPACE_TIER_ORDER[0]).toBe("FREE");
  });
  it("has BUSINESS last", () => {
    expect(WORKSPACE_TIER_ORDER[WORKSPACE_TIER_ORDER.length - 1]).toBe("BUSINESS");
  });
  it("has PRO in the middle", () => {
    expect(WORKSPACE_TIER_ORDER[1]).toBe("PRO");
  });
});

describe("WORKSPACE_TIER_LIMITS", () => {
  it("has entries for all three tiers", () => {
    expect(WORKSPACE_TIER_LIMITS.FREE).toBeDefined();
    expect(WORKSPACE_TIER_LIMITS.PRO).toBeDefined();
    expect(WORKSPACE_TIER_LIMITS.BUSINESS).toBeDefined();
  });
  it("FREE tier has no cost", () => {
    expect(WORKSPACE_TIER_LIMITS.FREE.priceUSD).toBe(0);
  });
  it("PRO tier has higher AI credits than FREE", () => {
    expect(WORKSPACE_TIER_LIMITS.PRO.monthlyAiCredits).toBeGreaterThan(
      WORKSPACE_TIER_LIMITS.FREE.monthlyAiCredits,
    );
  });
  it("BUSINESS tier has higher AI credits than PRO", () => {
    expect(WORKSPACE_TIER_LIMITS.BUSINESS.monthlyAiCredits).toBeGreaterThan(
      WORKSPACE_TIER_LIMITS.PRO.monthlyAiCredits,
    );
  });
  it("BUSINESS tier has unlimited social accounts (-1)", () => {
    expect(WORKSPACE_TIER_LIMITS.BUSINESS.maxSocialAccounts).toBe(-1);
  });
  it("PRO tier has unlimited scheduled posts (-1)", () => {
    expect(WORKSPACE_TIER_LIMITS.PRO.maxScheduledPosts).toBe(-1);
  });
  it("FREE tier has limited team members (1)", () => {
    expect(WORKSPACE_TIER_LIMITS.FREE.maxTeamMembers).toBe(1);
  });
  it("PRO tier allows more team members than FREE", () => {
    expect(WORKSPACE_TIER_LIMITS.PRO.maxTeamMembers).toBeGreaterThan(
      WORKSPACE_TIER_LIMITS.FREE.maxTeamMembers,
    );
  });
  it("all tiers have non-negative priceUSD", () => {
    for (const limits of Object.values(WORKSPACE_TIER_LIMITS)) {
      expect(limits.priceUSD).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("WORKSPACE_TIER_DISPLAY_NAMES", () => {
  it("has display names for all tiers", () => {
    expect(WORKSPACE_TIER_DISPLAY_NAMES.FREE).toBeDefined();
    expect(WORKSPACE_TIER_DISPLAY_NAMES.PRO).toBeDefined();
    expect(WORKSPACE_TIER_DISPLAY_NAMES.BUSINESS).toBeDefined();
  });
  it("all display names are non-empty strings", () => {
    for (const name of Object.values(WORKSPACE_TIER_DISPLAY_NAMES)) {
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

describe("getTierIndex", () => {
  it("returns 0 for FREE", () => {
    expect(getTierIndex("FREE")).toBe(0);
  });
  it("returns 1 for PRO", () => {
    expect(getTierIndex("PRO")).toBe(1);
  });
  it("returns 2 for BUSINESS", () => {
    expect(getTierIndex("BUSINESS")).toBe(2);
  });
});

describe("getTierLimits", () => {
  it("returns the limits object for FREE tier", () => {
    expect(getTierLimits("FREE")).toStrictEqual(WORKSPACE_TIER_LIMITS.FREE);
  });
  it("returns the limits object for PRO tier", () => {
    expect(getTierLimits("PRO")).toStrictEqual(WORKSPACE_TIER_LIMITS.PRO);
  });
  it("returns the limits object for BUSINESS tier", () => {
    expect(getTierLimits("BUSINESS")).toStrictEqual(WORKSPACE_TIER_LIMITS.BUSINESS);
  });
});

describe("isUpgrade", () => {
  it("returns true when moving from FREE to PRO", () => {
    expect(isUpgrade("FREE", "PRO")).toBe(true);
  });
  it("returns true when moving from FREE to BUSINESS", () => {
    expect(isUpgrade("FREE", "BUSINESS")).toBe(true);
  });
  it("returns true when moving from PRO to BUSINESS", () => {
    expect(isUpgrade("PRO", "BUSINESS")).toBe(true);
  });
  it("returns false when staying on same tier", () => {
    expect(isUpgrade("FREE", "FREE")).toBe(false);
    expect(isUpgrade("PRO", "PRO")).toBe(false);
  });
  it("returns false when moving to lower tier", () => {
    expect(isUpgrade("PRO", "FREE")).toBe(false);
    expect(isUpgrade("BUSINESS", "PRO")).toBe(false);
  });
});

describe("isDowngrade", () => {
  it("returns true when moving from PRO to FREE", () => {
    expect(isDowngrade("PRO", "FREE")).toBe(true);
  });
  it("returns true when moving from BUSINESS to PRO", () => {
    expect(isDowngrade("BUSINESS", "PRO")).toBe(true);
  });
  it("returns true when moving from BUSINESS to FREE", () => {
    expect(isDowngrade("BUSINESS", "FREE")).toBe(true);
  });
  it("returns false when staying on same tier", () => {
    expect(isDowngrade("FREE", "FREE")).toBe(false);
  });
  it("returns false when moving to higher tier", () => {
    expect(isDowngrade("FREE", "PRO")).toBe(false);
  });
});

describe("getNextTier", () => {
  it("returns PRO when current is FREE", () => {
    expect(getNextTier("FREE")).toBe("PRO");
  });
  it("returns BUSINESS when current is PRO", () => {
    expect(getNextTier("PRO")).toBe("BUSINESS");
  });
  it("returns null when current is BUSINESS", () => {
    expect(getNextTier("BUSINESS")).toBeNull();
  });
});
