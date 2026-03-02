import { importMap } from "@spike-land-ai/code";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type Env from "./env.js";
import { handleFetchApi } from "./fetchHandler.js";
import { createMockEnv } from "./test-utils.js";
import { handleCORS } from "./utils.js";

interface MockWebSocket extends WebSocket {
  accept: Mock;
  addEventListener: Mock;
  removeEventListener: Mock;
  dispatchEvent: Mock;
  send: Mock;
  close: Mock;
}

vi.stubGlobal(
  "WebSocketPair",
  class {
    0: MockWebSocket;
    1: MockWebSocket;
    constructor() {
      const mockWebSocket = {
        accept: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        binaryType: "blob",
        bufferedAmount: 0,
        extensions: "",
        onclose: null,
        onerror: null,
        onmessage: null,
        onopen: null,
        protocol: "",
        readyState: WebSocket.CONNECTING,
        url: "ws://test",
      } as MockWebSocket;
      this[0] = { ...mockWebSocket };
      this[1] = { ...mockWebSocket };
    }
  },
);

describe("FetchHandler", () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;
  let mockFetch: typeof fetch;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Create a mock environment
    mockEnv = createMockEnv() as unknown as Env;

    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: () => {},
      props: {},
    } as unknown as ExecutionContext;

    vi.mock("./utils", () => ({
      handleCORS: vi.fn(),
    }));
  });

  describe("CORS Handling", () => {
    it("should handle OPTIONS request", async () => {
      const mockRequest = new Request("https://example.com", {
        method: "OPTIONS",
      });

      const mockCorsResponse = new Response("CORS response");
      (handleCORS as Mock).mockReturnValue(mockCorsResponse);

      const response = await handleFetchApi(["test"], mockRequest, mockEnv, mockCtx);

      expect(handleCORS).toHaveBeenCalledWith(mockRequest);
      expect(response).toBe(mockCorsResponse);
    });
  });

  describe("Ping Endpoint", () => {
    it("should return a random ping response", async () => {
      const mockRequest = new Request("https://example.com/ping");

      const response = await handleFetchApi(["ping"], mockRequest, mockEnv as Env, mockCtx);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/html;charset=UTF-8");

      const text = await response.text();
      expect(text).toMatch(/^ping\d+(\.\d+)?$/);
    });
  });

  describe("WebSocket Handling", () => {
    it("should handle valid WebSocket upgrade request", async () => {
      const mockRequest = new Request("https://example.com/websocket", {
        headers: {
          Upgrade: "websocket",
          Connection: "upgrade",
        },
      });

      const response = await handleFetchApi(["websocket"], mockRequest, mockEnv as Env, mockCtx);

      expect(response.status).toBe(101);
      expect(response.webSocket).toBeDefined();
    });
  });

  describe("Import Map JSON", () => {
    it("should return import map JSON", async () => {
      const mockRequest = new Request("https://example.com/importMap.json");

      const response = await handleFetchApi(
        ["importMap.json"],
        mockRequest,
        mockEnv as Env,
        mockCtx,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json;charset=UTF-8");

      const json = await response.json();
      expect(json).toEqual(importMap);
    });
  });

  describe("Robots.txt", () => {
    it("should return robots.txt content", async () => {
      const mockRequest = new Request("https://example.com/robots.txt");

      const response = await handleFetchApi(["robots.txt"], mockRequest, mockEnv as Env, mockCtx);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/plain;charset=UTF-8");

      const text = await response.text();
      expect(text).toContain("User-agent: *");
      expect(text).toContain("Sitemap:");
    });
  });

  describe("IPFS Request Handling", () => {
    it("should return cloudflare-ipfs.com response when successful", async () => {
      const mockRequest = new Request("https://example.com/ipfs/test");
      const mockCloudflareResponse = new Response("Cloudflare IPFS response", {
        status: 200,
      });

      (mockFetch as Mock).mockResolvedValueOnce(mockCloudflareResponse);

      const response = await handleFetchApi(["ipfs", "test"], mockRequest, mockEnv as Env, mockCtx);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(response).toBe(mockCloudflareResponse);
    });

    it("should fall back to ipfs.io when cloudflare-ipfs.com fails", async () => {
      const mockRequest = new Request("https://example.com/ipfs/test");
      const mockFailResponse = new Response("Not found", { status: 404 });
      const mockIpfsResponse = new Response("IPFS response", { status: 200 });

      (mockFetch as Mock)
        .mockResolvedValueOnce(mockFailResponse)
        .mockResolvedValueOnce(mockIpfsResponse);

      const response = await handleFetchApi(["ipfs", "test"], mockRequest, mockEnv as Env, mockCtx);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response).toBe(mockIpfsResponse);
    });
  });

  describe("Live Request Handling", () => {
    it("should handle public request", async () => {
      const mockRequest = new Request("https://example.com/live/testspace/public/file.txt", {
        method: "GET",
      });

      const mockR2Object = {
        writeHttpMetadata: vi.fn(),
        httpEtag: "test-etag",
        body: "file content",
      };

      (mockEnv.R2?.get as Mock).mockResolvedValue(mockR2Object);

      const response = await handleFetchApi(
        ["live", "testspace", "public", "file.txt"],
        mockRequest,
        mockEnv as Env,
        mockCtx,
      );

      expect(response.status).toBe(200);
      expect(mockR2Object.writeHttpMetadata).toHaveBeenCalled();
    });

    it("should handle live index request", async () => {
      const mockRequest = new Request("https://example.com/live/testspace/index.mjs", {
        method: "GET",
      });

      const mockR2Object = {
        writeHttpMetadata: vi.fn(),
        httpEtag: "test-etag",
        body: "module content",
      };

      (mockEnv.R2?.get as Mock).mockResolvedValue(mockR2Object);

      const response = await handleFetchApi(
        ["live", "testspace", "index.mjs"],
        mockRequest,
        mockEnv as Env,
        mockCtx,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/javascript; charset=UTF-8");
    });
  });

  describe("ESM CDN Redirect", () => {
    it("should redirect unknown routes to esm.sh", async () => {
      const mockRequest = new Request("https://example.com/react@19.0.0?bundle=true");

      const response = await handleFetchApi(["react@19.0.0"], mockRequest, mockEnv as Env, mockCtx);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("https://esm.sh/react@19.0.0?bundle=true");
    });

    it("should redirect tailwindcss bare package to index.css", async () => {
      const mockRequest = new Request("https://example.com/tailwindcss@4.0.0");

      const response = await handleFetchApi(
        ["tailwindcss@4.0.0"],
        mockRequest,
        mockEnv as Env,
        mockCtx,
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("https://esm.sh/tailwindcss@4.0.0/index.css");
    });

    it("should redirect node polyfill URLs to esm.sh bare module", async () => {
      const mockRequest = new Request("https://example.com/node@25.6.0/buffer.mjs");

      const response = await handleFetchApi(
        ["node@25.6.0", "buffer.mjs"],
        mockRequest,
        mockEnv as Env,
        mockCtx,
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("https://esm.sh/buffer");
    });

    it("should redirect empty path to esm.sh", async () => {
      const mockRequest = new Request("https://example.com/some-package");

      const response = await handleFetchApi(["some-package"], mockRequest, mockEnv as Env, mockCtx);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("https://esm.sh/some-package");
    });
  });
});
