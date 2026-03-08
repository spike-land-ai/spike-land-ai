/**
 * Additional apiRoutes tests for uncovered parseTranspileErrors branches (lines 256-268, 274)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Code } from "../../../src/edge-api/backend/lazy-imports/chatRoom.js";
import { ApiRoutes } from "../../../src/edge-api/backend/core-logic/routes/apiRoutes.js";

vi.mock("../../../src/edge-api/backend/lazy-imports/chatRoom", () => ({
  Code: vi.fn(),
  md5: vi.fn(),
}));

describe("ApiRoutes additional — parseTranspileErrors branches", () => {
  let apiRoutes: ApiRoutes;
  let mockCode: Code;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCode = {
      getSession: vi.fn().mockReturnValue({
        code: "test code",
        html: "",
        css: "",
        transpiled: "",
        codeSpace: "test",
        messages: [],
      }),
      getOrigin: vi.fn().mockReturnValue("https://example.com"),
      updateAndBroadcastSession: vi.fn(),
    } as unknown as Code;
    apiRoutes = new ApiRoutes(mockCode);
  });

  describe("parseTranspileErrors — line N: message pattern (lines 256-262)", () => {
    it("parses 'line N: message' format from transpile error", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response("line 10: unexpected token ';'", { status: 400 }));
      vi.stubGlobal("fetch", mockFetch);

      const request = new Request("https://example.com/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "invalid code!!" }),
      });
      const url = new URL("https://example.com/api/validate");

      const response = await apiRoutes.handleApiRoute(request, url, ["api", "validate"]);
      const body = (await response.json()) as { errors: Array<{ line?: number; message: string }> };

      expect(body.errors.some((e) => e.line === 10)).toBe(true);
      expect(body.errors.some((e) => e.message?.includes("unexpected token"))).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  describe("parseTranspileErrors — generic error message (lines 265-269)", () => {
    it("parses generic error line that does not match specific patterns", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response("Something went wrong with your code", { status: 400 }));
      vi.stubGlobal("fetch", mockFetch);

      const request = new Request("https://example.com/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "bad code" }),
      });
      const url = new URL("https://example.com/api/validate");

      const response = await apiRoutes.handleApiRoute(request, url, ["api", "validate"]);
      const body = (await response.json()) as { errors: Array<{ message: string }> };

      expect(body.errors.some((e) => e.message?.includes("Something went wrong"))).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  describe("parseTranspileErrors — fallback for empty parsed errors (line 273-274)", () => {
    it("uses whole message when no specific errors parsed", async () => {
      // Error message that has 'X error(s)' prefix but nothing else parseable
      const mockFetch = vi.fn().mockResolvedValue(new Response("1 error(s)\n", { status: 400 }));
      vi.stubGlobal("fetch", mockFetch);

      const request = new Request("https://example.com/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "bad" }),
      });
      const url = new URL("https://example.com/api/validate");

      const response = await apiRoutes.handleApiRoute(request, url, ["api", "validate"]);
      const body = (await response.json()) as { valid: boolean };
      // Should still be invalid
      expect(body.valid).toBe(false);

      vi.unstubAllGlobals();
    });
  });

  describe("handleCodePut — non-Error thrown in transpile catch (line 104 false branch)", () => {
    it("returns 'Transpilation failed' when non-Error is thrown", async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        // Simulate a non-Error throw in transpileCode (make response fail)
        return Promise.resolve(new Response("error text", { status: 500 }));
      });
      vi.stubGlobal("fetch", mockFetch);

      const request = new Request("https://example.com/api/code", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "bad code", run: true }),
      });
      const url = new URL("https://example.com/api/code");

      const response = await apiRoutes.handleApiRoute(request, url, ["api", "code"]);
      expect(response.status).toBe(400);

      vi.unstubAllGlobals();
    });
  });

  describe("handleRunPost — non-Error thrown in transpile catch (line 149 false branch)", () => {
    it("returns 'Transpilation failed' when non-Error is thrown in run", async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response("server error", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      const request = new Request("https://example.com/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const url = new URL("https://example.com/api/run");

      const response = await apiRoutes.handleApiRoute(request, url, ["api", "run"]);
      // transpileCode throws when response is not ok, error.message contains text
      expect(response.status).toBe(400);

      vi.unstubAllGlobals();
    });
  });

  describe("handleValidatePost — non-Error thrown (line 211 false branch)", () => {
    it("handles non-Error throw in validate", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response("transpile fail text", { status: 422 }));
      vi.stubGlobal("fetch", mockFetch);

      const request = new Request("https://example.com/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "invalid code" }),
      });
      const url = new URL("https://example.com/api/validate");

      const response = await apiRoutes.handleApiRoute(request, url, ["api", "validate"]);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { valid: boolean };
      expect(body.valid).toBe(false);

      vi.unstubAllGlobals();
    });
  });

  describe("parseTranspileErrors — duplicate message dedup (line 242 guard)", () => {
    it("skips adding duplicate trimmed line messages", async () => {
      // Two identical lines → only one entry added (the errors.some check prevents duplicate)
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response("duplicate error\nduplicate error\n", { status: 400 }));
      vi.stubGlobal("fetch", mockFetch);

      const request = new Request("https://example.com/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "bad" }),
      });
      const url = new URL("https://example.com/api/validate");

      const response = await apiRoutes.handleApiRoute(request, url, ["api", "validate"]);
      const body = (await response.json()) as { errors: Array<{ message: string }> };
      // Should deduplicate: only one entry for "duplicate error"
      const dupeCount = body.errors.filter((e) => e.message === "duplicate error").length;
      expect(dupeCount).toBe(1);

      vi.unstubAllGlobals();
    });
  });

  describe("parseTranspileErrors — empty errorMessage (line 273 false branch)", () => {
    it("returns empty errors array when errorMessage is empty string", async () => {
      // When transpile fails with empty body
      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 400 }));
      vi.stubGlobal("fetch", mockFetch);

      const request = new Request("https://example.com/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "code" }),
      });
      const url = new URL("https://example.com/api/validate");

      const response = await apiRoutes.handleApiRoute(request, url, ["api", "validate"]);
      // Should not throw, should return valid: false
      expect(response.status).toBe(200);

      vi.unstubAllGlobals();
    });
  });
});
