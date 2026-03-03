/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Suppress fetch calls from flushErrors
const mockFetch = vi.hoisted(() => vi.fn(() => Promise.resolve({ ok: true })));
vi.stubGlobal("fetch", mockFetch);

import {
  _resetForTesting,
  initializeConsoleCapture,
  reportErrorBoundary,
} from "./console-capture.client";

function getLastFetchBody(): {
  errors: Array<
    {
      message: string;
      errorType?: string;
      environment?: string;
      metadata?: Record<string, unknown>;
    }
  >;
} {
  const lastCall = mockFetch.mock.lastCall;
  expect(lastCall).toBeDefined();
  const body = (lastCall as unknown as [string, { body: string; }])[1].body;
  return JSON.parse(body) as ReturnType<typeof getLastFetchBody>;
}

describe("Client Console Capture → ErrorLog pipeline", () => {
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

  it("queues errors for batched sending when console.error is called", () => {
    initializeConsoleCapture();

    console.error("client error message");

    // The error is queued and will be flushed after BATCH_DELAY_MS or MAX_BATCH_SIZE
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("flushes errors when batch size is reached", () => {
    initializeConsoleCapture();

    // Queue MAX_BATCH_SIZE (10) errors to trigger flush
    for (let i = 0; i < 10; i++) {
      console.error(`error ${i}`);
    }

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/errors/report",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("captures Error objects with stack traces", () => {
    initializeConsoleCapture();

    const err = new TypeError("type mismatch");
    console.error(err);
    for (let i = 0; i < 9; i++) {
      console.error(`filler error ${i}`);
    }

    expect(mockFetch).toHaveBeenCalled();
    const body = getLastFetchBody();
    const firstError = body.errors[0];
    expect(firstError).toBeDefined();
    expect(firstError?.message).toBe("type mismatch");
    expect(firstError?.errorType).toBe("TypeError");
    expect(firstError?.environment).toBe("FRONTEND");
  });

  it("reportErrorBoundary queues error for reporting", () => {
    const testError = new Error("boundary error");

    reportErrorBoundary(testError, "<SomeComponent>");

    // Fill batch to trigger flush
    initializeConsoleCapture();
    for (let i = 0; i < 9; i++) {
      console.error(`filler ${i}`);
    }

    expect(mockFetch).toHaveBeenCalled();
    const body = getLastFetchBody();
    const boundaryError = body.errors.find(
      e => e.message === "boundary error",
    );
    expect(boundaryError).toBeDefined();
    expect(boundaryError?.metadata).toEqual(
      expect.objectContaining({
        source: "error-boundary",
        componentStack: "<SomeComponent>",
      }),
    );
  });

  it("deduplicates errors within the dedup window", () => {
    initializeConsoleCapture();

    console.error("duplicate error");
    console.error("duplicate error");

    // Fill to flush (need 9 unique to reach MAX_BATCH_SIZE=10 with 1 deduped)
    for (let i = 0; i < 9; i++) {
      console.error(`unique error ${i}`);
    }

    expect(mockFetch).toHaveBeenCalled();
    const body = getLastFetchBody();
    const dupes = body.errors.filter(
      e => e.message === "duplicate error",
    );
    expect(dupes).toHaveLength(1);
  });
});
