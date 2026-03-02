import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "./rate-limit";
import { createMockKV } from "../__test-utils__/mock-env";

describe("checkRateLimit", () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it("allows first request", async () => {
    const result = await checkRateLimit("test-key", kv);

    expect(result.isLimited).toBe(false);
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("allows requests up to the limit", async () => {
    const maxRequests = 5;
    const windowMs = 60_000;

    for (let i = 0; i < maxRequests; i++) {
      const result = await checkRateLimit("test-key", kv, maxRequests, windowMs);
      expect(result.isLimited).toBe(false);
      expect(result.remaining).toBe(maxRequests - (i + 1));
    }
  });

  it("blocks requests beyond the limit", async () => {
    const maxRequests = 3;
    const windowMs = 60_000;

    // Use up all allowed requests
    for (let i = 0; i < maxRequests; i++) {
      await checkRateLimit("test-key", kv, maxRequests, windowMs);
    }

    // Next request should be limited
    const result = await checkRateLimit("test-key", kv, maxRequests, windowMs);
    expect(result.isLimited).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("tracks different keys independently", async () => {
    const maxRequests = 2;
    const windowMs = 60_000;

    // Exhaust key-a
    for (let i = 0; i < maxRequests; i++) {
      await checkRateLimit("key-a", kv, maxRequests, windowMs);
    }
    const limitedA = await checkRateLimit("key-a", kv, maxRequests, windowMs);
    expect(limitedA.isLimited).toBe(true);

    // key-b should still be fine
    const resultB = await checkRateLimit("key-b", kv, maxRequests, windowMs);
    expect(resultB.isLimited).toBe(false);
  });

  it("resets after window expires", async () => {
    const maxRequests = 2;
    const windowMs = 100; // 100ms window for fast test

    // Use up all requests
    for (let i = 0; i < maxRequests; i++) {
      await checkRateLimit("test-key", kv, maxRequests, windowMs);
    }

    // Should be limited
    const limited = await checkRateLimit("test-key", kv, maxRequests, windowMs);
    expect(limited.isLimited).toBe(true);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should be allowed again (window expired, counter resets)
    const result = await checkRateLimit("test-key", kv, maxRequests, windowMs);
    expect(result.isLimited).toBe(false);
  });

  it("returns correct resetAt timestamp", async () => {
    const windowMs = 60_000;
    const before = Date.now();
    const result = await checkRateLimit("test-key", kv, 120, windowMs);
    const after = Date.now();

    // resetAt should be approximately now + windowMs
    expect(result.resetAt).toBeGreaterThanOrEqual(before + windowMs);
    expect(result.resetAt).toBeLessThanOrEqual(after + windowMs);
  });
});
