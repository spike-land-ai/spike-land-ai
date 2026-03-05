import { describe, it, expect, vi, beforeEach } from "vitest";
import { createErrorReporter } from "../../../src/shared/utils/error-reporter";

describe("createErrorReporter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to console.error when no endpoint is provided", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reporter = createErrorReporter({ service: "test-service" });

    reporter.report({
      message: "something broke",
      severity: "error",
      source: "TEST_ERROR",
    });

    expect(spy).toHaveBeenCalledOnce();
    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.service_name).toBe("test-service");
    expect(logged.message).toBe("something broke");
    expect(logged.error_code).toBe("TEST_ERROR");
    expect(logged.severity).toBe("error");
    expect(logged.timestamp).toBeDefined();
  });

  it("falls back to console.error when no waitUntil is provided", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reporter = createErrorReporter({
      service: "test-service",
      endpoint: "https://example.com/errors/ingest",
    });

    reporter.report({
      message: "no waitUntil",
      severity: "warning",
      source: "MISSING_CTX",
    });

    expect(spy).toHaveBeenCalledOnce();
  });

  it("calls waitUntil with fetch when endpoint and waitUntil are provided", () => {
    const waitUntil = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

    const reporter = createErrorReporter({
      service: "backend",
      endpoint: "https://edge.example.com/errors/ingest",
      waitUntil,
    });

    reporter.report({
      message: "db timeout",
      stack: "Error: db timeout\n    at query (db.ts:42)",
      severity: "error",
      source: "DB_ERROR",
      metadata: { query: "SELECT 1" },
    });

    expect(waitUntil).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://edge.example.com/errors/ingest");
    expect(init?.method).toBe("POST");

    const body = JSON.parse(init?.body as string);
    expect(body).toHaveLength(1);
    expect(body[0].service_name).toBe("backend");
    expect(body[0].message).toBe("db timeout");
    expect(body[0].stack_trace).toContain("db.ts:42");
    expect(body[0].metadata).toEqual({ query: "SELECT 1" });
  });

  it("swallows fetch errors silently", async () => {
    const waitUntil = vi.fn();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const reporter = createErrorReporter({
      service: "backend",
      endpoint: "https://edge.example.com/errors/ingest",
      waitUntil,
    });

    reporter.report({
      message: "test",
      severity: "error",
      source: "TEST",
    });

    // The promise passed to waitUntil should resolve (not reject)
    const promise = waitUntil.mock.calls[0][0] as Promise<unknown>;
    await expect(promise).resolves.toBeUndefined();
  });

  it("reportException extracts message and stack from Error objects", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reporter = createErrorReporter({ service: "test-service" });

    const err = new Error("kaboom");
    reporter.reportException(err, { code: "BOOM", severity: "fatal" });

    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.message).toBe("kaboom");
    expect(logged.stack_trace).toContain("kaboom");
    expect(logged.error_code).toBe("BOOM");
    expect(logged.severity).toBe("fatal");
  });

  it("reportException handles non-Error values", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reporter = createErrorReporter({ service: "test-service" });

    reporter.reportException("string error");

    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.message).toBe("string error");
    expect(logged.stack_trace).toBeUndefined();
    expect(logged.error_code).toBe("UNHANDLED");
    expect(logged.severity).toBe("error");
  });
});
