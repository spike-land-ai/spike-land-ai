import { describe, expect, it, vi } from "vitest";
import {
  isRetryableError,
  withRetry,
} from "../../../../src/cli/spike-cli/core-logic/chat/retry.js";

describe("isRetryableError", () => {
  it("returns true for 429 errors", () => {
    expect(isRetryableError(new Error("429 Too Many Requests"))).toBe(true);
  });

  it("returns true for 500 errors", () => {
    expect(isRetryableError(new Error("500 Internal Server Error"))).toBe(true);
  });

  it("returns true for 529 overloaded", () => {
    expect(isRetryableError(new Error("529 API overloaded"))).toBe(true);
  });

  it("returns true for rate limit errors", () => {
    expect(isRetryableError(new Error("Rate limit exceeded"))).toBe(true);
  });

  it("returns true for timeout errors", () => {
    expect(isRetryableError(new Error("Request timeout"))).toBe(true);
  });

  it("returns false for non-Error values", () => {
    expect(isRetryableError("string error")).toBe(false);
  });

  it("returns false for non-retryable errors", () => {
    expect(isRetryableError(new Error("Invalid API key"))).toBe(false);
  });

  it("checks status property on error objects", () => {
    const err = new Error("API error");
    (err as unknown as Record<string, unknown>).status = 429;
    expect(isRetryableError(err)).toBe(true);
  });

  it("returns true for ECONNRESET", () => {
    expect(isRetryableError(new Error("read ECONNRESET"))).toBe(true);
  });

  it("returns true for overloaded message", () => {
    expect(isRetryableError(new Error("API is overloaded"))).toBe(true);
  });
});

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("result");
    const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 10 });
    expect(result).toBe("result");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable errors", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("429 Too Many Requests"))
      .mockResolvedValueOnce("success");

    const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 10 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws immediately for non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Invalid API key"));
    await expect(withRetry(fn, { maxRetries: 3, initialDelayMs: 10 })).rejects.toThrow(
      "Invalid API key",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("429 rate limited"));
    await expect(withRetry(fn, { maxRetries: 2, initialDelayMs: 10 })).rejects.toThrow(
      "429 rate limited",
    );
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("uses exponential backoff", async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn, delay) => {
      delays.push(delay as number);
      return originalSetTimeout(fn as TimerHandler, 0);
    });

    const fnMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("429"))
      .mockRejectedValueOnce(new Error("429"))
      .mockResolvedValue("ok");

    await withRetry(fnMock, { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 5000 });

    // Should have 2 delays (2 retries before success)
    expect(delays.length).toBeGreaterThanOrEqual(2);
    // Second delay should be larger than first (exponential)
    expect(delays[1]).toBeGreaterThan(delays[0] ?? 0);

    vi.restoreAllMocks();
  });
});
