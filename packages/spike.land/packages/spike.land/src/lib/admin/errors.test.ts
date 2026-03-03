import { describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  errorLog: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { calculateTrend, getErrorStats, getInitialErrorData } from "./errors";

describe("calculateTrend", () => {
  it("returns \"up\" when current exceeds previous by more than 10%", () => {
    expect(calculateTrend(120, 100)).toBe("up");
    expect(calculateTrend(200, 100)).toBe("up");
  });

  it("returns \"down\" when current is below previous by more than 10%", () => {
    expect(calculateTrend(80, 100)).toBe("down");
    expect(calculateTrend(50, 100)).toBe("down");
  });

  it("returns \"stable\" when change is within 10%", () => {
    expect(calculateTrend(105, 100)).toBe("stable");
    expect(calculateTrend(95, 100)).toBe("stable");
    expect(calculateTrend(100, 100)).toBe("stable");
  });

  it("returns \"up\" when previous is 0 but current is positive", () => {
    expect(calculateTrend(5, 0)).toBe("up");
    expect(calculateTrend(1, 0)).toBe("up");
  });

  it("returns \"stable\" when both are 0", () => {
    expect(calculateTrend(0, 0)).toBe("stable");
  });
});

describe("getInitialErrorData", () => {
  it("returns correct shape with errors, pagination, and stats", async () => {
    const mockErrors = [
      {
        id: "err-1",
        message: "Test error",
        errorType: "TypeError",
        sourceFile: "app.ts",
        environment: "production",
        timestamp: new Date("2025-01-01"),
      },
    ];

    mockPrisma.errorLog.findMany.mockResolvedValue(mockErrors);
    mockPrisma.errorLog.count
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(25); // last 24h

    const result = await getInitialErrorData();

    expect(result.errors).toEqual(mockErrors);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 100,
      totalPages: 2,
    });
    expect(result.stats).toEqual({ total24h: 25 });
  });

  it("calculates totalPages correctly for non-even totals", async () => {
    mockPrisma.errorLog.findMany.mockResolvedValue([]);
    mockPrisma.errorLog.count
      .mockResolvedValueOnce(75)
      .mockResolvedValueOnce(10);

    const result = await getInitialErrorData();

    expect(result.pagination.totalPages).toBe(2);
  });

  it("handles zero total", async () => {
    mockPrisma.errorLog.findMany.mockResolvedValue([]);
    mockPrisma.errorLog.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const result = await getInitialErrorData();

    expect(result.pagination.totalPages).toBe(0);
    expect(result.pagination.total).toBe(0);
  });
});

describe("getErrorStats", () => {
  it("returns correct shape with mocked data", async () => {
    mockPrisma.errorLog.count
      .mockResolvedValueOnce(5) // lastHour
      .mockResolvedValueOnce(50) // last24h
      .mockResolvedValueOnce(40); // previous24h

    mockPrisma.errorLog.groupBy
      .mockResolvedValueOnce([
        { sourceFile: "index.ts", _count: { sourceFile: 10 } },
        { sourceFile: "app.ts", _count: { sourceFile: 5 } },
      ]) // topFiles
      .mockResolvedValueOnce([
        { errorType: "TypeError", _count: { errorType: 8 } },
      ]) // topErrors
      .mockResolvedValueOnce([
        { environment: "production", _count: { environment: 30 } },
        { environment: "development", _count: { environment: 20 } },
      ]); // byEnvironment

    const result = await getErrorStats();

    expect(result.lastHour).toBe(5);
    expect(result.last24h).toBe(50);
    expect(result.previous24h).toBe(40);
    expect(result.trend).toBe("up");
    expect(result.timestamp).toBeDefined();
  });

  it("maps topFiles correctly", async () => {
    mockPrisma.errorLog.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    mockPrisma.errorLog.groupBy
      .mockResolvedValueOnce([
        { sourceFile: "utils.ts", _count: { sourceFile: 3 } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getErrorStats();

    expect(result.topFiles).toEqual([{ file: "utils.ts", count: 3 }]);
  });

  it("maps topErrors correctly", async () => {
    mockPrisma.errorLog.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    mockPrisma.errorLog.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { errorType: "RangeError", _count: { errorType: 7 } },
        { errorType: "SyntaxError", _count: { errorType: 2 } },
      ])
      .mockResolvedValueOnce([]);

    const result = await getErrorStats();

    expect(result.topErrors).toEqual([
      { type: "RangeError", count: 7 },
      { type: "SyntaxError", count: 2 },
    ]);
  });

  it("maps byEnvironment correctly", async () => {
    mockPrisma.errorLog.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    mockPrisma.errorLog.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { environment: "staging", _count: { environment: 12 } },
      ]);

    const result = await getErrorStats();

    expect(result.byEnvironment).toEqual({ staging: 12 });
  });
});
