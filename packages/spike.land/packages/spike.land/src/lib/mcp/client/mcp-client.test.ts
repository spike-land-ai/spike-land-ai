import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockTokenManager = vi.hoisted(() => ({
  getToken: vi.fn(),
  clear: vi.fn(),
}));

vi.mock("./token-manager", () => ({
  tokenManager: mockTokenManager,
}));

// Import callTool after mock is set up (static import works fine since we mock statically)
import { callTool } from "./mcp-client";
// import { McpAuthError, McpRateLimitError, McpRpcError } from "./errors";

describe("callTool", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    mockTokenManager.getToken.mockReset();
    mockTokenManager.clear.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function rpcSuccess(result: unknown) {
    return {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          jsonrpc: "2.0",
          result,
          id: "test",
        }),
    };
  }

  function rpcError(code: number, message: string, data?: unknown) {
    return {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          jsonrpc: "2.0",
          error: { code, message, data },
          id: "test",
        }),
    };
  }

  describe("successful tool call", () => {
    it("should call fetch with correct JSON-RPC request", async () => {
      mockTokenManager.getToken.mockResolvedValue("my-token");
      mockFetch.mockResolvedValueOnce(
        rpcSuccess({
          content: [{ type: "text", text: "{\"hello\":\"world\"}" }],
        }),
      );

      await callTool("my-tool", { key: "value" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toBe("/api/mcp");
      expect(options.method).toBe("POST");
      expect(options.headers["Content-Type"]).toBe("application/json");
      expect(options.headers.Authorization).toBe("Bearer my-token");

      const body = JSON.parse(options.body);
      expect(body.jsonrpc).toBe("2.0");
      expect(body.method).toBe("tools/call");
      expect(body.params).toEqual({
        name: "my-tool",
        arguments: { key: "value" },
      });
      expect(body.id).toBeDefined();
    });

    it("should parse JSON text content and return it", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce(
        rpcSuccess({
          content: [{ type: "text", text: "{\"parsed\":true}" }],
        }),
      );

      const result = await callTool("test-tool");
      expect(result).toEqual({ parsed: true });
    });

    it("should return raw text when content is not valid JSON", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce(
        rpcSuccess({
          content: [{ type: "text", text: "Hello, plain text" }],
        }),
      );

      const result = await callTool("test-tool");
      expect(result).toBe("Hello, plain text");
    });

    it("should return the full result when no text content exists", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      const resultPayload = {
        content: [{ type: "image", data: "base64..." }],
      };
      mockFetch.mockResolvedValueOnce(rpcSuccess(resultPayload));

      const result = await callTool("test-tool");
      expect(result).toEqual(resultPayload);
    });

    it("should default args to empty object", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce(
        rpcSuccess({
          content: [{ type: "text", text: "\"ok\"" }],
        }),
      );

      await callTool("no-args-tool");

      const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body);
      expect(body.params.arguments).toEqual({});
    });

    it("should pass AbortSignal to fetch", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce(
        rpcSuccess({
          content: [{ type: "text", text: "\"ok\"" }],
        }),
      );

      const controller = new AbortController();
      await callTool("tool", {}, { signal: controller.signal });

      expect(mockFetch.mock.calls[0]![1]!.signal).toBe(controller.signal);
    });
  });

  describe("authentication", () => {
    it("should throw McpAuthError when token is null", async () => {
      mockTokenManager.getToken.mockResolvedValue(null);

      await expect(callTool("test-tool")).rejects.toThrow("Unauthorized");
      try {
        await callTool("test-tool");
      } catch (e: unknown) {
        expect((e as Error).name).toBe("McpAuthError");
      }
    });

    it("should retry once on 401 response", async () => {
      mockTokenManager.getToken
        .mockResolvedValueOnce("old-token") // first call
        .mockResolvedValueOnce("new-token") // after clear
        .mockResolvedValueOnce("new-token"); // retry call's getToken

      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 401 }) // first attempt
        .mockResolvedValueOnce(
          rpcSuccess({
            content: [{ type: "text", text: "\"retried\"" }],
          }),
        ); // retry attempt

      const result = await callTool("tool");
      expect(result).toBe("retried");
      expect(mockTokenManager.clear).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw McpAuthError on 401 when retry also gets 401", async () => {
      mockTokenManager.getToken
        .mockResolvedValueOnce("token-1")
        .mockResolvedValueOnce("token-2")
        .mockResolvedValueOnce("token-2");

      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({ ok: false, status: 401 });

      await expect(callTool("tool")).rejects.toThrow("Unauthorized");
    });

    it("should throw McpAuthError when new token is null after 401", async () => {
      mockTokenManager.getToken
        .mockResolvedValueOnce("old-token")
        .mockResolvedValueOnce(null);

      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      await expect(callTool("tool")).rejects.toThrow("Unauthorized");
    });
  });

  describe("rate limiting", () => {
    it("should throw McpRateLimitError on 429 response", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

      await expect(callTool("tool")).rejects.toThrow("Too many requests");
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
      try {
        await callTool("tool");
      } catch (e: unknown) {
        expect((e as Error).name).toBe("McpRateLimitError");
      }
    });
  });

  describe("HTTP errors", () => {
    it("should throw generic Error on non-401/429 failure status", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(callTool("tool")).rejects.toThrow(
        "MCP request failed with status 500",
      );
    });

    it("should include status code in error message", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      await expect(callTool("tool")).rejects.toThrow("503");
    });
  });

  describe("RPC errors", () => {
    it("should throw McpRpcError when response contains an error field", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce(
        rpcError(-32601, "Method not found", { detail: "extra" }),
      );

      try {
        await callTool("tool");
        expect.fail("should have thrown");
      } catch (error) {
        const e = error as Error & { code?: number; data?: unknown; };
        expect(e.name).toBe("McpRpcError");
        expect(e.code).toBe(-32601);
        expect(e.message).toBe("Method not found");
        expect(e.data).toEqual({ detail: "extra" });
      }
    });
  });

  describe("auto-enable disabled tools", () => {
    it("should call search_tools and retry when tool is disabled", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch
        .mockResolvedValueOnce(rpcError(-32602, "Tool profile_start disabled"))
        .mockResolvedValueOnce(
          rpcSuccess({
            content: [{ type: "text", text: "{\"enabled\":true}" }],
          }),
        )
        .mockResolvedValueOnce(
          rpcSuccess({
            content: [{ type: "text", text: "{\"result\":\"success\"}" }],
          }),
        );

      const result = await callTool("profile_start", { userId: "123" });
      expect(result).toEqual({ result: "success" });
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Second call should be search_tools
      const searchBody = JSON.parse(mockFetch.mock.calls[1]![1]!.body);
      expect(searchBody.params.name).toBe("search_tools");
      expect(searchBody.params.arguments).toEqual({ query: "profile_start" });

      // Third call should be the original tool retry
      const retryBody = JSON.parse(mockFetch.mock.calls[2]![1]!.body);
      expect(retryBody.params.name).toBe("profile_start");
    });

    it("should not retry more than once for disabled tools", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch
        .mockResolvedValueOnce(rpcError(-32602, "Tool profile_start disabled"))
        .mockResolvedValueOnce(
          rpcSuccess({
            content: [{ type: "text", text: "{\"enabled\":true}" }],
          }),
        )
        .mockResolvedValueOnce(rpcError(-32602, "Tool profile_start disabled"));

      await expect(callTool("profile_start")).rejects.toThrow(
        "Tool profile_start disabled",
      );
    });

    it("should not auto-enable for non-disabled error messages", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce(
        rpcError(-32602, "Tool profile_start has invalid arguments"),
      );

      await expect(callTool("profile_start")).rejects.toThrow(
        "Tool profile_start has invalid arguments",
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("isError result", () => {
    it("should throw Error with text content when result.isError is true", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce(
        rpcSuccess({
          content: [
            { type: "text", text: "Error line 1" },
            { type: "image", data: "ignored" },
            { type: "text", text: "Error line 2" },
          ],
          isError: true,
        }),
      );

      await expect(callTool("tool")).rejects.toThrow(
        "Error line 1\nError line 2",
      );
    });

    it("should use fallback error message when no text content in isError result", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce(
        rpcSuccess({
          content: [{ type: "image", data: "no-text" }],
          isError: true,
        }),
      );

      await expect(callTool("tool")).rejects.toThrow(
        "Tool tool reported an error",
      );
    });

    it("should auto-enable disabled tool via isError result and retry", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch
        .mockResolvedValueOnce(
          rpcSuccess({
            content: [{
              type: "text",
              text: "Tool audio_create_project disabled",
            }],
            isError: true,
          }),
        )
        .mockResolvedValueOnce(
          rpcSuccess({
            content: [{ type: "text", text: "{\"enabled\":true}" }],
          }),
        )
        .mockResolvedValueOnce(
          rpcSuccess({
            content: [{
              type: "text",
              text: "{\"id\":\"proj-1\",\"name\":\"My Mix\"}",
            }],
          }),
        );

      const result = await callTool("audio_create_project", { name: "My Mix" });
      expect(result).toEqual({ id: "proj-1", name: "My Mix" });
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Second call should be search_tools to enable the tool
      const searchBody = JSON.parse(mockFetch.mock.calls[1]![1]!.body);
      expect(searchBody.params.name).toBe("search_tools");
      expect(searchBody.params.arguments).toEqual({
        query: "audio_create_project",
      });

      // Third call should be the original tool retry
      const retryBody = JSON.parse(mockFetch.mock.calls[2]![1]!.body);
      expect(retryBody.params.name).toBe("audio_create_project");
    });

    it("should auto-enable 'not found' tool via isError result and retry", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch
        .mockResolvedValueOnce(
          rpcSuccess({
            content: [{ type: "text", text: "Tool my_tool not found" }],
            isError: true,
          }),
        )
        .mockResolvedValueOnce(
          rpcSuccess({
            content: [{ type: "text", text: "{\"enabled\":true}" }],
          }),
        )
        .mockResolvedValueOnce(
          rpcSuccess({
            content: [{ type: "text", text: "\"ok\"" }],
          }),
        );

      const result = await callTool("my_tool");
      expect(result).toBe("ok");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should not retry isError disabled more than once", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch
        .mockResolvedValueOnce(
          rpcSuccess({
            content: [{
              type: "text",
              text: "Tool audio_create_project disabled",
            }],
            isError: true,
          }),
        )
        .mockResolvedValueOnce(
          rpcSuccess({
            content: [{ type: "text", text: "{\"enabled\":true}" }],
          }),
        )
        .mockResolvedValueOnce(
          rpcSuccess({
            content: [{
              type: "text",
              text: "Tool audio_create_project disabled",
            }],
            isError: true,
          }),
        );

      await expect(callTool("audio_create_project")).rejects.toThrow(
        "Tool audio_create_project disabled",
      );
    });

    it("should not auto-enable for non-disabled isError messages", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce(
        rpcSuccess({
          content: [{
            type: "text",
            text: "**Error: NOT_FOUND**\nProject not found.",
          }],
          isError: true,
        }),
      );

      await expect(callTool("audio_create_project")).rejects.toThrow(
        "**Error: NOT_FOUND**\nProject not found.",
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("result with null/undefined", () => {
    it("should return result as-is when result is undefined", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            jsonrpc: "2.0",
            result: undefined,
            id: "test",
          }),
      });

      const result = await callTool("tool");
      expect(result).toBeUndefined();
    });
  });

  describe("content with multiple types", () => {
    it("should find the first text content item for JSON parsing", async () => {
      mockTokenManager.getToken.mockResolvedValue("token");
      mockFetch.mockResolvedValueOnce(
        rpcSuccess({
          content: [
            { type: "image", data: "png..." },
            { type: "text", text: "{\"found\":true}" },
            { type: "text", text: "ignored" },
          ],
        }),
      );

      const result = await callTool("tool");
      expect(result).toEqual({ found: true });
    });
  });
});
