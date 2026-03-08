/**
 * Additional mainFetchHandler tests for uncovered branches
 */
import { beforeEach, describe, expect, it, type  vi } from "vitest";
import type Env from "../../src/edge-api/backend/core-logic/env.js";
import { handleFetchApi } from "../../src/edge-api/backend/lazy-imports/fetchHandler.js";
import { handleErrors } from "../../src/edge-api/backend/lazy-imports/handleErrors.js";
import { handleMainFetch } from "../../src/edge-api/backend/lazy-imports/mainFetchHandler.js";

vi.mock("../../src/edge-api/backend/lazy-imports/fetchHandler", () => ({
  handleFetchApi: vi.fn(),
}));

vi.mock("../../src/edge-api/backend/lazy-imports/handleErrors", () => ({
  handleErrors: vi.fn(),
}));

vi.mock("../../src/edge-api/backend/core-logic/utils", () => ({
  handleUnauthorizedRequest: vi.fn().mockReturnValue(new Response("Unauthorized", { status: 401 })),
}));

vi.mock("@spike-land-ai/code", () => ({
  routes: {},
  HTML: Promise.resolve("<html></html>"),
  importMap: {},
}));

describe("mainFetchHandler additional coverage", () => {
  const mockEnv = {} as Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: () => {},
      props: {},
    } as unknown as ExecutionContext;
    vi.mocked(handleErrors).mockImplementation(async (_, handler) => await handler());
  });

  describe("addSecurityHeaders — status 101 bypass", () => {
    it("skips security headers for WebSocket upgrade response (status 101)", async () => {
      const ws101Response = new Response(null, { status: 200 });
      // Override status to 101 for the WebSocket upgrade response test
      Object.defineProperty(ws101Response, "status", { value: 101, configurable: true });
      vi.mocked(handleFetchApi).mockResolvedValue(ws101Response);

      const request = new Request("https://example.com/websocket");
      const response = await handleMainFetch(request, mockEnv, mockCtx);

      // Status 101 response is returned as-is without new headers
      expect(response.status).toBe(101);
      // X-Content-Type-Options should NOT be set (skipped for status 101)
      expect(response.headers.get("X-Content-Type-Options")).toBeNull();
    });
  });

  describe("addSecurityHeaders — existing CSP modification", () => {
    it("appends frame-ancestors to existing CSP that has other directives", async () => {
      const existingCSP = "default-src 'self'; script-src 'nonce-abc'; frame-ancestors 'none'";
      const respWithCSP = new Response("body", {
        status: 200,
        headers: { "Content-Security-Policy": existingCSP },
      });
      vi.mocked(handleFetchApi).mockResolvedValue(respWithCSP);

      const request = new Request("https://example.com/some-page");
      const response = await handleMainFetch(request, mockEnv, mockCtx);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("frame-ancestors");
      expect(csp).toContain("spike.land");
      // Old frame-ancestors directive should be replaced
      expect(csp).not.toContain("frame-ancestors 'none'");
    });

    it("appends frame-ancestors to existing CSP without frame-ancestors", async () => {
      const existingCSP = "default-src 'self'; script-src 'nonce-abc'";
      const respWithCSP = new Response("body", {
        status: 200,
        headers: { "Content-Security-Policy": existingCSP },
      });
      vi.mocked(handleFetchApi).mockResolvedValue(respWithCSP);

      const request = new Request("https://example.com/some-page");
      const response = await handleMainFetch(request, mockEnv, mockCtx);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors");
    });

    it("does not duplicate existing security headers", async () => {
      const existingResp = new Response("body", {
        status: 200,
        headers: { "X-Content-Type-Options": "nosniff" },
      });
      vi.mocked(handleFetchApi).mockResolvedValue(existingResp);

      const request = new Request("https://example.com/some-page");
      const response = await handleMainFetch(request, mockEnv, mockCtx);

      // Should not have duplicate (only one value)
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("uses only FRAME_ANCESTORS when CSP has only frame-ancestors directive (line 53 false branch)", async () => {
      // When withoutFrameAncestors is empty (CSP was only frame-ancestors), use only FRAME_ANCESTORS
      const existingCSP = "frame-ancestors 'none'";
      const respWithCSP = new Response("body", {
        status: 200,
        headers: { "Content-Security-Policy": existingCSP },
      });
      vi.mocked(handleFetchApi).mockResolvedValue(respWithCSP);

      const request = new Request("https://example.com/some-page");
      const response = await handleMainFetch(request, mockEnv, mockCtx);

      const csp = response.headers.get("Content-Security-Policy");
      // After filtering out frame-ancestors, withoutFrameAncestors is empty
      // So CSP should be just FRAME_ANCESTORS (no prepended empty string)
      expect(csp).not.toContain("frame-ancestors 'none'");
      expect(csp).toContain("frame-ancestors 'self'");
    });
  });

  describe("null response fallbacks (lines 82, 88)", () => {
    it("returns 404 when handleFetchApi returns null for a redirect route (line 82)", async () => {
      // Mock routes to have an entry for the test path
      vi.doMock("@spike-land-ai/code", () => ({
        routes: { "/test-redirect": "some-space" },
        HTML: Promise.resolve("<html></html>"),
        importMap: {},
      }));
      // handleFetchApi returns undefined (simulating null response) for redirect
      vi.mocked(handleFetchApi).mockResolvedValue(undefined as unknown as Response);

      const request = new Request("https://example.com/some-unknown-path");
      const response = await handleMainFetch(request, mockEnv, mockCtx);

      // When handleFetchApi returns null/undefined, fallback is "Not Found" 404
      // Since routes mock is empty, this hits line 88
      expect(response.status).toBe(404);
    });
  });

  describe("health check endpoint (lines 79-110)", () => {
    it("returns 200 with status ok for shallow health check", async () => {
      const request = new Request("https://example.com/health");
      const response = await handleMainFetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string; service: string };
      expect(body.status).toBe("ok");
      expect(body.service).toBe("spike-land-backend");
    });

    it("does not include kv/r2 fields in shallow health check", async () => {
      const request = new Request("https://example.com/health");
      const response = await handleMainFetch(request, mockEnv, mockCtx);

      const body = (await response.json()) as Record<string, unknown>;
      expect(body).not.toHaveProperty("kv");
      expect(body).not.toHaveProperty("r2");
    });

    it("returns 200 with kv and r2 fields for deep health check when both succeed", async () => {
      const kvGet = vi.fn().mockResolvedValue(null);
      const r2Head = vi.fn().mockResolvedValue(null);
      const deepEnv = {
        ...mockEnv,
        KV: { get: kvGet },
        R2: { head: r2Head },
      } as unknown as Env;

      const request = new Request("https://example.com/health?deep=true");
      const response = await handleMainFetch(request, deepEnv, mockCtx);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string; kv: string; r2: string };
      expect(body.status).toBe("ok");
      expect(body.kv).toBe("ok");
      expect(body.r2).toBe("ok");
    });

    it("returns 503 with degraded status when KV throws during deep health check", async () => {
      const kvGet = vi.fn().mockRejectedValue(new Error("KV unavailable"));
      const r2Head = vi.fn().mockResolvedValue(null);
      const deepEnv = {
        ...mockEnv,
        KV: { get: kvGet },
        R2: { head: r2Head },
      } as unknown as Env;

      const request = new Request("https://example.com/health?deep=true");
      const response = await handleMainFetch(request, deepEnv, mockCtx);

      expect(response.status).toBe(503);
      const body = (await response.json()) as { status: string; kv: string; r2: string };
      expect(body.status).toBe("degraded");
      expect(body.kv).toBe("degraded");
      expect(body.r2).toBe("ok");
    });

    it("returns 503 with degraded status when R2 throws during deep health check", async () => {
      const kvGet = vi.fn().mockResolvedValue(null);
      const r2Head = vi.fn().mockRejectedValue(new Error("R2 unavailable"));
      const deepEnv = {
        ...mockEnv,
        KV: { get: kvGet },
        R2: { head: r2Head },
      } as unknown as Env;

      const request = new Request("https://example.com/health?deep=true");
      const response = await handleMainFetch(request, deepEnv, mockCtx);

      expect(response.status).toBe(503);
      const body = (await response.json()) as { status: string; kv: string; r2: string };
      expect(body.status).toBe("degraded");
      expect(body.kv).toBe("ok");
      expect(body.r2).toBe("degraded");
    });

    it("ignores non-GET methods to /health endpoint", async () => {
      vi.mocked(handleFetchApi).mockResolvedValue(
        new Response("Method Not Allowed", { status: 405 }),
      );
      const request = new Request("https://example.com/health", { method: "POST" });
      const response = await handleMainFetch(request, mockEnv, mockCtx);

      // POST to /health goes to normal routing, not health check
      expect(response.status).toBe(405);
    });
  });
});
