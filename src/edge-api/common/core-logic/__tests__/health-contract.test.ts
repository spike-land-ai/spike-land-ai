import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildStandardHealthResponse,
  getHealthHttpStatus,
  timedCheck,
  timedFetchCheck,
} from "../health-contract";

describe("health-contract", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("buildStandardHealthResponse", () => {
    it("returns ok when no checks are provided", () => {
      const res = buildStandardHealthResponse({
        service: "test-svc",
        timestamp: "2026-03-13T00:00:00.000Z",
      });
      expect(res.status).toBe("ok");
      expect(res.service).toBe("test-svc");
      expect(res.timestamp).toBe("2026-03-13T00:00:00.000Z");
      expect(res.version).toMatch(/^(dev|[a-f0-9]+)$/);
      expect(res.uptime_ms).toBeGreaterThanOrEqual(0);
      expect(res.checks).toBeUndefined();
    });

    it("returns ok when all checks pass", () => {
      const res = buildStandardHealthResponse({
        service: "test-svc",
        checks: {
          db: { status: "ok", latency_ms: 5 },
          cache: { status: "ok", latency_ms: 2 },
        },
      });
      expect(res.status).toBe("ok");
      expect(res.checks).toEqual({
        db: { status: "ok", latency_ms: 5 },
        cache: { status: "ok", latency_ms: 2 },
      });
    });

    it("returns degraded when any check is degraded", () => {
      const res = buildStandardHealthResponse({
        service: "test-svc",
        checks: {
          db: { status: "ok", latency_ms: 5 },
          cache: { status: "degraded", latency_ms: 100, detail: "timeout" },
        },
      });
      expect(res.status).toBe("degraded");
    });

    it("omits checks when the record is empty", () => {
      const res = buildStandardHealthResponse({
        service: "test-svc",
        checks: {},
      });
      expect(res.checks).toBeUndefined();
    });

    it("uses provided version", () => {
      const res = buildStandardHealthResponse({
        service: "test-svc",
        version: "abc123",
      });
      expect(res.version).toBe("abc123");
    });
  });

  describe("timedCheck", () => {
    it("returns ok with latency on success", async () => {
      const result = await timedCheck(async () => {});
      expect(result.status).toBe("ok");
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it("returns degraded with error detail on failure", async () => {
      const result = await timedCheck(async () => {
        throw new Error("db gone");
      });
      expect(result.status).toBe("degraded");
      expect(result.detail).toBe("db gone");
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it("includes optional detail on success", async () => {
      const result = await timedCheck(async () => {}, "ping");
      expect(result.detail).toBe("ping");
    });
  });

  describe("timedFetchCheck", () => {
    it("returns ok for a 200 response", async () => {
      const binding = {
        fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
      };
      const result = await timedFetchCheck(binding);
      expect(result.status).toBe("ok");
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it("returns degraded for a non-ok response", async () => {
      const binding = {
        fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 503 })),
      };
      const result = await timedFetchCheck(binding);
      expect(result.status).toBe("degraded");
      expect(result.detail).toBe("HTTP 503");
    });

    it("returns degraded on fetch error", async () => {
      const binding = {
        fetch: vi.fn().mockRejectedValue(new Error("connection refused")),
      };
      const result = await timedFetchCheck(binding);
      expect(result.status).toBe("degraded");
      expect(result.detail).toBe("connection refused");
    });
  });

  describe("getHealthHttpStatus", () => {
    it("returns 200 for ok, 503 for degraded", () => {
      expect(getHealthHttpStatus({ status: "ok" })).toBe(200);
      expect(getHealthHttpStatus({ status: "degraded" })).toBe(503);
    });
  });
});
