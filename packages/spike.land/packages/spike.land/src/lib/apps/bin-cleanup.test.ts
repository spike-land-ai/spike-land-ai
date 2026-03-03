import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma with vi.hoisted for forks pool compatibility
const mockPrisma = vi.hoisted(() => ({
  app: {
    findMany: vi.fn(),
    delete: vi.fn(),
    groupBy: vi.fn(),
  },
}));

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({ default: mockLogger }));
vi.mock("@/lib/try-catch", () => ({
  tryCatch: (p: Promise<unknown>) =>
    p
      .then(data => ({ data, error: null }))
      .catch(error => ({ data: null, error })),
}));

import { cleanupExpiredBinApps, getBinStats } from "./bin-cleanup";

describe("bin-cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-18T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("cleanupExpiredBinApps", () => {
    const expiredApp = {
      id: "app-1",
      name: "My Old App",
      userId: "user-1",
      deletedAt: new Date("2026-01-01T00:00:00Z"),
    };

    const anotherExpiredApp = {
      id: "app-2",
      name: "Another Old App",
      userId: "user-2",
      deletedAt: new Date("2025-12-15T00:00:00Z"),
    };

    it("should return empty result when no expired apps found", async () => {
      mockPrisma.app.findMany.mockResolvedValue([]);

      const result = await cleanupExpiredBinApps();

      expect(result).toEqual({
        totalFound: 0,
        deleted: 0,
        failed: 0,
        dryRun: false,
        apps: [],
        errors: [],
      });
    });

    it("should report what would be deleted in dry run mode", async () => {
      mockPrisma.app.findMany.mockResolvedValue([expiredApp]);

      const result = await cleanupExpiredBinApps({ dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.totalFound).toBe(1);
      expect(result.deleted).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.apps).toHaveLength(1);
      expect(result.apps[0]).toEqual({
        id: "app-1",
        name: "My Old App",
        userId: "user-1",
        deletedAt: expiredApp.deletedAt,
      });
      // Should NOT actually delete in dry run
      expect(mockPrisma.app.delete).not.toHaveBeenCalled();
    });

    it("should delete expired apps and return results", async () => {
      mockPrisma.app.findMany.mockResolvedValue([
        expiredApp,
        anotherExpiredApp,
      ]);
      mockPrisma.app.delete.mockResolvedValue({});

      const result = await cleanupExpiredBinApps();

      expect(result.dryRun).toBe(false);
      expect(result.totalFound).toBe(2);
      expect(result.deleted).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockPrisma.app.delete).toHaveBeenCalledTimes(2);
      expect(mockPrisma.app.delete).toHaveBeenCalledWith({
        where: { id: "app-1" },
      });
      expect(mockPrisma.app.delete).toHaveBeenCalledWith({
        where: { id: "app-2" },
      });
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });

    it("should handle delete errors for individual apps", async () => {
      mockPrisma.app.findMany.mockResolvedValue([
        expiredApp,
        anotherExpiredApp,
      ]);
      mockPrisma.app.delete
        .mockRejectedValueOnce(new Error("FK constraint violation"))
        .mockResolvedValueOnce({});

      const result = await cleanupExpiredBinApps();

      expect(result.totalFound).toBe(2);
      expect(result.deleted).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        appId: "app-1",
        error: "FK constraint violation",
      });
      expect(result.apps[0]!.error).toBe("FK constraint violation");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error deleting app app-1",
        expect.objectContaining({ error: expect.objectContaining({}) }),
      );
    });

    it("should throw when fetching expired apps fails", async () => {
      mockPrisma.app.findMany.mockRejectedValue(
        new Error("Database unavailable"),
      );

      await expect(cleanupExpiredBinApps()).rejects.toThrow(
        "Failed to fetch expired apps: Database unavailable",
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error fetching expired bin apps",
        expect.objectContaining({ error: expect.objectContaining({}) }),
      );
    });

    it("should respect custom retentionDays option", async () => {
      mockPrisma.app.findMany.mockResolvedValue([]);

      await cleanupExpiredBinApps({ retentionDays: 7 });

      // With 7 days retention and current time 2026-02-18T12:00:00Z,
      // threshold should be 2026-02-11T12:00:00Z
      const expectedThreshold = new Date("2026-02-11T12:00:00Z");
      expect(mockPrisma.app.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: { lte: expectedThreshold },
          },
        }),
      );
    });

    it("should respect custom batchSize option", async () => {
      mockPrisma.app.findMany.mockResolvedValue([]);

      await cleanupExpiredBinApps({ batchSize: 10 });

      expect(mockPrisma.app.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it("should use default batchSize of 100", async () => {
      mockPrisma.app.findMany.mockResolvedValue([]);

      await cleanupExpiredBinApps();

      expect(mockPrisma.app.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it("should order by deletedAt ascending (oldest first)", async () => {
      mockPrisma.app.findMany.mockResolvedValue([]);

      await cleanupExpiredBinApps();

      expect(mockPrisma.app.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { deletedAt: "asc" },
        }),
      );
    });
  });

  describe("getBinStats", () => {
    it("should return stats for apps in the bin", async () => {
      // groupBy returns array of grouped records (one per app)
      mockPrisma.app.groupBy.mockResolvedValue([
        { id: "app-1", _count: 1 },
        { id: "app-2", _count: 1 },
        { id: "app-3", _count: 1 },
      ]);

      // Apps with various deletedAt dates relative to 2026-02-18
      // Retention is 30 days, so an app deleted 29 days ago expires in 1 day (within 24h)
      // An app deleted 25 days ago expires in 5 days (within 7 days)
      // An app deleted 10 days ago expires in 20 days (not within 7 days)
      const twentyNineDaysAgo = new Date("2026-01-20T12:00:00Z");
      const twentyFiveDaysAgo = new Date("2026-01-24T12:00:00Z");
      const tenDaysAgo = new Date("2026-02-08T12:00:00Z");

      mockPrisma.app.findMany.mockResolvedValue([
        { deletedAt: twentyNineDaysAgo },
        { deletedAt: twentyFiveDaysAgo },
        { deletedAt: tenDaysAgo },
      ]);

      const stats = await getBinStats();

      expect(stats.totalInBin).toBe(3);
      expect(stats.expiringWithin24Hours).toBe(1);
      expect(stats.expiringWithin7Days).toBe(2);
    });

    it("should return zeros when groupBy fails", async () => {
      mockPrisma.app.groupBy.mockRejectedValue(
        new Error("Database unavailable"),
      );

      const stats = await getBinStats();

      expect(stats).toEqual({
        totalInBin: 0,
        expiringWithin7Days: 0,
        expiringWithin24Hours: 0,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error getting bin stats",
        expect.objectContaining({ error: expect.objectContaining({}) }),
      );
    });

    it("should handle empty bin", async () => {
      mockPrisma.app.groupBy.mockResolvedValue([]);
      mockPrisma.app.findMany.mockResolvedValue([]);

      const stats = await getBinStats();

      expect(stats).toEqual({
        totalInBin: 0,
        expiringWithin7Days: 0,
        expiringWithin24Hours: 0,
      });
    });

    it("should handle findMany returning null (error in fetching apps)", async () => {
      mockPrisma.app.groupBy.mockResolvedValue([
        { id: "app-1", _count: 1 },
      ]);
      // If findMany fails, tryCatch returns { data: null, error }
      // The code uses `apps || []` so it handles null gracefully
      mockPrisma.app.findMany.mockRejectedValue(
        new Error("findMany failed"),
      );

      const stats = await getBinStats();

      expect(stats.totalInBin).toBe(1);
      expect(stats.expiringWithin7Days).toBe(0);
      expect(stats.expiringWithin24Hours).toBe(0);
    });

    it("should count apps expiring exactly at threshold boundaries", async () => {
      // Current time: 2026-02-18T12:00:00Z
      // Retention: 30 days
      // App deleted exactly 30 days ago should have already expired (expiresAt = now)
      const exactlyThirtyDaysAgo = new Date("2026-01-19T12:00:00Z");
      // App deleted 23 days ago expires in 7 days (expiresAt = in24Hours < expiresAt <= in7Days)
      const twentyThreeDaysAgo = new Date("2026-01-26T12:00:00Z");

      mockPrisma.app.groupBy.mockResolvedValue([
        { id: "a", _count: 1 },
        { id: "b", _count: 1 },
      ]);
      mockPrisma.app.findMany.mockResolvedValue([
        { deletedAt: exactlyThirtyDaysAgo },
        { deletedAt: twentyThreeDaysAgo },
      ]);

      const stats = await getBinStats();

      expect(stats.totalInBin).toBe(2);
      // exactlyThirtyDaysAgo: expiresAt = Jan 19 + 30 = Feb 18 12:00 = now, which is <= in24Hours
      expect(stats.expiringWithin24Hours).toBe(1);
      expect(stats.expiringWithin7Days).toBe(2);
    });
  });
});
