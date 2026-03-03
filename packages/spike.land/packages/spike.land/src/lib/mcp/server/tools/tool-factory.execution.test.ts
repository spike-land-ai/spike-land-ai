import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  registeredTool: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
  },
  vaultSecret: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}));

// Mock crypto
const mockDecryptSecret = vi.fn();
vi.mock("../crypto/vault", () => ({
  decryptSecret: (...args: unknown[]) => mockDecryptSecret(...args),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { createMockRegistry } from "../__test-utils__";
import { registerToolFactoryTools } from "./tool-factory";

describe("tool factory - test_tool execution", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerToolFactoryTools(registry, userId);
  });

  // ============================================================
  // test_tool
  // ============================================================

  describe("test_tool", () => {
    const mockTool = {
      id: "tool-1",
      name: "my_api_tool",
      status: "DRAFT",
      handlerSpec: {
        url: "https://api.example.com/search?q={{input.query}}",
        method: "GET",
        headers: { Authorization: "Bearer {{secrets.API_KEY}}" },
      },
    };

    it("should execute a tool test successfully", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue(mockTool);
      mockPrisma.vaultSecret.findMany.mockResolvedValue([
        {
          name: "API_KEY",
          encryptedValue: "enc",
          iv: "iv",
          tag: "tag",
          status: "APPROVED",
        },
      ]);
      mockDecryptSecret.mockReturnValue("sk-real-key");
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve("{\"results\": [1, 2, 3]}"),
      });

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-1",
        test_input: { query: "hello" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/search?q=hello",
        expect.objectContaining({
          method: "GET",
          headers: { Authorization: "Bearer sk-real-key" },
        }),
      );

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Tool Test: my_api_tool");
      expect(text).toContain("200 OK");
      expect(text).toContain("{\"results\": [1, 2, 3]}");
    });

    it("should apply responseTransform json_path when configured", async () => {
      const toolWithTransform = {
        ...mockTool,
        handlerSpec: {
          ...mockTool.handlerSpec,
          headers: {},
          responseTransform: {
            type: "json_path" as const,
            path: "data.items",
          },
        },
      };
      mockPrisma.registeredTool.findFirst.mockResolvedValue(toolWithTransform);
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: "OK",
        text: () =>
          Promise.resolve(
            JSON.stringify({ data: { items: ["a", "b", "c"] } }),
          ),
      });

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-1",
        test_input: { query: "test" },
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Transformed Result");
      expect(text).toContain("\"a\"");
      expect(text).toContain("\"b\"");
      expect(text).toContain("\"c\"");
    });

    it("should fall back to raw response when json_path transform fails on invalid JSON", async () => {
      const toolWithTransform = {
        ...mockTool,
        handlerSpec: {
          ...mockTool.handlerSpec,
          headers: {},
          responseTransform: {
            type: "json_path" as const,
            path: "data.items",
          },
        },
      };
      mockPrisma.registeredTool.findFirst.mockResolvedValue(toolWithTransform);
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve("not valid json"),
      });

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-1",
        test_input: { query: "test" },
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Response:");
      expect(text).toContain("not valid json");
    });

    it("should return error when tool is not found", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "nonexistent",
        test_input: {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Tool not found or disabled"),
            }),
          ]),
        }),
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return error when required secrets are missing", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue(mockTool);
      // Return empty array for vault secrets — the secret is not found/approved
      mockPrisma.vaultSecret.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-1",
        test_input: { query: "hello" },
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining(
                "Missing or unapproved secret: API_KEY",
              ),
            }),
          ]),
        }),
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should work with tools that have no secret references", async () => {
      const toolNoSecrets = {
        id: "tool-2",
        name: "simple_tool",
        status: "PUBLISHED",
        handlerSpec: {
          url: "https://api.example.com/public/{{input.id}}",
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      };
      mockPrisma.registeredTool.findFirst.mockResolvedValue(toolNoSecrets);
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve("{\"id\": 42}"),
      });

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-2",
        test_input: { id: "42" },
      });

      expect(mockPrisma.vaultSecret.findMany).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/public/42",
        expect.objectContaining({
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Tool Test: simple_tool"),
            }),
          ]),
        }),
      );
    });

    it("should resolve body templates for POST requests", async () => {
      const postTool = {
        id: "tool-3",
        name: "post_tool",
        status: "DRAFT",
        handlerSpec: {
          url: "https://api.example.com/data",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{\"query\": \"{{input.query}}\"}",
        },
      };
      mockPrisma.registeredTool.findFirst.mockResolvedValue(postTool);
      mockFetch.mockResolvedValue({
        status: 201,
        statusText: "Created",
        text: () => Promise.resolve("{\"ok\": true}"),
      });

      const handler = registry.handlers.get("test_tool")!;
      await handler({
        tool_id: "tool-3",
        test_input: { query: "test" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/data",
        expect.objectContaining({
          method: "POST",
          body: "{\"query\": \"test\"}",
        }),
      );
    });

    it("should truncate responses larger than 1MB", async () => {
      const toolNoSecrets = {
        id: "tool-4",
        name: "big_tool",
        status: "DRAFT",
        handlerSpec: {
          url: "https://api.example.com/big",
          method: "GET",
          headers: {},
        },
      };
      mockPrisma.registeredTool.findFirst.mockResolvedValue(toolNoSecrets);

      const bigResponse = "x".repeat(1_100_000);
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(bigResponse),
      });

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-4",
        test_input: {},
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("...(truncated)");
    });

    it("should handle fetch errors gracefully", async () => {
      const toolNoSecrets = {
        id: "tool-5",
        name: "failing_tool",
        status: "DRAFT",
        handlerSpec: {
          url: "https://api.example.com/error",
          method: "GET",
          headers: {},
        },
      };
      mockPrisma.registeredTool.findFirst.mockResolvedValue(toolNoSecrets);
      mockFetch.mockRejectedValue(new Error("Network error"));

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-5",
        test_input: {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Network error"),
            }),
          ]),
        }),
      );
    });

    it("should handle database errors", async () => {
      mockPrisma.registeredTool.findFirst.mockRejectedValue(
        new Error("DB error"),
      );

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-1",
        test_input: {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("DB error"),
            }),
          ]),
        }),
      );
    });

    it("should reject resolved URL that fails SSRF validation (template injection)", async () => {
      // Tool has a valid HTTPS URL with input template that resolves to a private address
      const ssrfTool = {
        id: "tool-ssrf",
        name: "ssrf_tool",
        status: "DRAFT",
        handlerSpec: {
          url: "https://{{input.host}}/api",
          method: "GET",
          headers: {},
        },
      };
      mockPrisma.registeredTool.findFirst.mockResolvedValue(ssrfTool);

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-ssrf",
        test_input: { host: "localhost" },
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Resolved URL is invalid"),
            }),
          ]),
        }),
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // test_tool abort timeout
  // ============================================================

  describe("test_tool abort timeout", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should abort fetch after 30s timeout", async () => {
      const toolNoSecrets = {
        id: "tool-timeout",
        name: "slow_tool",
        status: "DRAFT",
        handlerSpec: {
          url: "https://api.example.com/slow",
          method: "GET",
          headers: {},
        },
      };
      mockPrisma.registeredTool.findFirst.mockResolvedValue(toolNoSecrets);

      // Make fetch hang until aborted, then reject with AbortError
      mockFetch.mockImplementation(
        (_url: string, options: { signal: AbortSignal; }) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener("abort", () => {
              reject(
                new DOMException("The operation was aborted.", "AbortError"),
              );
            });
          }),
      );

      const handler = registry.handlers.get("test_tool")!;
      const resultPromise = handler({
        tool_id: "tool-timeout",
        test_input: {},
      });

      // Advance time by 30 seconds to trigger the abort
      await vi.advanceTimersByTimeAsync(30000);

      const result = await resultPromise;
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Error testing tool");
      expect((result as { isError: boolean; }).isError).toBe(true);
    });
  });

  // ============================================================
  // test_tool SSRF validation on resolved URL
  // ============================================================

  describe("test_tool SSRF validation", () => {
    it("should reject resolved URL that is non-HTTPS after template resolution", async () => {
      const ssrfTool = {
        id: "tool-ssrf-http",
        name: "ssrf_http_tool",
        status: "DRAFT",
        handlerSpec: {
          url: "https://{{input.scheme}}api.example.com/data",
          method: "GET",
          headers: {},
        },
      };
      mockPrisma.registeredTool.findFirst.mockResolvedValue(ssrfTool);

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-ssrf-http",
        test_input: { scheme: "192.168.1.1/" },
      });

      expect((result as { isError: boolean; }).isError).toBe(true);
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Resolved URL is invalid");
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // test_tool with missing headers (undefined headers branch)
  // ============================================================

  describe("test_tool with undefined headers", () => {
    it("should handle tool with no headers property in handlerSpec", async () => {
      const toolNoHeaders = {
        id: "tool-no-headers",
        name: "no_headers_tool",
        status: "DRAFT",
        handlerSpec: {
          url: "https://api.example.com/data",
          method: "GET",
          // headers intentionally omitted
        },
      };
      mockPrisma.registeredTool.findFirst.mockResolvedValue(toolNoHeaders);
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve("{\"ok\": true}"),
      });

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-no-headers",
        test_input: {},
      });

      // Should succeed with empty headers
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/data",
        expect.objectContaining({
          method: "GET",
          headers: {},
        }),
      );
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Tool Test: no_headers_tool");
      expect(text).toContain("200 OK");
    });
  });

  // ============================================================
  // test_tool responseTransform json_path with non-object segment
  // ============================================================

  describe("test_tool responseTransform edge cases", () => {
    it("should handle json_path when traversal hits a non-object value", async () => {
      const toolWithDeepPath = {
        id: "tool-deep-path",
        name: "deep_path_tool",
        status: "DRAFT",
        handlerSpec: {
          url: "https://api.example.com/data",
          method: "GET",
          headers: {},
          responseTransform: {
            type: "json_path" as const,
            path: "data.nested.value",
          },
        },
      };
      mockPrisma.registeredTool.findFirst.mockResolvedValue(toolWithDeepPath);
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: "OK",
        text: () =>
          Promise.resolve(
            JSON.stringify({ data: { nested: "not-an-object" } }),
          ),
      });

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-deep-path",
        test_input: {},
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Transformed Result");
    });

    it("should handle json_path when value is null during traversal", async () => {
      const toolWithNullPath = {
        id: "tool-null-path",
        name: "null_path_tool",
        status: "DRAFT",
        handlerSpec: {
          url: "https://api.example.com/data",
          method: "GET",
          headers: {},
          responseTransform: {
            type: "json_path" as const,
            path: "data.missing.deep",
          },
        },
      };
      mockPrisma.registeredTool.findFirst.mockResolvedValue(toolWithNullPath);
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(JSON.stringify({ data: { other: "value" } })),
      });

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-null-path",
        test_input: {},
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Transformed Result");
    });
  });

  // ============================================================
  // test_tool fetch rejects with non-Error (branch 411)
  // ============================================================

  describe("test_tool fetch non-Error rejection", () => {
    it("should handle fetch rejecting with a non-Error value", async () => {
      const toolNoSecrets = {
        id: "tool-fetch-str",
        name: "fetch_str_tool",
        status: "DRAFT",
        handlerSpec: {
          url: "https://api.example.com/data",
          method: "GET",
          headers: {},
        },
      };
      mockPrisma.registeredTool.findFirst.mockResolvedValue(toolNoSecrets);
      mockFetch.mockRejectedValue("network failure string");

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-fetch-str",
        test_input: {},
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Unknown error");
      expect((result as { isError: boolean; }).isError).toBe(true);
    });
  });
});
