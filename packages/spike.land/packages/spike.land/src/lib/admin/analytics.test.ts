import { describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  account: { groupBy: vi.fn() },
  user: { count: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { getUserAnalytics } from "./analytics";

describe("getUserAnalytics", () => {
  it("returns correct shape with empty data", async () => {
    mockPrisma.$queryRaw.mockReturnValue(
      Promise.resolve([]),
    );
    mockPrisma.account.groupBy.mockReturnValue(
      Promise.resolve([]),
    );
    mockPrisma.user.count.mockReturnValue(
      Promise.resolve(0),
    );

    const result = await getUserAnalytics();

    expect(result).toHaveProperty("dailyRegistrations");
    expect(result).toHaveProperty("authProviders");
    expect(result).toHaveProperty("activeUsers");
    expect(result).toHaveProperty("totalUsers");
    expect(result).toHaveProperty("growth");
    expect(result.dailyRegistrations).toEqual([]);
    expect(result.authProviders).toEqual([]);
    expect(result.activeUsers).toEqual({ last7Days: 0, last30Days: 0 });
    expect(result.totalUsers).toBe(0);
    expect(result.growth).toEqual({ last7Days: 0, last30Days: 0 });
  });

  it("merges credential users into auth providers", async () => {
    mockPrisma.$queryRaw.mockReturnValue(
      Promise.resolve([]),
    );
    mockPrisma.account.groupBy.mockReturnValue(
      Promise.resolve([
        { provider: "google", _count: { userId: 5 } },
      ]),
    );
    // Return values in order: credentialUsers, activeUsers7d, activeUsers30d, totalUsers, usersLast7Days, usersLast30Days
    mockPrisma.user.count
      .mockReturnValueOnce(Promise.resolve(3))
      .mockReturnValueOnce(Promise.resolve(10))
      .mockReturnValueOnce(Promise.resolve(20))
      .mockReturnValueOnce(Promise.resolve(50))
      .mockReturnValueOnce(Promise.resolve(5))
      .mockReturnValueOnce(Promise.resolve(15));

    const result = await getUserAnalytics();

    expect(result.authProviders).toContainEqual({ name: "google", count: 5 });
    expect(result.authProviders).toContainEqual({
      name: "credentials",
      count: 3,
    });
    expect(result.totalUsers).toBe(50);
    expect(result.activeUsers).toEqual({ last7Days: 10, last30Days: 20 });
    expect(result.growth).toEqual({ last7Days: 5, last30Days: 15 });
  });

  it("excludes credentials entry when no credential users exist", async () => {
    mockPrisma.$queryRaw.mockReturnValue(
      Promise.resolve([]),
    );
    mockPrisma.account.groupBy.mockReturnValue(
      Promise.resolve([
        { provider: "github", _count: { userId: 8 } },
      ]),
    );
    mockPrisma.user.count.mockReturnValue(
      Promise.resolve(0),
    );

    const result = await getUserAnalytics();

    expect(result.authProviders).toEqual([{ name: "github", count: 8 }]);
    expect(
      result.authProviders.find(p => p.name === "credentials"),
    ).toBeUndefined();
  });

  it("formats daily registrations correctly", async () => {
    const testDate = new Date("2025-06-15T00:00:00.000Z");
    mockPrisma.$queryRaw.mockReturnValue(
      Promise.resolve([
        { date: testDate, count: BigInt(7) },
      ]),
    );
    mockPrisma.account.groupBy.mockReturnValue(
      Promise.resolve([]),
    );
    mockPrisma.user.count.mockReturnValue(
      Promise.resolve(0),
    );

    const result = await getUserAnalytics();

    expect(result.dailyRegistrations).toEqual([
      { date: "2025-06-15", count: 7 },
    ]);
  });

  it("handles individual query failures gracefully", async () => {
    mockPrisma.$queryRaw.mockReturnValue(
      Promise.reject(new Error("DB connection failed")),
    );
    mockPrisma.account.groupBy.mockReturnValue(
      Promise.reject(new Error("DB connection failed")),
    );
    mockPrisma.user.count.mockReturnValue(
      Promise.reject(new Error("DB connection failed")),
    );

    const result = await getUserAnalytics();

    expect(result.dailyRegistrations).toEqual([]);
    expect(result.authProviders).toEqual([]);
    expect(result.activeUsers).toEqual({ last7Days: 0, last30Days: 0 });
    expect(result.totalUsers).toBe(0);
    expect(result.growth).toEqual({ last7Days: 0, last30Days: 0 });
  });
});
