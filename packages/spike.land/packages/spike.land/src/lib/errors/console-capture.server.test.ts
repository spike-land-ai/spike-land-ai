import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Suppress fetch calls from flushErrors
const mockFetch = vi.hoisted(() => vi.fn(() => Promise.resolve({ ok: true })));
vi.stubGlobal("fetch", mockFetch);

import {
  _resetForTesting,
  initializeServerConsoleCapture,
} from "./console-capture.server";

function getLastFetchBody(): {
  errors: Array<{ message: string; errorType?: string; environment?: string; }>;
} {
  const lastCall = mockFetch.mock.lastCall;
  expect(lastCall).toBeDefined();
  const body = (lastCall as unknown as [string, { body: string; }])[1].body;
  return JSON.parse(body) as ReturnType<typeof getLastFetchBody>;
}

describe("Server Console Capture → ErrorLog pipeline", () => {
  let originalError: typeof console.error;

  beforeEach(() => {
    _resetForTesting();
    originalError = console.error;
    mockFetch.mockClear();
  });

  afterEach(() => {
    _resetForTesting();
    console.error = originalError;
  });

  it("queues Error objects for batched reporting", () => {
    initializeServerConsoleCapture();

    const testError = new Error("test server error");
    console.error(testError);

    // Error is queued, not immediately sent
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("flushes errors when batch size is reached", () => {
    initializeServerConsoleCapture();

    for (let i = 0; i < 10; i++) {
      console.error(`server error ${i}`);
    }

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/errors/report"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("captures string messages with BACKEND environment", () => {
    initializeServerConsoleCapture();

    console.error("something went wrong");
    for (let i = 0; i < 9; i++) {
      console.error(`filler ${i}`);
    }

    expect(mockFetch).toHaveBeenCalled();
    const body = getLastFetchBody();
    const firstError = body.errors[0];
    expect(firstError).toBeDefined();
    expect(firstError?.message).toBe("something went wrong");
    expect(firstError?.environment).toBe("BACKEND");
    expect(firstError?.errorType).toBe("ConsoleError");
  });

  it("deduplicates and does not queue the same error twice", () => {
    initializeServerConsoleCapture();

    const testError = new Error("duplicate error");
    console.error(testError);
    console.error(testError);

    // Fill to flush (need 9 unique to reach MAX_BATCH_SIZE=10 with 1 deduped)
    for (let i = 0; i < 9; i++) {
      console.error(`unique ${i}`);
    }

    expect(mockFetch).toHaveBeenCalled();
    const body = getLastFetchBody();
    const dupes = body.errors.filter(
      e => e.message === "duplicate error",
    );
    expect(dupes).toHaveLength(1);
  });
});
