import { describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: { count: vi.fn() },
  imageEnhancementJob: { groupBy: vi.fn() },
  workspace: { aggregate: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { getDashboardMetrics, getDefaultMetrics } from "./dashboard";

describe("getDefaultMetrics", () => {
  it("returns all zeros with a timestamp", () => {
    const metrics = getDefaultMetrics();

    expect(metrics.totalUsers).toBe(0);
    expect(metrics.adminCount).toBe(0);
    expect(metrics.totalEnhancements).toBe(0);
    expect(metrics.jobStatus).toEqual({
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      active: 0,
    });
    expect(metrics.totalCreditsAllocated).toBe(0);
    expect(metrics.totalCreditsUsed).toBe(0);
    expect(metrics.totalWorkspaces).toBe(0);
    expect(typeof metrics.timestamp).toBe("string");
    expect(new Date(metrics.timestamp).getTime()).not.toBeNaN();
  });
});

describe("getDashboardMetrics", () => {
  it("returns correct shape from Prisma queries", async () => {
    mockPrisma.user.count
      .mockResolvedValueOnce(42) // totalUsers
      .mockResolvedValueOnce(3); // adminCount

    mockPrisma.imageEnhancementJob.groupBy.mockResolvedValueOnce([
      { status: "PENDING", _count: 5 },
      { status: "PROCESSING", _count: 2 },
      { status: "COMPLETED", _count: 30 },
      { status: "FAILED", _count: 1 },
    ]);

    mockPrisma.workspace.aggregate.mockResolvedValueOnce({
      _count: { _all: 10 },
      _sum: { monthlyAiCredits: 5000, usedAiCredits: 1200 },
    });

    const metrics = await getDashboardMetrics();

    expect(metrics.totalUsers).toBe(42);
    expect(metrics.adminCount).toBe(3);
    expect(metrics.totalEnhancements).toBe(38);
    expect(metrics.jobStatus).toEqual({
      pending: 5,
      processing: 2,
      completed: 30,
      failed: 1,
      active: 7,
    });
    expect(metrics.totalCreditsAllocated).toBe(5000);
    expect(metrics.totalCreditsUsed).toBe(1200);
    expect(metrics.totalWorkspaces).toBe(10);
    expect(typeof metrics.timestamp).toBe("string");
  });

  it("handles null credit sums gracefully", async () => {
    mockPrisma.user.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    mockPrisma.imageEnhancementJob.groupBy.mockResolvedValueOnce([]);

    mockPrisma.workspace.aggregate.mockResolvedValueOnce({
      _count: { _all: 0 },
      _sum: { monthlyAiCredits: null, usedAiCredits: null },
    });

    const metrics = await getDashboardMetrics();

    expect(metrics.totalCreditsAllocated).toBe(0);
    expect(metrics.totalCreditsUsed).toBe(0);
    expect(metrics.totalEnhancements).toBe(0);
  });

  it("returns defaults on error", async () => {
    mockPrisma.user.count.mockRejectedValueOnce(
      new Error("DB connection failed"),
    );

    const metrics = await getDashboardMetrics();

    expect(metrics.totalUsers).toBe(0);
    expect(metrics.adminCount).toBe(0);
    expect(metrics.totalEnhancements).toBe(0);
    expect(metrics.jobStatus.active).toBe(0);
    expect(typeof metrics.timestamp).toBe("string");
  });
});
