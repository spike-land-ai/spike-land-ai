import { describe, expect, it, vi } from "vitest";

// Hoist mock factories to avoid initialization issues
const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
}));

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

import { checkGenerationRateLimit } from "./rate-limit-presets";

describe("checkGenerationRateLimit", () => {
  beforeEach(() => {
    mockCheckRateLimit.mockReset();
  });

  describe("when request is allowed", () => {
    beforeEach(() => {
      mockCheckRateLimit.mockResolvedValue({ isLimited: false, resetAt: 0 });
    });

    it("returns allowed=true for anonymous request", async () => {
      const result = await checkGenerationRateLimit("1.2.3.4", false);
      expect(result).toEqual({ allowed: true });
    });

    it("returns allowed=true for authenticated request", async () => {
      const result = await checkGenerationRateLimit("1.2.3.4", true);
      expect(result).toEqual({ allowed: true });
    });

    it("does not include retryAfterSeconds when allowed", async () => {
      const result = await checkGenerationRateLimit("10.0.0.1", false);
      expect(result.retryAfterSeconds).toBeUndefined();
    });
  });

  describe("anonymous rate limit config", () => {
    it("uses identifier with 'anon' prefix for unauthenticated requests", async () => {
      mockCheckRateLimit.mockResolvedValue({ isLimited: false, resetAt: 0 });
      await checkGenerationRateLimit("5.5.5.5", false);
      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "generation:anon:5.5.5.5",
        expect.objectContaining({ maxRequests: 5 }),
      );
    });

    it("uses maxRequests=5 and windowMs=3600000 for anonymous", async () => {
      mockCheckRateLimit.mockResolvedValue({ isLimited: false, resetAt: 0 });
      await checkGenerationRateLimit("1.1.1.1", false);
      expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.any(String), {
        maxRequests: 5,
        windowMs: 3_600_000,
      });
    });
  });

  describe("authenticated rate limit config", () => {
    it("uses identifier with 'auth' prefix for authenticated requests", async () => {
      mockCheckRateLimit.mockResolvedValue({ isLimited: false, resetAt: 0 });
      await checkGenerationRateLimit("5.5.5.5", true);
      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "generation:auth:5.5.5.5",
        expect.objectContaining({ maxRequests: 20 }),
      );
    });

    it("uses maxRequests=20 and windowMs=3600000 for authenticated", async () => {
      mockCheckRateLimit.mockResolvedValue({ isLimited: false, resetAt: 0 });
      await checkGenerationRateLimit("2.2.2.2", true);
      expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.any(String), {
        maxRequests: 20,
        windowMs: 3_600_000,
      });
    });
  });

  describe("when rate limit is exceeded", () => {
    it("returns allowed=false with retryAfterSeconds for anonymous", async () => {
      const resetAt = Date.now() + 30_000; // 30 seconds from now
      mockCheckRateLimit.mockResolvedValue({ isLimited: true, resetAt });
      const result = await checkGenerationRateLimit("3.3.3.3", false);
      expect(result.allowed).toBe(false);
      expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(29);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(31);
    });

    it("returns allowed=false with retryAfterSeconds for authenticated", async () => {
      const resetAt = Date.now() + 60_000; // 60 seconds from now
      mockCheckRateLimit.mockResolvedValue({ isLimited: true, resetAt });
      const result = await checkGenerationRateLimit("4.4.4.4", true);
      expect(result.allowed).toBe(false);
      expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(59);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(61);
    });

    it("returns minimum retryAfterSeconds of 1 when reset is in the past", async () => {
      const resetAt = Date.now() - 5_000; // Already past
      mockCheckRateLimit.mockResolvedValue({ isLimited: true, resetAt });
      const result = await checkGenerationRateLimit("6.6.6.6", false);
      expect(result.allowed).toBe(false);
      expect(result.retryAfterSeconds).toBe(1);
    });
  });

  describe("IP address is forwarded correctly", () => {
    it("includes the exact IP in the identifier", async () => {
      mockCheckRateLimit.mockResolvedValue({ isLimited: false, resetAt: 0 });
      await checkGenerationRateLimit("192.168.0.100", false);
      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.stringContaining("192.168.0.100"),
        expect.any(Object),
      );
    });
  });
});
