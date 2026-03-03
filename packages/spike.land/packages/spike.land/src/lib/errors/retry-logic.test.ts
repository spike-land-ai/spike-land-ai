import { describe, expect, it, vi } from "vitest";
import {
  createRetryWrapper,
  retryBatch,
  retryWithBackoff,
} from "./retry-logic";

// Mock sleep to avoid real delays
vi.mock("@/lib/utils", () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

describe("retryWithBackoff", () => {
  it("should succeed on first attempt", async () => {
    const result = await retryWithBackoff(async () => "success");
    expect(result.success).toBe(true);
    expect(result.data).toBe("success");
    expect(result.attempts).toBe(1);
  });

  it("should retry on retryable error and eventually succeed", async () => {
    let attempt = 0;
    const result = await retryWithBackoff(
      async () => {
        attempt++;
        if (attempt < 3) throw new Error("network error");
        return "recovered";
      },
      { maxAttempts: 5 },
    );
    expect(result.success).toBe(true);
    expect(result.data).toBe("recovered");
    expect(result.attempts).toBe(3);
  });

  it("should fail after max attempts", async () => {
    const result = await retryWithBackoff(
      async () => {
        throw new Error("network error");
      },
      { maxAttempts: 2 },
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error!.message).toBe("network error");
    expect(result.attempts).toBe(2);
  });

  it("should not retry non-retryable errors by default", async () => {
    const result = await retryWithBackoff(
      async () => {
        throw new Error("validation failed");
      },
      { maxAttempts: 3 },
    );
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it("should use custom shouldRetry", async () => {
    let attempts = 0;
    const result = await retryWithBackoff(
      async () => {
        attempts++;
        throw new Error("custom error");
      },
      {
        maxAttempts: 5,
        shouldRetry: (_err, attempt) => attempt < 3,
      },
    );
    expect(result.success).toBe(false);
    expect(attempts).toBe(3);
  });

  it("should call onRetry callback", async () => {
    const onRetry = vi.fn();
    let attempt = 0;
    await retryWithBackoff(
      async () => {
        attempt++;
        if (attempt < 3) throw new Error("fetch failed");
        return "ok";
      },
      { maxAttempts: 5, onRetry },
    );
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ message: "fetch failed" }),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("should handle non-Error thrown values", async () => {
    const result = await retryWithBackoff(
      async () => {
        throw "string error";
      },
      {
        maxAttempts: 1,
        shouldRetry: () => true,
      },
    );
    expect(result.success).toBe(false);
    expect(result.error!.message).toBe("string error");
  });

  it("should respect default retryable errors", async () => {
    const retryableErrors = [
      "network error occurred",
      "timeout exceeded",
      "503 Service Unavailable",
      "502 Bad Gateway",
      "500 Internal Server Error",
      "fetch failed",
      "ECONNREFUSED",
    ];

    for (const errMsg of retryableErrors) {
      let attempts = 0;
      await retryWithBackoff(
        async () => {
          attempts++;
          if (attempts < 2) throw new Error(errMsg);
          return "ok";
        },
        { maxAttempts: 3 },
      );
      expect(attempts).toBeGreaterThan(1);
    }
  });
});

describe("createRetryWrapper", () => {
  it("should create a wrapper that retries the function", async () => {
    let calls = 0;
    const fn = async (value: string) => {
      calls++;
      if (calls < 2) throw new Error("fetch failed");
      return value.toUpperCase();
    };

    const wrappedFn = createRetryWrapper(fn, { maxAttempts: 3 });
    const result = await wrappedFn("hello");
    expect(result.success).toBe(true);
    expect(result.data).toBe("HELLO");
    expect(result.attempts).toBe(2);
  });

  it("should pass all arguments through", async () => {
    const fn = async (a: number, b: number) => a + b;
    const wrapped = createRetryWrapper(fn);
    const result = await wrapped(3, 4);
    expect(result.success).toBe(true);
    expect(result.data).toBe(7);
  });
});

describe("retryBatch", () => {
  it("should run all operations in parallel", async () => {
    const results = await retryBatch([
      async () => "a",
      async () => "b",
      async () => "c",
    ]);
    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);
    expect(results.map(r => r.data)).toEqual(["a", "b", "c"]);
  });

  it("should return individual failures", async () => {
    const results = await retryBatch([
      async () => "success",
      async () => {
        throw new Error("validation error");
      },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.success).toBe(true);
    expect(results[1]!.success).toBe(false);
  });
});
