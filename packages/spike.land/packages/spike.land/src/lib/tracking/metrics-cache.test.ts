import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    campaignMetricsCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

vi.mock("@/lib/try-catch", () => ({
  tryCatch: vi.fn((promise: Promise<unknown>) =>
    promise.then(
      (data: unknown) => ({ data, error: null }),
      (error: unknown) => ({ data: null, error }),
    )
  ),
}));

import {
  buildCacheKey,
  cleanupExpiredCache,
  getCachedMetrics,
  getOrComputeMetrics,
  invalidateCache,
  setCachedMetrics,
} from "./metrics-cache";

describe("tracking/metrics-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildCacheKey", () => {
    it("should build key from prefix and sorted params", () => {
      const key = buildCacheKey("overview", {
        workspace: "ws-1",
        account: "acc-1",
      });
      expect(key).toBe("overview:account:acc-1:workspace:ws-1");
    });

    it("should skip undefined values", () => {
      const key = buildCacheKey("metrics", {
        id: "123",
        filter: undefined,
      });
      expect(key).toBe("metrics:id:123");
    });

    it("should handle empty params", () => {
      expect(buildCacheKey("prefix", {})).toBe("prefix");
    });

    it("should handle numeric values", () => {
      const key = buildCacheKey("stats", { page: 1, limit: 10 });
      expect(key).toBe("stats:limit:10:page:1");
    });
  });

  describe("getCachedMetrics", () => {
    it("should return cached data when valid", async () => {
      mockPrisma.campaignMetricsCache.findUnique.mockResolvedValue({
        metrics: { views: 100 },
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await getCachedMetrics<{ views: number; }>("key-1");
      expect(result).toEqual({ views: 100 });
    });

    it("should return null when cache entry not found", async () => {
      mockPrisma.campaignMetricsCache.findUnique.mockResolvedValue(null);

      const result = await getCachedMetrics("missing");
      expect(result).toBeNull();
    });

    it("should return null when cache has expired", async () => {
      mockPrisma.campaignMetricsCache.findUnique.mockResolvedValue({
        metrics: { views: 100 },
        expiresAt: new Date(Date.now() - 1000), // expired
      });
      mockPrisma.campaignMetricsCache.deleteMany.mockResolvedValue({
        count: 1,
      });

      const result = await getCachedMetrics("expired-key");
      expect(result).toBeNull();
    });

    it("should return null on database error", async () => {
      mockPrisma.campaignMetricsCache.findUnique.mockRejectedValue(
        new Error("DB error"),
      );

      const result = await getCachedMetrics("error-key");
      expect(result).toBeNull();
    });
  });

  describe("setCachedMetrics", () => {
    it("should upsert cache entry with TTL", async () => {
      mockPrisma.campaignMetricsCache.upsert.mockResolvedValue({});

      await setCachedMetrics("key-1", { score: 42 }, 600);

      expect(mockPrisma.campaignMetricsCache.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cacheKey: "key-1" },
          create: expect.objectContaining({
            cacheKey: "key-1",
            metrics: { score: 42 },
          }),
          update: expect.objectContaining({
            metrics: { score: 42 },
          }),
        }),
      );
    });

    it("should not throw on database error", async () => {
      mockPrisma.campaignMetricsCache.upsert.mockRejectedValue(
        new Error("Write failed"),
      );

      await expect(
        setCachedMetrics("key-1", { data: 1 }),
      ).resolves.toBeUndefined();
    });
  });

  describe("invalidateCache", () => {
    it("should delete entries matching pattern", async () => {
      mockPrisma.campaignMetricsCache.deleteMany.mockResolvedValue({
        count: 3,
      });

      const count = await invalidateCache("workspace:ws-1");

      expect(mockPrisma.campaignMetricsCache.deleteMany).toHaveBeenCalledWith({
        where: { cacheKey: { contains: "workspace:ws-1" } },
      });
      expect(count).toBe(3);
    });

    it("should delete all entries when no pattern provided", async () => {
      mockPrisma.campaignMetricsCache.deleteMany.mockResolvedValue({
        count: 10,
      });

      const count = await invalidateCache();

      expect(mockPrisma.campaignMetricsCache.deleteMany).toHaveBeenCalledWith(
        {},
      );
      expect(count).toBe(10);
    });

    it("should return 0 on error", async () => {
      mockPrisma.campaignMetricsCache.deleteMany.mockRejectedValue(
        new Error("fail"),
      );

      const count = await invalidateCache("pattern");
      expect(count).toBe(0);
    });
  });

  describe("cleanupExpiredCache", () => {
    it("should delete expired entries", async () => {
      mockPrisma.campaignMetricsCache.deleteMany.mockResolvedValue({
        count: 5,
      });

      const count = await cleanupExpiredCache();

      expect(
        mockPrisma.campaignMetricsCache.deleteMany,
      ).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
      expect(count).toBe(5);
    });

    it("should return 0 on error", async () => {
      mockPrisma.campaignMetricsCache.deleteMany.mockRejectedValue(
        new Error("fail"),
      );

      const count = await cleanupExpiredCache();
      expect(count).toBe(0);
    });
  });

  describe("getOrComputeMetrics", () => {
    it("should return cached value when available", async () => {
      mockPrisma.campaignMetricsCache.findUnique.mockResolvedValue({
        metrics: { cached: true },
        expiresAt: new Date(Date.now() + 60000),
      });

      const computeFn = vi.fn();
      const result = await getOrComputeMetrics("key", computeFn);

      expect(result).toEqual({ cached: true });
      expect(computeFn).not.toHaveBeenCalled();
    });

    it("should compute and cache when no cached value", async () => {
      mockPrisma.campaignMetricsCache.findUnique.mockResolvedValue(null);
      mockPrisma.campaignMetricsCache.upsert.mockResolvedValue({});

      const computeFn = vi.fn().mockResolvedValue({ fresh: true });
      const result = await getOrComputeMetrics("key", computeFn, 300);

      expect(result).toEqual({ fresh: true });
      expect(computeFn).toHaveBeenCalledTimes(1);
    });
  });
});
