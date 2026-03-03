import { describe, expect, it, vi } from "vitest";

// error-log.ts uses dynamic import("@/lib/prisma"), so we mock the module
const { mockErrorLogGroupBy, mockErrorLogFindUnique, mockErrorLogCount } = vi.hoisted(() => ({
  mockErrorLogGroupBy: vi.fn(),
  mockErrorLogFindUnique: vi.fn(),
  mockErrorLogCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    errorLog: {
      groupBy: mockErrorLogGroupBy,
      findUnique: mockErrorLogFindUnique,
      count: mockErrorLogCount,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getErrorDetail, getErrorStats, listErrorIssues } from "./error-log";

// ── listErrorIssues ────────────────────────────────────────────────────────────

describe("listErrorIssues", () => {
  beforeEach(() => mockErrorLogGroupBy.mockReset());

  it("returns mapped error issues on success", async () => {
    const now = new Date("2024-01-01T12:00:00Z");
    const earlier = new Date("2024-01-01T08:00:00Z");
    mockErrorLogGroupBy.mockResolvedValue([
      {
        message: "TypeError: cannot read",
        environment: "production",
        errorType: "TypeError",
        _count: { id: 5 },
        _max: { timestamp: now },
        _min: { timestamp: earlier },
      },
    ]);

    const results = await listErrorIssues();
    expect(results).toHaveLength(1);
    expect(results[0]!.message).toBe("TypeError: cannot read");
    expect(results[0]!.count).toBe(5);
    expect(results[0]!.environment).toBe("production");
    expect(results[0]!.errorType).toBe("TypeError");
    expect(results[0]!.lastSeen).toBe(now.toISOString());
    expect(results[0]!.firstSeen).toBe(earlier.toISOString());
  });

  it("returns empty array when groupBy returns empty result", async () => {
    mockErrorLogGroupBy.mockResolvedValue([]);
    const results = await listErrorIssues();
    expect(results).toEqual([]);
  });

  it("passes query filter when provided", async () => {
    mockErrorLogGroupBy.mockResolvedValue([]);
    await listErrorIssues({ query: "TypeError" });
    expect(mockErrorLogGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { message: { contains: "TypeError", mode: "insensitive" } },
      }),
    );
  });

  it("passes limit option to groupBy", async () => {
    mockErrorLogGroupBy.mockResolvedValue([]);
    await listErrorIssues({ limit: 10 });
    expect(mockErrorLogGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it("defaults to limit 25 when no limit provided", async () => {
    mockErrorLogGroupBy.mockResolvedValue([]);
    await listErrorIssues();
    expect(mockErrorLogGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
  });

  it("uses empty where clause when no query provided", async () => {
    mockErrorLogGroupBy.mockResolvedValue([]);
    await listErrorIssues({});
    expect(mockErrorLogGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("handles null timestamps with empty string fallback", async () => {
    mockErrorLogGroupBy.mockResolvedValue([
      {
        message: "error",
        environment: "test",
        errorType: null,
        _count: { id: 1 },
        _max: { timestamp: null },
        _min: { timestamp: null },
      },
    ]);
    const results = await listErrorIssues();
    expect(results[0]!.lastSeen).toBe("");
    expect(results[0]!.firstSeen).toBe("");
  });
});

// ── getErrorDetail ─────────────────────────────────────────────────────────────

describe("getErrorDetail", () => {
  beforeEach(() => mockErrorLogFindUnique.mockReset());

  it("returns null when record not found", async () => {
    mockErrorLogFindUnique.mockResolvedValue(null);
    const result = await getErrorDetail("missing-id");
    expect(result).toBeNull();
  });

  it("returns mapped error detail on success", async () => {
    const ts = new Date("2024-06-01T10:00:00Z");
    mockErrorLogFindUnique.mockResolvedValue({
      id: "err-1",
      message: "Something went wrong",
      stack: "Error at line 1",
      sourceFile: "app/route.ts",
      sourceLine: 42,
      sourceColumn: 5,
      callerName: "handler",
      errorType: "Error",
      errorCode: "500",
      route: "/api/test",
      userId: "user-1",
      environment: "production",
      metadata: { key: "value" },
      timestamp: ts,
    });

    const result = await getErrorDetail("err-1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("err-1");
    expect(result!.message).toBe("Something went wrong");
    expect(result!.timestamp).toBe(ts.toISOString());
    expect(result!.route).toBe("/api/test");
    expect(result!.userId).toBe("user-1");
  });

  it("returns null when findUnique returns null (not found)", async () => {
    mockErrorLogFindUnique.mockResolvedValue(null);
    const result = await getErrorDetail("not-found-id");
    expect(result).toBeNull();
  });
});

// ── getErrorStats ──────────────────────────────────────────────────────────────

describe("getErrorStats", () => {
  beforeEach(() => {
    mockErrorLogCount.mockReset();
    mockErrorLogGroupBy.mockReset();
  });

  it("returns stats with counts and byEnvironment breakdown", async () => {
    mockErrorLogCount
      .mockResolvedValueOnce(3) // last24h
      .mockResolvedValueOnce(15) // last7d
      .mockResolvedValueOnce(50); // last30d
    mockErrorLogGroupBy.mockResolvedValue([
      { environment: "production", _count: { id: 40 } },
      { environment: "staging", _count: { id: 10 } },
    ]);

    const stats = await getErrorStats();
    expect(stats).not.toBeNull();
    expect(stats!.last24h).toBe(3);
    expect(stats!.last7d).toBe(15);
    expect(stats!.last30d).toBe(50);
    expect(stats!.byEnvironment).toEqual({ production: 40, staging: 10 });
  });

  it("returns null on DB error (catches and warns)", async () => {
    mockErrorLogCount.mockRejectedValue(new Error("Stats query failed"));
    const result = await getErrorStats();
    expect(result).toBeNull();
  });

  it("returns empty byEnvironment when no rows returned", async () => {
    mockErrorLogCount.mockResolvedValue(0);
    mockErrorLogGroupBy.mockResolvedValue([]);
    const stats = await getErrorStats();
    expect(stats!.byEnvironment).toEqual({});
  });
});
