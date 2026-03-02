import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock logger
vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { trackServerEvent } from "./google-analytics";

describe("tracking/google-analytics", () => {
  const originalEnv = process.env;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    global.fetch = mockFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should skip tracking when GA env vars are missing", async () => {
    delete process.env.GA_MEASUREMENT_ID;
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    delete process.env.GA_API_SECRET;

    await trackServerEvent("client-1", "user-1", "test_event");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should skip tracking when only measurement ID is set", async () => {
    process.env.GA_MEASUREMENT_ID = "G-TEST123";
    delete process.env.GA_API_SECRET;

    await trackServerEvent("client-1", "user-1", "test_event");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should send event when both env vars are set", async () => {
    process.env.GA_MEASUREMENT_ID = "G-TEST123";
    process.env.GA_API_SECRET = "secret_123";
    mockFetch.mockResolvedValue({ ok: true });

    await trackServerEvent("client-1", "user-1", "test_event", {
      key: "value",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("G-TEST123");
    expect(url).toContain("secret_123");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.client_id).toBe("client-1");
    expect(body.user_id).toBe("user-1");
    expect(body.events).toEqual([{ name: "test_event", params: { key: "value" } }]);
  });

  it("should use NEXT_PUBLIC_GA_MEASUREMENT_ID as fallback", async () => {
    delete process.env.GA_MEASUREMENT_ID;
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-PUBLIC";
    process.env.GA_API_SECRET = "secret_123";
    mockFetch.mockResolvedValue({ ok: true });

    await trackServerEvent("client-1", undefined, "test_event");

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("G-PUBLIC");
  });

  it("should omit user_id when undefined", async () => {
    process.env.GA_MEASUREMENT_ID = "G-TEST";
    process.env.GA_API_SECRET = "secret";
    mockFetch.mockResolvedValue({ ok: true });

    await trackServerEvent("client-1", undefined, "test_event");

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Record<string, unknown>;
    expect(body).not.toHaveProperty("user_id");
  });

  it("should filter out null and undefined params", async () => {
    process.env.GA_MEASUREMENT_ID = "G-TEST";
    process.env.GA_API_SECRET = "secret";
    mockFetch.mockResolvedValue({ ok: true });

    await trackServerEvent("client-1", "user-1", "test_event", {
      valid: "yes",
      nullVal: null,
      undefinedVal: undefined,
      num: 42,
      bool: true,
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as { events: Array<{ params: Record<string, unknown> }> };
    const params = body.events[0]!.params;
    expect(params).toEqual({ valid: "yes", num: 42, bool: true });
    expect(params).not.toHaveProperty("nullVal");
    expect(params).not.toHaveProperty("undefinedVal");
  });

  it("should truncate long string params to 500 chars", async () => {
    process.env.GA_MEASUREMENT_ID = "G-TEST";
    process.env.GA_API_SECRET = "secret";
    mockFetch.mockResolvedValue({ ok: true });

    const longString = "x".repeat(600);
    await trackServerEvent("client-1", "user-1", "test_event", {
      long: longString,
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as { events: Array<{ params: Record<string, string> }> };
    const paramValue = body.events[0]!.params.long!;
    expect(paramValue.length).toBe(503); // 500 + "..."
    expect(paramValue).toMatch(/^x{500}\.\.\.$/);
  });

  it("should handle fetch errors gracefully", async () => {
    process.env.GA_MEASUREMENT_ID = "G-TEST";
    process.env.GA_API_SECRET = "secret";
    mockFetch.mockRejectedValue(new Error("Network error"));

    const logger = (await import("@/lib/logger")).default;

    // Should not throw
    await trackServerEvent("client-1", "user-1", "test_event");

    expect(logger.error).toHaveBeenCalledWith(
      "Error sending GA event",
      expect.objectContaining({ eventName: "test_event" }),
    );
  });

  it("should log error on non-ok response", async () => {
    process.env.GA_MEASUREMENT_ID = "G-TEST";
    process.env.GA_API_SECRET = "secret";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve("Forbidden"),
    });

    const logger = (await import("@/lib/logger")).default;

    await trackServerEvent("client-1", "user-1", "test_event");

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to send GA event",
      expect.objectContaining({ status: 403 }),
    );
  });

  it("should log debug message in development when env vars missing", async () => {
    delete process.env.GA_MEASUREMENT_ID;
    delete process.env.GA_API_SECRET;
    vi.stubEnv("NODE_ENV", "development");

    const logger = (await import("@/lib/logger")).default;

    await trackServerEvent("client-1", "user-1", "test_event");

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("GA_MEASUREMENT_ID"),
      expect.objectContaining({ eventName: "test_event" }),
    );
  });
});
