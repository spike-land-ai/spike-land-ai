import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Code } from "../chatRoom";
import { ApiRoutes } from "./apiRoutes";

vi.mock("@spike-land-ai/code", () => ({
  computeSessionHash: vi.fn().mockReturnValue("mock-hash-abc123"),
  sanitizeSession: vi.fn().mockImplementation((session: unknown) => session),
}));

describe("ApiRoutes", () => {
  let apiRoutes: ApiRoutes;
  let mockCode: Code;
  let mockSession: {
    code: string;
    html: string;
    css: string;
    transpiled: string;
    codeSpace: string;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSession = {
      code: "const App = () => <div>Hello</div>;",
      html: "<div>Hello</div>",
      css: ".app { color: blue; }",
      transpiled: "const App = () => React.createElement('div', null, 'Hello');",
      codeSpace: "test-space",
    };

    mockCode = {
      getSession: vi.fn().mockReturnValue(mockSession),
      getOrigin: vi.fn().mockReturnValue("https://test.spike.land"),
      updateAndBroadcastSession: vi.fn().mockResolvedValue(undefined),
    } as unknown as Code;

    apiRoutes = new ApiRoutes(mockCode);
  });

  describe("handleApiRoute", () => {
    describe("action: code", () => {
      it("should handle GET /api/code and return session code", async () => {
        const request = new Request("https://example.com/api/code");
        const url = new URL("https://example.com/api/code");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "code"]);

        expect(response.status).toBe(200);
        const body = (await response.json()) as {
          success: boolean;
          code: string;
          codeSpace: string;
          hash: string;
        };
        expect(body.success).toBe(true);
        expect(body.code).toBe(mockSession.code);
        expect(body.codeSpace).toBe(mockSession.codeSpace);
        expect(body.hash).toBe("mock-hash-abc123");
      });

      it("should return 405 for DELETE /api/code", async () => {
        const request = new Request("https://example.com/api/code", {
          method: "DELETE",
        });
        const url = new URL("https://example.com/api/code");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "code"]);

        expect(response.status).toBe(405);
      });

      it("should handle PUT /api/code with valid JSON body", async () => {
        const mockFetch = vi
          .fn()
          .mockResolvedValue(new Response("transpiled code result", { status: 200 }));
        vi.stubGlobal("fetch", mockFetch);

        const request = new Request("https://example.com/api/code", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "const x = 1;" }),
        });
        const url = new URL("https://example.com/api/code");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "code"]);

        expect(response.status).toBe(200);
        const body = (await response.json()) as {
          success: boolean;
          message: string;
        };
        expect(body.success).toBe(true);
        expect(body.message).toContain("Transpilation delegated");

        vi.unstubAllGlobals();
      });

      it("should handle PUT /api/code with run:true flag", async () => {
        const mockFetch = vi
          .fn()
          .mockResolvedValue(new Response("transpiled output", { status: 200 }));
        vi.stubGlobal("fetch", mockFetch);

        const request = new Request("https://example.com/api/code", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "const x = 1;", run: true }),
        });
        const url = new URL("https://example.com/api/code");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "code"]);

        expect(response.status).toBe(200);
        const body = (await response.json()) as {
          success: boolean;
          message: string;
          updated: string[];
        };
        expect(body.success).toBe(true);
        expect(body.message).toContain("transpiled successfully");
        expect(body.updated).toContain("transpiled");

        vi.unstubAllGlobals();
      });

      it("should return 400 for PUT /api/code with invalid JSON", async () => {
        const request = new Request("https://example.com/api/code", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: "not valid json",
        });
        const url = new URL("https://example.com/api/code");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "code"]);

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error: string };
        expect(body.error).toBe("Invalid JSON body");
      });

      it("should return 400 for PUT /api/code with missing code field", async () => {
        const request = new Request("https://example.com/api/code", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run: true }),
        });
        const url = new URL("https://example.com/api/code");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "code"]);

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error: string };
        expect(body.error).toContain("code");
      });

      it("should return 400 when transpilation fails during PUT with run:true", async () => {
        const mockFetch = vi
          .fn()
          .mockResolvedValue(new Response("syntax error on line 1", { status: 400 }));
        vi.stubGlobal("fetch", mockFetch);

        const request = new Request("https://example.com/api/code", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "invalid code !!!", run: true }),
        });
        const url = new URL("https://example.com/api/code");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "code"]);

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error: string };
        expect(body.error).toContain("Transpilation failed");

        vi.unstubAllGlobals();
      });
    });

    describe("action: run", () => {
      it("should handle POST /api/run and transpile current code", async () => {
        const mockFetch = vi
          .fn()
          .mockResolvedValue(new Response("transpiled result", { status: 200 }));
        vi.stubGlobal("fetch", mockFetch);

        const request = new Request("https://example.com/api/run", {
          method: "POST",
        });
        const url = new URL("https://example.com/api/run");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "run"]);

        expect(response.status).toBe(200);
        const body = (await response.json()) as { success: boolean; updated: string[] };
        expect(body.success).toBe(true);
        expect(body.updated).toContain("transpiled");

        vi.unstubAllGlobals();
      });

      it("should return 400 when there is no code to run", async () => {
        mockCode.getSession = vi.fn().mockReturnValue({ ...mockSession, code: "" });

        const request = new Request("https://example.com/api/run", {
          method: "POST",
        });
        const url = new URL("https://example.com/api/run");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "run"]);

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error: string };
        expect(body.error).toBe("No code to transpile");
      });

      it("should return 400 when transpilation fails during run", async () => {
        const mockFetch = vi
          .fn()
          .mockResolvedValue(new Response("transpile error", { status: 500 }));
        vi.stubGlobal("fetch", mockFetch);

        const request = new Request("https://example.com/api/run", {
          method: "POST",
        });
        const url = new URL("https://example.com/api/run");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "run"]);

        expect(response.status).toBe(400);

        vi.unstubAllGlobals();
      });

      it("should return 405 for GET /api/run", async () => {
        const request = new Request("https://example.com/api/run");
        const url = new URL("https://example.com/api/run");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "run"]);

        expect(response.status).toBe(405);
      });
    });

    describe("action: screenshot", () => {
      it("should return 503 for screenshot (deprecated service)", async () => {
        const request = new Request("https://example.com/api/screenshot");
        const url = new URL("https://example.com/api/screenshot");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "screenshot"]);

        expect(response.status).toBe(503);
        const body = (await response.json()) as { error: string };
        expect(body.error).toContain("unavailable");
      });

      it("should return 405 for POST /api/screenshot", async () => {
        const request = new Request("https://example.com/api/screenshot", {
          method: "POST",
        });
        const url = new URL("https://example.com/api/screenshot");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "screenshot"]);

        expect(response.status).toBe(405);
      });
    });

    describe("action: session", () => {
      it("should return session data as JSON", async () => {
        const request = new Request("https://example.com/api/session");
        const url = new URL("https://example.com/api/session");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "session"]);

        expect(response.status).toBe(200);
        const body = (await response.json()) as {
          success: boolean;
          session: typeof mockSession;
          hash: string;
        };
        expect(body.success).toBe(true);
        expect(body.session.code).toBe(mockSession.code);
        expect(body.hash).toBe("mock-hash-abc123");
      });

      it("should return 405 for PUT /api/session", async () => {
        const request = new Request("https://example.com/api/session", {
          method: "PUT",
        });
        const url = new URL("https://example.com/api/session");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "session"]);

        expect(response.status).toBe(405);
      });
    });

    describe("action: validate", () => {
      it("should return valid:true when transpilation succeeds", async () => {
        const mockFetch = vi
          .fn()
          .mockResolvedValue(new Response("const App = () => null;", { status: 200 }));
        vi.stubGlobal("fetch", mockFetch);

        const request = new Request("https://example.com/api/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "const App = () => <div />" }),
        });
        const url = new URL("https://example.com/api/validate");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "validate"]);

        expect(response.status).toBe(200);
        const body = (await response.json()) as {
          success: boolean;
          valid: boolean;
          errors: unknown[];
        };
        expect(body.success).toBe(true);
        expect(body.valid).toBe(true);
        expect(body.errors).toHaveLength(0);

        vi.unstubAllGlobals();
      });

      it("should return valid:false with parsed errors when transpilation fails", async () => {
        const mockFetch = vi
          .fn()
          .mockResolvedValue(
            new Response("file.tsx:5:10: error: Unexpected token", { status: 400 }),
          );
        vi.stubGlobal("fetch", mockFetch);

        const request = new Request("https://example.com/api/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "invalid!!" }),
        });
        const url = new URL("https://example.com/api/validate");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "validate"]);

        expect(response.status).toBe(200);
        const body = (await response.json()) as {
          success: boolean;
          valid: boolean;
          errors: Array<{ line?: number; column?: number; message: string }>;
        };
        expect(body.success).toBe(false);
        expect(body.valid).toBe(false);
        expect(body.errors.length).toBeGreaterThan(0);

        vi.unstubAllGlobals();
      });

      it("should return 400 for validate with invalid JSON", async () => {
        const request = new Request("https://example.com/api/validate", {
          method: "POST",
          body: "not json",
        });
        const url = new URL("https://example.com/api/validate");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "validate"]);

        expect(response.status).toBe(400);
      });

      it("should return 400 for validate with missing code field", async () => {
        const request = new Request("https://example.com/api/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notCode: "something" }),
        });
        const url = new URL("https://example.com/api/validate");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "validate"]);

        expect(response.status).toBe(400);
      });

      it("should return 405 for GET /api/validate", async () => {
        const request = new Request("https://example.com/api/validate");
        const url = new URL("https://example.com/api/validate");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "validate"]);

        expect(response.status).toBe(405);
      });
    });

    describe("unknown action", () => {
      it("should return 404 for unrecognized route", async () => {
        const request = new Request("https://example.com/api/unknown");
        const url = new URL("https://example.com/api/unknown");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "unknown"]);

        expect(response.status).toBe(404);
        const text = await response.text();
        expect(text).toBe("Not found");
      });
    });

    describe("CORS headers", () => {
      it("should include CORS headers on success responses", async () => {
        const request = new Request("https://example.com/api/code");
        const url = new URL("https://example.com/api/code");

        const response = await apiRoutes.handleApiRoute(request, url, ["api", "code"]);

        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
        expect(response.headers.get("Content-Type")).toBe("application/json");
      });
    });
  });
});
