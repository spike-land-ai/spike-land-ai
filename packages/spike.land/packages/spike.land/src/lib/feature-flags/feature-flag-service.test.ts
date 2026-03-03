import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFeatureFlag } = vi.hoisted(() => ({
  mockFeatureFlag: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    featureFlag: mockFeatureFlag,
  },
}));

import { FeatureFlagService } from "./feature-flag-service";

function makeFlag(overrides: {
  name?: string;
  isEnabled?: boolean;
  enabledFor?: string[];
  percentage?: number;
} = {}) {
  return {
    name: "test-feature",
    isEnabled: true,
    enabledFor: [],
    percentage: 0,
    ...overrides,
  };
}

describe("FeatureFlagService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isFeatureEnabled", () => {
    it("returns false when flag is not found", async () => {
      mockFeatureFlag.findUnique.mockResolvedValue(null);
      expect(await FeatureFlagService.isFeatureEnabled("missing-flag")).toBe(false);
    });

    it("returns false when flag.isEnabled is false", async () => {
      mockFeatureFlag.findUnique.mockResolvedValue(makeFlag({ isEnabled: false }));
      expect(await FeatureFlagService.isFeatureEnabled("test-feature")).toBe(false);
    });

    it("returns true when entityId is in enabledFor list", async () => {
      mockFeatureFlag.findUnique.mockResolvedValue(
        makeFlag({ enabledFor: ["user_123", "user_456"] }),
      );
      expect(await FeatureFlagService.isFeatureEnabled("test-feature", "user_123")).toBe(true);
    });

    it("returns false when entityId is NOT in enabledFor list and percentage is 0", async () => {
      mockFeatureFlag.findUnique.mockResolvedValue(
        makeFlag({ enabledFor: ["user_999"], percentage: 0 }),
      );
      expect(await FeatureFlagService.isFeatureEnabled("test-feature", "user_abc")).toBe(false);
    });

    it("returns true for 100% percentage rollout", async () => {
      mockFeatureFlag.findUnique.mockResolvedValue(
        makeFlag({ percentage: 100 }),
      );
      expect(await FeatureFlagService.isFeatureEnabled("test-feature")).toBe(true);
    });

    it("returns false for 0% percentage rollout with no entityId", async () => {
      mockFeatureFlag.findUnique.mockResolvedValue(
        makeFlag({ percentage: 0 }),
      );
      expect(await FeatureFlagService.isFeatureEnabled("test-feature")).toBe(false);
    });

    it("uses hash-based percentage check for entityId", async () => {
      mockFeatureFlag.findUnique.mockResolvedValue(
        makeFlag({ percentage: 50 }),
      );
      // With an entityId, result depends on hash — just verify it returns a boolean
      const result = await FeatureFlagService.isFeatureEnabled("test-feature", "user_hash_test");
      expect(typeof result).toBe("boolean");
    });

    it("returns false for 0% percentage with entityId not in enabledFor", async () => {
      mockFeatureFlag.findUnique.mockResolvedValue(
        makeFlag({ percentage: 0, enabledFor: [] }),
      );
      expect(await FeatureFlagService.isFeatureEnabled("test-feature", "user_abc")).toBe(false);
    });

    it("enabledFor check takes precedence over percentage", async () => {
      // Even with percentage=0, if entityId is in enabledFor, return true
      mockFeatureFlag.findUnique.mockResolvedValue(
        makeFlag({ percentage: 0, enabledFor: ["user_special"] }),
      );
      expect(await FeatureFlagService.isFeatureEnabled("test-feature", "user_special")).toBe(true);
    });

    it("uses featureName in the lookup query", async () => {
      mockFeatureFlag.findUnique.mockResolvedValue(null);
      await FeatureFlagService.isFeatureEnabled("my-specific-flag", "user_abc");
      expect(mockFeatureFlag.findUnique).toHaveBeenCalledWith({
        where: { name: "my-specific-flag" },
      });
    });
  });
});
