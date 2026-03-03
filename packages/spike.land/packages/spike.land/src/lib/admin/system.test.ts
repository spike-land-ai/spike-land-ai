import { describe, expect, it, vi } from "vitest";

// ---- Prisma mock (hoisted for vitest forks pool) ----

const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  imageEnhancementJob: {
    groupBy: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

// ---- R2 mock ----

const mockR2 = vi.hoisted(() => ({
  isStorageConfigured: vi.fn(),
  listR2StorageStats: vi.fn(),
}));

vi.mock("@/lib/storage/r2-client", () => mockR2);

import { EnhancementTier, JobStatus } from "@prisma/client";
import {
  calculateTierStats,
  type FailureByTier,
  getStorageStats,
  getSystemHealthMetrics,
} from "./system";

// ================================================================
// calculateTierStats (pure function)
// ================================================================

describe("calculateTierStats", () => {
  it("calculates failure rate correctly", () => {
    const input: FailureByTier[] = [
      { tier: EnhancementTier.TIER_1K, status: JobStatus.COMPLETED, _count: 8 },
      { tier: EnhancementTier.TIER_1K, status: JobStatus.FAILED, _count: 2 },
    ];

    const result = calculateTierStats(input);
    const tier1k = result.find(t => t.tier === EnhancementTier.TIER_1K);

    expect(tier1k).toBeDefined();
    expect(tier1k!.total).toBe(10);
    expect(tier1k!.failed).toBe(2);
    expect(tier1k!.failureRate).toBe(20);
  });

  it("returns 0 failureRate for tiers with no jobs", () => {
    const result = calculateTierStats([]);

    for (const stat of result) {
      expect(stat.total).toBe(0);
      expect(stat.failed).toBe(0);
      expect(stat.failureRate).toBe(0);
    }
  });

  it("returns a stat for every EnhancementTier value", () => {
    const result = calculateTierStats([]);
    const tiers = Object.values(EnhancementTier);

    expect(result).toHaveLength(tiers.length);
    for (const tier of tiers) {
      expect(result.find(s => s.tier === tier)).toBeDefined();
    }
  });

  it("handles multiple tiers with mixed statuses", () => {
    const input: FailureByTier[] = [
      { tier: EnhancementTier.FREE, status: JobStatus.COMPLETED, _count: 50 },
      { tier: EnhancementTier.FREE, status: JobStatus.FAILED, _count: 5 },
      {
        tier: EnhancementTier.TIER_4K,
        status: JobStatus.COMPLETED,
        _count: 10,
      },
      {
        tier: EnhancementTier.TIER_4K,
        status: JobStatus.PROCESSING,
        _count: 3,
      },
    ];

    const result = calculateTierStats(input);

    const free = result.find(t => t.tier === EnhancementTier.FREE)!;
    expect(free.total).toBe(55);
    expect(free.failed).toBe(5);
    expect(free.failureRate).toBeCloseTo(9.09, 1);

    const tier4k = result.find(t => t.tier === EnhancementTier.TIER_4K)!;
    expect(tier4k.total).toBe(13);
    expect(tier4k.failed).toBe(0);
    expect(tier4k.failureRate).toBe(0);
  });
});

// ================================================================
// getSystemHealthMetrics
// ================================================================

describe("getSystemHealthMetrics", () => {
  it("returns correct shape from Prisma queries", async () => {
    const testDate = new Date("2025-01-15T10:00:00Z");

    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ hour: testDate, count: BigInt(5) }])
      .mockResolvedValueOnce([{ tier: "TIER_1K", avg_seconds: 12.5 }]);

    mockPrisma.imageEnhancementJob.groupBy
      .mockResolvedValueOnce([
        {
          tier: EnhancementTier.TIER_1K,
          status: JobStatus.COMPLETED,
          _count: 10,
        },
        { tier: EnhancementTier.TIER_1K, status: JobStatus.FAILED, _count: 1 },
      ])
      .mockResolvedValueOnce([
        { status: JobStatus.COMPLETED, _count: 10 },
        { status: JobStatus.FAILED, _count: 1 },
      ]);

    mockPrisma.imageEnhancementJob.count.mockResolvedValueOnce(3);

    mockPrisma.imageEnhancementJob.findMany.mockResolvedValueOnce([
      {
        id: "job-1",
        tier: EnhancementTier.TIER_1K,
        errorMessage: "Out of memory",
        createdAt: testDate,
      },
    ]);

    const metrics = await getSystemHealthMetrics();

    expect(metrics.hourlyJobs).toEqual([
      { hour: "2025-01-15T10:00:00.000Z", count: 5 },
    ]);
    expect(metrics.avgProcessingTime).toEqual([
      { tier: "TIER_1K", seconds: 13 },
    ]);
    expect(metrics.queueDepth).toBe(3);
    expect(metrics.jobsByStatus).toEqual([
      { status: JobStatus.COMPLETED, count: 10 },
      { status: JobStatus.FAILED, count: 1 },
    ]);
    expect(metrics.recentFailures).toEqual([
      {
        id: "job-1",
        tier: EnhancementTier.TIER_1K,
        error: "Out of memory",
        timestamp: "2025-01-15T10:00:00.000Z",
      },
    ]);
    expect(metrics.tierStats.length).toBe(
      Object.values(EnhancementTier).length,
    );
  });

  it("returns empty/zero defaults when queries fail", async () => {
    mockPrisma.$queryRaw
      .mockRejectedValueOnce(new Error("DB down"))
      .mockRejectedValueOnce(new Error("DB down"));
    mockPrisma.imageEnhancementJob.groupBy
      .mockRejectedValueOnce(new Error("DB down"))
      .mockRejectedValueOnce(new Error("DB down"));
    mockPrisma.imageEnhancementJob.count.mockRejectedValueOnce(
      new Error("DB down"),
    );
    mockPrisma.imageEnhancementJob.findMany.mockRejectedValueOnce(
      new Error("DB down"),
    );

    const metrics = await getSystemHealthMetrics();

    expect(metrics.hourlyJobs).toEqual([]);
    expect(metrics.avgProcessingTime).toEqual([]);
    expect(metrics.queueDepth).toBe(0);
    expect(metrics.jobsByStatus).toEqual([]);
    expect(metrics.recentFailures).toEqual([]);
    expect(metrics.tierStats.length).toBe(
      Object.values(EnhancementTier).length,
    );
  });
});

