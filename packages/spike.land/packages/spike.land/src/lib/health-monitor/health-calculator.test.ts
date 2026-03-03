import { describe, expect, it } from "vitest";

import type { SocialAccountHealth } from "@prisma/client";

import {
  calculateErrorScore,
  calculateFullHealth,
  calculateHealthScore,
  calculateRateLimitScore,
  calculateSyncScore,
  calculateTokenScore,
  scoreToStatus,
} from "./health-calculator";

describe("calculateHealthScore", () => {
  it("returns weighted average of component scores", () => {
    // Default weights: sync=0.30, rateLimit=0.25, error=0.25, token=0.20
    const score = calculateHealthScore(100, 100, 100, 100);
    expect(score).toBe(100);
  });

  it("handles all zeros", () => {
    expect(calculateHealthScore(0, 0, 0, 0)).toBe(0);
  });

  it("respects custom weights", () => {
    const score = calculateHealthScore(100, 0, 0, 0, {
      syncStatus: 1.0,
      rateLimitUsage: 0,
      errorFrequency: 0,
      tokenHealth: 0,
    });
    expect(score).toBe(100);
  });

  it("clamps to 0-100 range", () => {
    expect(calculateHealthScore(-50, -50, -50, -50)).toBe(0);
    expect(calculateHealthScore(200, 200, 200, 200)).toBe(100);
  });

  it("rounds to integer", () => {
    const score = calculateHealthScore(33, 33, 33, 33);
    expect(Number.isInteger(score)).toBe(true);
  });
});

describe("calculateSyncScore", () => {
  it("returns 0 for null lastSuccessfulSync", () => {
    expect(calculateSyncScore(null, 0)).toBe(0);
  });

  it("returns 100 for recent sync with no errors", () => {
    const recentSync = new Date(Date.now() - 1000 * 60 * 30); // 30 min ago
    expect(calculateSyncScore(recentSync, 0)).toBe(100);
  });

  it("returns 85 for sync 8 hours ago", () => {
    const sync = new Date(Date.now() - 1000 * 60 * 60 * 8);
    expect(calculateSyncScore(sync, 0)).toBe(85);
  });

  it("returns 70 for sync 15 hours ago", () => {
    const sync = new Date(Date.now() - 1000 * 60 * 60 * 15);
    expect(calculateSyncScore(sync, 0)).toBe(70);
  });

  it("returns 50 for sync 30 hours ago", () => {
    const sync = new Date(Date.now() - 1000 * 60 * 60 * 30);
    expect(calculateSyncScore(sync, 0)).toBe(50);
  });

  it("returns 20 for sync 72 hours ago", () => {
    const sync = new Date(Date.now() - 1000 * 60 * 60 * 72);
    expect(calculateSyncScore(sync, 0)).toBe(20);
  });

  it("deducts 10 per consecutive error", () => {
    const recentSync = new Date(Date.now() - 1000 * 60 * 30);
    expect(calculateSyncScore(recentSync, 3)).toBe(70);
  });

  it("clamps to 0 with many errors", () => {
    const recentSync = new Date(Date.now() - 1000 * 60 * 30);
    expect(calculateSyncScore(recentSync, 20)).toBe(0);
  });
});

describe("calculateRateLimitScore", () => {
  it("returns 0 when rate limited", () => {
    expect(calculateRateLimitScore(50, 100, true)).toBe(0);
  });

  it("returns 100 when no rate limit data", () => {
    expect(calculateRateLimitScore(null, null, false)).toBe(100);
  });

  it("returns 100 when total is 0", () => {
    expect(calculateRateLimitScore(0, 0, false)).toBe(100);
  });

  it("returns 100 for low usage (< 50%)", () => {
    expect(calculateRateLimitScore(80, 100, false)).toBe(100);
  });

  it("returns 80 for moderate usage (50-69%)", () => {
    expect(calculateRateLimitScore(40, 100, false)).toBe(80);
  });

  it("returns 60 for high usage (70-84%)", () => {
    expect(calculateRateLimitScore(20, 100, false)).toBe(60);
  });

  it("returns 30 for warning usage (85-94%)", () => {
    expect(calculateRateLimitScore(10, 100, false)).toBe(30);
  });

  it("returns 10 for critical usage (>= 95%)", () => {
    expect(calculateRateLimitScore(3, 100, false)).toBe(10);
  });
});

