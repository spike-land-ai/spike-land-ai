import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Code } from "../chatRoom";
import { CodeRoutes } from "./codeRoutes";

vi.mock("@spike-land-ai/code", () => ({
  computeSessionHash: vi.fn().mockReturnValue("mock-hash-12345"),
  importMapReplace: vi.fn().mockImplementation((code: string) => `replaced:${code}`),
  md5: vi.fn().mockImplementation((_str: string) => "abc123def456"),
}));

describe("CodeRoutes", () => {
  let codeRoutes: CodeRoutes;
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
      code: "const App = () => <div>Test</div>;",
      html: "<div>Test</div>",
      css: ".app { color: red; }",
      transpiled: "const App = () => React.createElement('div', null, 'Test');",
      codeSpace: "test-space",
    };

    mockCode = {
      getSession: vi.fn().mockReturnValue(mockSession),
      getOrigin: vi.fn().mockReturnValue("https://test.spike.land"),
      updateAndBroadcastSession: vi.fn().mockResolvedValue(undefined),
    } as unknown as Code;

    codeRoutes = new CodeRoutes(mockCode);
  });

  describe("handleCodeRoute", () => {
    it("should return the code as response body with 200 status", async () => {
      const response = await codeRoutes.handleCodeRoute();

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toBe(mockSession.code);
    });

    it("should set JavaScript content type", async () => {
      const response = await codeRoutes.handleCodeRoute();

      expect(response.headers.get("Content-Type")).toBe("application/javascript; charset=UTF-8");
    });

    it("should include CORS and cache headers", async () => {
      const response = await codeRoutes.handleCodeRoute();

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Cache-Control")).toBe("no-cache");
    });

    it("should include content hash header", async () => {
      const response = await codeRoutes.handleCodeRoute();

      expect(response.headers.get("content_hash")).toBeTruthy();
    });
  });

  describe("handleSessionRoute", () => {
    it("should return session as JSON with hash", async () => {
      const request = new Request("https://example.com/session");
      const url = new URL("https://example.com/session");

      const response = await codeRoutes.handleSessionRoute(request, url);

      expect(response.status).toBe(200);
      const body = (await response.json()) as typeof mockSession & { hash: string };
      expect(body.code).toBe(mockSession.code);
      expect(body.hash).toBe("mock-hash-12345");
    });

    it("should NOT call updateAndBroadcastSession when no room param", async () => {
      const request = new Request("https://example.com/session");
      const url = new URL("https://example.com/session");

      await codeRoutes.handleSessionRoute(request, url);

      expect(mockCode.updateAndBroadcastSession).not.toHaveBeenCalled();
    });

    it("should NOT update session when room matches current codeSpace", async () => {
      const request = new Request("https://example.com/session?room=test-space");
      const url = new URL("https://example.com/session?room=test-space");

      await codeRoutes.handleSessionRoute(request, url);

      expect(mockCode.updateAndBroadcastSession).not.toHaveBeenCalled();
    });

    it("should call updateAndBroadcastSession when room differs from current codeSpace", async () => {
      const request = new Request("https://example.com/session?room=other-space");
      const url = new URL("https://example.com/session?room=other-space");

      await codeRoutes.handleSessionRoute(request, url);

      expect(mockCode.updateAndBroadcastSession).toHaveBeenCalledWith({
        ...mockSession,
        codeSpace: "other-space",
      });
    });

    it("should set JSON content type and CORS headers", async () => {
      const request = new Request("https://example.com/session");
      const url = new URL("https://example.com/session");

      const response = await codeRoutes.handleSessionRoute(request, url);

      expect(response.headers.get("Content-Type")).toBe("application/json; charset=UTF-8");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("handleJsRoute", () => {
    it("should return import-map-replaced transpiled code", async () => {
      const response = await codeRoutes.handleJsRoute();

      const body = await response.text();
      expect(body).toBe(`replaced:${mockSession.transpiled}`);
    });

    it("should set JavaScript content type", async () => {
      const response = await codeRoutes.handleJsRoute();

      expect(response.headers.get("Content-Type")).toBe("application/javascript; charset=UTF-8");
    });

    it("should set x-typescript-types header to origin + /live/index.tsx", async () => {
      const response = await codeRoutes.handleJsRoute();

      expect(response.headers.get("x-typescript-types")).toBe(
        "https://test.spike.land/live/index.tsx",
      );
    });
  });

  describe("handleCssRoute", () => {
    it("should return CSS content", async () => {
      const response = await codeRoutes.handleCssRoute();

      const body = await response.text();
      expect(body).toBe(mockSession.css);
    });

    it("should set CSS content type", async () => {
      const response = await codeRoutes.handleCssRoute();

      expect(response.headers.get("Content-Type")).toBe("text/css; charset=UTF-8");
    });

    it("should include CORS headers", async () => {
      const response = await codeRoutes.handleCssRoute();

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });
});
