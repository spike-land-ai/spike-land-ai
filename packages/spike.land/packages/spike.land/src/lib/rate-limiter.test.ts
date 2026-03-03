import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRedis = vi.hoisted(() => ({
  ping: vi.fn().mockResolvedValue("PONG"),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  pttl: vi.fn().mockResolvedValue(60000),
  eval: vi.fn().mockResolvedValue([1, 60000]),
}));

vi.mock("@/lib/upstash/client", () => ({
  redis: mockRedis,
}));

import {
  checkRateLimit,
  clearAllRateLimits,
  forceKVStorage,
  forceMemoryStorage,
  getRateLimitStoreSize,
  rateLimitConfigs,
  resetKVAvailability,
  resetRateLimit,
  stopCleanupInterval,
} from "./rate-limiter";

describe("rate-limiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetKVAvailability();
    stopCleanupInterval();
  });

  afterEach(async () => {
    await clearAllRateLimits();
    stopCleanupInterval();
  });

  describe("in-memory fallback", () => {
    beforeEach(() => {
      forceMemoryStorage();
    });

    it("allows requests under the limit", async () => {
      const config = { maxRequests: 3, windowMs: 60000 };

      const r1 = await checkRateLimit("user1", config);
      expect(r1.isLimited).toBe(false);
      expect(r1.remaining).toBe(2);

      const r2 = await checkRateLimit("user1", config);
      expect(r2.isLimited).toBe(false);
      expect(r2.remaining).toBe(1);

      const r3 = await checkRateLimit("user1", config);
      expect(r3.isLimited).toBe(false);
      expect(r3.remaining).toBe(0);
    });

    it("blocks requests over the limit", async () => {
      const config = { maxRequests: 2, windowMs: 60000 };

      await checkRateLimit("user2", config);
      await checkRateLimit("user2", config);
      const r3 = await checkRateLimit("user2", config);

      expect(r3.isLimited).toBe(true);
      expect(r3.remaining).toBe(0);
    });

    it("tracks different identifiers independently", async () => {
      const config = { maxRequests: 1, windowMs: 60000 };

      const r1 = await checkRateLimit("userA", config);
      expect(r1.isLimited).toBe(false);

      const r2 = await checkRateLimit("userB", config);
      expect(r2.isLimited).toBe(false);

      const r3 = await checkRateLimit("userA", config);
      expect(r3.isLimited).toBe(true);
    });

    it("resets after window expires", async () => {
      const config = { maxRequests: 1, windowMs: 100 };

      const r1 = await checkRateLimit("user3", config);
      expect(r1.isLimited).toBe(false);

      const r2 = await checkRateLimit("user3", config);
      expect(r2.isLimited).toBe(true);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const r3 = await checkRateLimit("user3", config);
      expect(r3.isLimited).toBe(false);
    });

    it("resetRateLimit clears a specific identifier", async () => {
      const config = { maxRequests: 1, windowMs: 60000 };

      await checkRateLimit("user4", config);
      const r2 = await checkRateLimit("user4", config);
      expect(r2.isLimited).toBe(true);

      await resetRateLimit("user4");

      const r3 = await checkRateLimit("user4", config);
      expect(r3.isLimited).toBe(false);
    });

    it("getRateLimitStoreSize returns correct count", async () => {
      const config = { maxRequests: 10, windowMs: 60000 };

      expect(getRateLimitStoreSize()).toBe(0);
      await checkRateLimit("a", config);
      await checkRateLimit("b", config);
      expect(getRateLimitStoreSize()).toBe(2);
    });
  });

  describe("Redis (KV) backend", () => {
    beforeEach(() => {
      forceKVStorage();
    });

    it("uses redis.eval for atomic counting", async () => {
      mockRedis.eval.mockResolvedValue([1, 60000]);

      const result = await checkRateLimit(
        "redis-user",
        rateLimitConfigs.vibeChat,
      );

      expect(result.isLimited).toBe(false);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call(\"INCR\", KEYS[1])"),
        ["ratelimit:redis-user"],
        [60],
      );
    });

    it("returns isLimited when count exceeds maxRequests", async () => {
      mockRedis.eval.mockResolvedValue([11, 45000]);

      const result = await checkRateLimit(
        "redis-user3",
        rateLimitConfigs.vibeChat,
      );

      expect(result.isLimited).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it("returns correct remaining count", async () => {
      mockRedis.eval.mockResolvedValue([7, 30000]);

      const result = await checkRateLimit(
        "redis-user4",
        rateLimitConfigs.vibeChat,
      );

      expect(result.isLimited).toBe(false);
      expect(result.remaining).toBe(3); // 10 - 7
    });

    it("falls back to in-memory on Redis error", async () => {
      mockRedis.eval.mockRejectedValue(new Error("Redis connection failed"));

      const result = await checkRateLimit(
        "fallback-user",
        rateLimitConfigs.vibeChat,
      );

      // Should still work via in-memory fallback
      expect(result.isLimited).toBe(false);
    });
  });

  describe("bypass in E2E/test mode", () => {
    it("bypasses rate limit when E2E_BYPASS_AUTH is set", async () => {
      vi.stubEnv("E2E_BYPASS_AUTH", "true");
      forceMemoryStorage();
      const config = { maxRequests: 1, windowMs: 60000 };

      await checkRateLimit("bypass-user", config);
      const r2 = await checkRateLimit("bypass-user", config);

      expect(r2.isLimited).toBe(false);
      vi.unstubAllEnvs();
    });

    it("bypasses rate limit when SKIP_RATE_LIMIT is set", async () => {
      vi.stubEnv("SKIP_RATE_LIMIT", "true");
      forceMemoryStorage();
      const config = { maxRequests: 1, windowMs: 60000 };

      await checkRateLimit("bypass-user2", config);
      const r2 = await checkRateLimit("bypass-user2", config);

      expect(r2.isLimited).toBe(false);
      vi.unstubAllEnvs();
    });
  });

  describe("rateLimitConfigs", () => {
    it("has vibeChat config with correct values", () => {
      expect(rateLimitConfigs.vibeChat).toEqual({
        maxRequests: 10,
        windowMs: 60000,
      });
    });
  });
});