describe("calculateErrorScore", () => {
  it("returns 100 for 0 errors", () => {
    expect(calculateErrorScore(0)).toBe(100);
  });

  it("returns 80 for 1-2 errors", () => {
    expect(calculateErrorScore(1)).toBe(80);
    expect(calculateErrorScore(2)).toBe(80);
  });

  it("returns 60 for 3-5 errors", () => {
    expect(calculateErrorScore(5)).toBe(60);
  });

  it("returns 40 for 6-10 errors", () => {
    expect(calculateErrorScore(10)).toBe(40);
  });

  it("returns 20 for 11-20 errors", () => {
    expect(calculateErrorScore(15)).toBe(20);
  });

  it("returns 0 for 21+ errors", () => {
    expect(calculateErrorScore(25)).toBe(0);
  });
});

describe("calculateTokenScore", () => {
  it("returns 20 when refresh required", () => {
    expect(calculateTokenScore(null, true)).toBe(20);
  });

  it("returns 100 when no expiration date", () => {
    expect(calculateTokenScore(null, false)).toBe(100);
  });

  it("returns 0 when already expired", () => {
    const expired = new Date(Date.now() - 1000 * 60 * 60);
    expect(calculateTokenScore(expired, false)).toBe(0);
  });

  it("returns 20 when expiring within 6 hours", () => {
    const expiry = new Date(Date.now() + 1000 * 60 * 60 * 3);
    expect(calculateTokenScore(expiry, false)).toBe(20);
  });

  it("returns 50 when expiring within 24 hours", () => {
    const expiry = new Date(Date.now() + 1000 * 60 * 60 * 12);
    expect(calculateTokenScore(expiry, false)).toBe(50);
  });

  it("returns 75 when expiring within 72 hours", () => {
    const expiry = new Date(Date.now() + 1000 * 60 * 60 * 48);
    expect(calculateTokenScore(expiry, false)).toBe(75);
  });

  it("returns 90 when expiring within a week", () => {
    const expiry = new Date(Date.now() + 1000 * 60 * 60 * 120);
    expect(calculateTokenScore(expiry, false)).toBe(90);
  });

  it("returns 100 when expiring after a week", () => {
    const expiry = new Date(Date.now() + 1000 * 60 * 60 * 200);
    expect(calculateTokenScore(expiry, false)).toBe(100);
  });
});

describe("scoreToStatus", () => {
  it("returns HEALTHY for score >= 80", () => {
    expect(scoreToStatus(80)).toBe("HEALTHY");
    expect(scoreToStatus(100)).toBe("HEALTHY");
  });

  it("returns DEGRADED for score 50-79", () => {
    expect(scoreToStatus(50)).toBe("DEGRADED");
    expect(scoreToStatus(79)).toBe("DEGRADED");
  });

  it("returns UNHEALTHY for score 20-49", () => {
    expect(scoreToStatus(20)).toBe("UNHEALTHY");
    expect(scoreToStatus(49)).toBe("UNHEALTHY");
  });

  it("returns CRITICAL for score < 20", () => {
    expect(scoreToStatus(0)).toBe("CRITICAL");
    expect(scoreToStatus(19)).toBe("CRITICAL");
  });
});

describe("calculateFullHealth", () => {
  function makeHealth(
    overrides: Partial<SocialAccountHealth> = {},
  ): SocialAccountHealth {
    return {
      id: "h-1",
      accountId: "acc-1",
      healthScore: 100,
      status: "HEALTHY",
      lastSuccessfulSync: new Date(),
      consecutiveErrors: 0,
      totalErrorsLast24h: 0,
      rateLimitRemaining: 100,
      rateLimitTotal: 100,
      isRateLimited: false,
      rateLimitResetAt: null,
      tokenExpiresAt: null,
      tokenRefreshRequired: false,
      lastCheckedAt: new Date(),
      updatedAt: new Date(),
      createdAt: new Date(),
      ...overrides,
    } as SocialAccountHealth;
  }

  it("returns HEALTHY for a fully healthy account", () => {
    const result = calculateFullHealth(makeHealth());
    expect(result.status).toBe("HEALTHY");
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("returns CRITICAL when rate limited with errors", () => {
    const result = calculateFullHealth(
      makeHealth({
        isRateLimited: true,
        totalErrorsLast24h: 25,
        consecutiveErrors: 5,
        tokenRefreshRequired: true,
      }),
    );
    expect(result.status).toBe("CRITICAL");
    expect(result.score).toBeLessThan(20);
  });

  it("returns DEGRADED for moderate issues", () => {
    const result = calculateFullHealth(
      makeHealth({
        lastSuccessfulSync: new Date(Date.now() - 1000 * 60 * 60 * 30),
        totalErrorsLast24h: 8,
      }),
    );
    expect(["DEGRADED", "UNHEALTHY"]).toContain(result.status);
  });
});