// ================================================================
// getStorageStats
// ================================================================

describe("getStorageStats", () => {
  it("returns unconfigured defaults when R2 is not set up", async () => {
    mockR2.isStorageConfigured.mockReturnValue(false);

    const stats = await getStorageStats();

    expect(stats.isConfigured).toBe(false);
    expect(stats.totalFiles).toBe(0);
    expect(stats.totalSizeFormatted).toBe("0 B");
  });

  it("computes image stats and formats sizes", async () => {
    mockR2.isStorageConfigured.mockReturnValue(true);
    mockR2.listR2StorageStats.mockResolvedValue({
      success: true,
      stats: {
        totalFiles: 100,
        totalSizeBytes: 1048576, // 1 MB
        averageSizeBytes: 10485, // ~10 KB
        byFileType: {
          png: { count: 40, sizeBytes: 524288 },
          jpg: { count: 30, sizeBytes: 262144 },
          pdf: { count: 30, sizeBytes: 262144 },
        },
      },
    });

    const stats = await getStorageStats();

    expect(stats.isConfigured).toBe(true);
    expect(stats.totalFiles).toBe(100);
    expect(stats.totalSizeFormatted).toBe("1 MB");
    expect(stats.imageStats.count).toBe(70); // png + jpg
    expect(stats.imageStats.sizeBytes).toBe(786432); // 524288 + 262144
    expect(stats.byFileType.png).toBeDefined();
    expect(stats.byFileType.png!.sizeFormatted).toBe("512 KB");
    expect(stats.byFileType.pdf).toBeDefined();
    expect(stats.byFileType.pdf!.count).toBe(30);
  });

  it("throws when R2 returns an error", async () => {
    mockR2.isStorageConfigured.mockReturnValue(true);
    mockR2.listR2StorageStats.mockResolvedValue({
      success: false,
      stats: null,
      error: "Bucket not found",
    });

    await expect(getStorageStats()).rejects.toThrow("Bucket not found");
  });

  it("throws generic message when no error detail provided", async () => {
    mockR2.isStorageConfigured.mockReturnValue(true);
    mockR2.listR2StorageStats.mockResolvedValue({
      success: false,
      stats: null,
    });

    await expect(getStorageStats()).rejects.toThrow(
      "Failed to fetch storage stats",
    );
  });
});
