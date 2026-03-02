import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCheckSessionHealth = vi.fn();
const mockCheckSessionsHealth = vi.fn();

vi.mock("@/lib/codespace/session-service", () => ({
  checkSessionHealth: (...args: unknown[]) => mockCheckSessionHealth(...args),
  checkSessionsHealth: (...args: unknown[]) => mockCheckSessionsHealth(...args),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/try-catch", () => ({
  tryCatch: async (promise: Promise<unknown>) => {
    try {
      const data = await promise;
      return { data, error: undefined };
    } catch (error) {
      return { data: undefined, error };
    }
  },
}));

import {
  filterHealthyCodespaces,
  healthCache,
  isCodespaceHealthy,
  revalidatePublishedApp,
} from "./codespace-health";

describe("codespace-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    healthCache.clear();
  });

  describe("isCodespaceHealthy", () => {
    it("should return true for a healthy codespace", async () => {
      mockCheckSessionHealth.mockResolvedValue(true);

      const result = await isCodespaceHealthy("healthy-cs");

      expect(result).toBe(true);
      expect(mockCheckSessionHealth).toHaveBeenCalledWith("healthy-cs");
    });

    it("should return false for an unhealthy codespace", async () => {
      mockCheckSessionHealth.mockResolvedValue(false);

      const result = await isCodespaceHealthy("unhealthy-cs");

      expect(result).toBe(false);
    });

    it("should return false when session check throws", async () => {
      mockCheckSessionHealth.mockRejectedValue(new Error("Not found"));

      const result = await isCodespaceHealthy("missing-cs");

      expect(result).toBe(false);
    });

    it("should use cached value within TTL", async () => {
      mockCheckSessionHealth.mockResolvedValue(true);

      // First call populates cache
      await isCodespaceHealthy("cached-cs");
      // Second call should use cache
      const result = await isCodespaceHealthy("cached-cs");

      expect(result).toBe(true);
      expect(mockCheckSessionHealth).toHaveBeenCalledTimes(1);
    });

    it("should bypass cache after TTL expires", async () => {
      mockCheckSessionHealth.mockResolvedValue(true);

      // Manually set an expired cache entry
      healthCache.set("expired-cs", {
        healthy: false,
        cachedAt: Date.now() - 120_000, // 2 minutes ago (> 60s TTL)
      });

      const result = await isCodespaceHealthy("expired-cs");

      expect(result).toBe(true);
      expect(mockCheckSessionHealth).toHaveBeenCalledWith("expired-cs");
    });

    it("should cache failed results", async () => {
      mockCheckSessionHealth.mockRejectedValue(new Error("fail"));

      await isCodespaceHealthy("fail-cs");

      expect(healthCache.get("fail-cs")).toEqual(expect.objectContaining({ healthy: false }));
    });
  });

  describe("revalidatePublishedApp", () => {
    it("should clear cache before checking health", async () => {
      mockCheckSessionHealth.mockResolvedValue(true);

      // Pre-populate cache with stale value
      healthCache.set("revalidate-cs", {
        healthy: false,
        cachedAt: Date.now(),
      });

      const result = await revalidatePublishedApp("revalidate-cs");

      expect(result).toBe(true);
      // Cache should have been cleared, so a fresh check was made
      expect(mockCheckSessionHealth).toHaveBeenCalledWith("revalidate-cs");
    });
  });

  describe("filterHealthyCodespaces", () => {
    it("should filter out unhealthy codespaces", async () => {
      mockCheckSessionsHealth.mockResolvedValue(
        new Map([
          ["cs-1", true],
          ["cs-2", false],
          ["cs-3", true],
        ]),
      );

      const items = [
        { codespaceId: "cs-1", name: "App 1" },
        { codespaceId: "cs-2", name: "App 2" },
        { codespaceId: "cs-3", name: "App 3" },
      ];

      const result = await filterHealthyCodespaces(items);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.codespaceId)).toEqual(["cs-1", "cs-3"]);
    });

    it("should filter out items with null codespaceId", async () => {
      const items = [
        { codespaceId: null as string | null, name: "No CS" },
        { codespaceId: "cs-1", name: "Has CS" },
      ];

      mockCheckSessionsHealth.mockResolvedValue(new Map([["cs-1", true]]));

      const result = await filterHealthyCodespaces(items);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Has CS");
    });

    it("should use cached values and skip batch check for cached items", async () => {
      // Pre-populate cache
      healthCache.set("cached-cs", { healthy: true, cachedAt: Date.now() });

      mockCheckSessionsHealth.mockResolvedValue(new Map([["uncached-cs", true]]));

      const items = [
        { codespaceId: "cached-cs", name: "Cached" },
        { codespaceId: "uncached-cs", name: "Uncached" },
      ];

      const result = await filterHealthyCodespaces(items);

      expect(result).toHaveLength(2);
      // Batch check should only be called for uncached items
      expect(mockCheckSessionsHealth).toHaveBeenCalledWith(["uncached-cs"]);
    });

    it("should mark items as unhealthy when batch check fails", async () => {
      mockCheckSessionsHealth.mockRejectedValue(new Error("DB error"));

      const items = [{ codespaceId: "cs-1", name: "App 1" }];

      const result = await filterHealthyCodespaces(items);

      // Should be empty since batch check failed and items default to unhealthy
      expect(result).toHaveLength(0);
    });

    it("should mark missing items from batch results as unhealthy", async () => {
      // Batch returns result for cs-1 but not cs-2
      mockCheckSessionsHealth.mockResolvedValue(new Map([["cs-1", true]]));

      const items = [
        { codespaceId: "cs-1", name: "Found" },
        { codespaceId: "cs-2", name: "Missing" },
      ];

      const result = await filterHealthyCodespaces(items);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Found");
    });

    it("should handle empty items array", async () => {
      const result = await filterHealthyCodespaces([]);

      expect(result).toHaveLength(0);
      expect(mockCheckSessionsHealth).not.toHaveBeenCalled();
    });
  });
});
