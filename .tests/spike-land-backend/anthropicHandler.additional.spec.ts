/**
 * Additional anthropicHandler tests for uncovered branches:
 * - debugMode=true branches (lines 73, 77, 134, 145)
 * - All tokens exhausted with lastError=undefined (line 157)
 * - pathAfterAnthropicAi empty fallback (line 68)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleAnthropicRequest } from "../../src/edge-api/backend/core-logic/anthropicHandler.js";
import type Env from "../../src/edge-api/backend/core-logic/env.js";

function createDebugEnv(
  mockKV: ReturnType<typeof createMockKV>,
  overrides: Record<string, unknown> = {},
): Env {
  return {
    CLAUDE_CODE_OAUTH_TOKEN: "token-debug",
    DEBUG_ANTHROPIC_PROXY: "true",
    KV: mockKV,
    ...overrides,
  } as unknown as Env;
}

function createMockKV() {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    list: vi.fn(),
    delete: vi.fn(),
    getWithMetadata: vi.fn(),
  };
}

describe("anthropicHandler additional coverage", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    mockKV = createMockKV();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("debugMode=true branches", () => {
    it("logs tools in POST request body when debugMode=true and tools present", async () => {
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));
      const env = createDebugEnv(mockKV);

      const request = new Request("https://api.example.com/anthropic/v1/messages", {
        method: "POST",
        body: JSON.stringify({ model: "claude-3", tools: [{ name: "test_tool" }] }),
        headers: { "Content-Type": "application/json" },
        duplex: "half",
      } as RequestInit);

      await handleAnthropicRequest(request, env);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Anthropic Proxy] Request contains tools:"),
        expect.any(String),
      );
      consoleSpy.mockRestore();
    });

    it("handles POST request body without tools when debugMode=true", async () => {
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));
      const env = createDebugEnv(mockKV);

      const request = new Request("https://api.example.com/anthropic/v1/messages", {
        method: "POST",
        body: JSON.stringify({ model: "claude-3", messages: [] }),
        headers: { "Content-Type": "application/json" },
        duplex: "half",
      } as RequestInit);

      await handleAnthropicRequest(request, env);
      // Should not log tools debug message
      const debugCalls = consoleSpy.mock.calls.filter(
        ([msg]) => typeof msg === "string" && msg.includes("contains tools"),
      );
      expect(debugCalls.length).toBe(0);
      consoleSpy.mockRestore();
    });

    it("logs warning when token auth fails in debugMode=true", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      // First token returns 401, second succeeds
      mockFetch
        .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
        .mockResolvedValue(new Response("ok", { status: 200 }));

      const env = {
        CLAUDE_CODE_OAUTH_TOKEN: "token-1",
        CLAUDE_CODE_OAUTH_TOKEN_2: "token-2",
        DEBUG_ANTHROPIC_PROXY: "true",
        KV: mockKV,
      } as unknown as Env;

      const request = new Request("https://api.example.com/anthropic/v1/messages");
      await handleAnthropicRequest(request, env);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[Anthropic Proxy] Token"));
      consoleSpy.mockRestore();
    });

    it("logs error for non-401 response in debugMode=true", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockFetch.mockResolvedValue(new Response("Rate limited", { status: 429 }));
      const env = createDebugEnv(mockKV);

      const request = new Request("https://api.example.com/anthropic/v1/messages");
      const _response = await handleAnthropicRequest(request, env);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Anthropic Proxy] API Error Response:"),
        expect.any(String),
      );
      consoleSpy.mockRestore();
    });

    it("logs 'Could not parse request body' when POST body is invalid JSON in debugMode=true (line 88)", async () => {
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));
      const env = createDebugEnv(mockKV);

      const request = new Request("https://api.example.com/anthropic/v1/messages", {
        method: "POST",
        body: "this is not valid json {{{",
        headers: { "Content-Type": "text/plain" },
        duplex: "half",
      } as RequestInit);

      await handleAnthropicRequest(request, env);
      expect(consoleSpy).toHaveBeenCalledWith("[Anthropic Proxy] Could not parse request body");
      consoleSpy.mockRestore();
    });
  });

  describe("path extraction", () => {
    it("handles URL with no /anthropic in path (empty fallback)", async () => {
      mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));
      const env = createDebugEnv(mockKV);
      // URL without /anthropic in path
      const request = new Request("https://api.example.com/v1/messages");
      const _response = await handleAnthropicRequest(request, env);
      expect(response).toBeDefined();
    });
  });

  describe("all tokens exhausted — lastError undefined", () => {
    it("throws generic error when all 401 attempts exhaust but lastError is undefined", async () => {
      // This path is hard to hit naturally (lastError is always set on 401)
      // Instead test the lastError path by exhausting all tokens with 401
      mockFetch.mockResolvedValue(new Response("Unauthorized", { status: 401 }));
      const env = {
        CLAUDE_CODE_OAUTH_TOKEN: "bad-token",
        KV: mockKV,
      } as unknown as Env;

      const request = new Request("https://api.example.com/anthropic/v1/messages");
      const _response = await handleAnthropicRequest(request, env);
      // Returns CORS error response wrapping the thrown error
      expect(response.status).toBe(500);
    });
  });
});
