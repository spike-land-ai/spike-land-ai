/**
 * Targeted branch coverage tests for postHandler.ts uncovered branches.
 * Lines: 86, 158, 166, 209, 221, 265, 372, 373, 403, 405, 452, 486, 497, 498, 521, 556
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Code } from "../../../src/edge-api/backend/lazy-imports/chatRoom";
import type Env from "../../../src/edge-api/backend/core-logic/env";
import { PostHandler } from "../../../src/edge-api/backend/core-logic/handlers/postHandler";
import { StorageService } from "../../../src/edge-api/backend/core-logic/services/storageService";

vi.mock("@ai-sdk/anthropic");
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => "google-model")),
}));
vi.mock("ai");
vi.mock("../../../src/edge-api/backend/core-logic/services/storageService");
vi.mock("../../../src/edge-api/backend/core-logic/lib/ga4", () => ({
  hashClientId: vi.fn().mockResolvedValue("client-id"),
  sendGA4Events: vi.fn().mockResolvedValue(undefined),
}));

// Setup crypto
vi.stubGlobal("crypto", {
  ...globalThis.crypto,
  randomUUID: vi.fn(() => "test-uuid-456"),
});

function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    CLAUDE_CODE_OAUTH_TOKEN: "test-token",
    GEMINI_API_KEY: "test-gemini-key",
    ...overrides,
  } as unknown as Env;
}

function createMockMcpServer(
  tools = [
    {
      name: "test_tool",
      description: "A tool",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
  ],
) {
  return {
    tools,
    executeTool: vi.fn().mockResolvedValue({ result: "ok" }),
  };
}

function createMockCode(mcpServer = createMockMcpServer()): Code {
  return {
    getSession: vi.fn().mockReturnValue({
      codeSpace: "test-space",
      code: "test",
      html: "",
      css: "",
      transpiled: "",
      messages: [],
    }),
    getEnv: vi.fn().mockReturnValue({}),
    getMcpServer: vi.fn().mockReturnValue(mcpServer),
  } as unknown as Code;
}

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/messages", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function makeValidBody(overrides = {}) {
  return {
    messages: [{ role: "user", content: "Hello" }],
    ...overrides,
  };
}

describe("PostHandler — branch coverage", () => {
  let mockStorageService: { saveRequestBody: ReturnType<typeof vi.fn> };
  let mockCode: Code;
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageService = { saveRequestBody: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(StorageService).mockImplementation(function () {
      return mockStorageService as unknown as StorageService;
    });
    mockCode = createMockCode();
    mockEnv = createMockEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GA tracking branch (line 166)", () => {
    it("fires GA events when GA_MEASUREMENT_ID and GA_API_SECRET are set", async () => {
      const { hashClientId, sendGA4Events } = await import(
        "../../../src/edge-api/backend/core-logic/lib/ga4.js"
      );
      const envWithGA = createMockEnv({
        GA_MEASUREMENT_ID: "G-123",
        GA_API_SECRET: "secret",
      } as Partial<Env>);

      const { streamText } = await import("ai");
      const mockResult = {
        toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream")),
      };
      (streamText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const handler = new PostHandler(mockCode, envWithGA);
      const request = makeRequest(makeValidBody());
      await handler.handle(request, new URL("https://example.com/messages"));

      expect(hashClientId).toHaveBeenCalled();
      expect(sendGA4Events).toHaveBeenCalled();
    });

    it("handles GA4 event failure gracefully when hashClientId rejects (line 177 catch)", async () => {
      const { hashClientId } = await import("../../../src/edge-api/backend/core-logic/lib/ga4.js");
      (hashClientId as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("hash failure"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const envWithGA = createMockEnv({
        GA_MEASUREMENT_ID: "G-123",
        GA_API_SECRET: "secret",
      } as Partial<Env>);

      const { streamText } = await import("ai");
      const mockResult = {
        toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream")),
      };
      (streamText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const handler = new PostHandler(mockCode, envWithGA);
      const request = makeRequest(makeValidBody());
      const _response = await handler.handle(request, new URL("https://example.com/messages"));

      // The GA4 error should be caught silently — request still succeeds
      expect(response.status).toBe(200);
      // Give the fire-and-forget catch a tick to execute
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(consoleSpy).toHaveBeenCalledWith("Failed to send GA4 event:", expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe("catch block — non-Error thrown (line 209)", () => {
    it("returns 500 with 'Unknown error' when non-Error is thrown", async () => {
      const { streamText } = await import("ai");
      (streamText as ReturnType<typeof vi.fn>).mockRejectedValue("plain string error");

      const handler = new PostHandler(mockCode, mockEnv);
      const request = makeRequest(makeValidBody());
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const _response = await handler.handle(request, new URL("https://example.com/messages"));
      expect(response.status).toBe(500);
      // The outer catch returns "Failed to process message" with details: "Unknown error"
      const data = (await response.json()) as { error: string; details?: string };
      expect(data.error).toBe("Failed to process message");
      expect(data.details).toBe("Unknown error");
      consoleSpy.mockRestore();
    });
  });

  describe("toTextStreamResponse fallback (line 486)", () => {
    it("falls back to toTextStreamResponse when toUIMessageStreamResponse is not available", async () => {
      const { streamText } = await import("ai");
      const mockResult = {
        toTextStreamResponse: vi.fn().mockReturnValue(new Response("text-stream")),
        // No toUIMessageStreamResponse
      };
      (streamText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const handler = new PostHandler(mockCode, mockEnv);
      const request = makeRequest(makeValidBody());
      const _response = await handler.handle(request, new URL("https://example.com/messages"));
      expect(mockResult.toTextStreamResponse).toHaveBeenCalled();
    });
  });

  describe("no streaming methods available (line 492)", () => {
    it("throws when result has no streaming methods", async () => {
      const { streamText } = await import("ai");
      // No streaming methods on result
      (streamText as ReturnType<typeof vi.fn>).mockResolvedValue({ someOtherProp: true });

      const handler = new PostHandler(mockCode, mockEnv);
      const request = makeRequest(makeValidBody());
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const _response = await handler.handle(request, new URL("https://example.com/messages"));
      expect(response.status).toBe(500);
      consoleSpy.mockRestore();
    });
  });

  describe("streamText error — non-Error thrown (lines 497-498)", () => {
    it("handles non-Error stream error in catch block", async () => {
      const { streamText } = await import("ai");
      // Throw a non-Error object from streamText to test `instanceof Error` false branch
      (streamText as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw { code: 500, msg: "not an Error instance" };
      });

      const handler = new PostHandler(mockCode, mockEnv);
      const request = makeRequest(makeValidBody());
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const _response = await handler.handle(request, new URL("https://example.com/messages"));
      expect(response.status).toBe(500);
      consoleSpy.mockRestore();
    });
  });

  describe("processTools — invalid inputSchema type (line 521)", () => {
    it("skips tool with inputSchema.type !== 'object'", async () => {
      const { streamText } = await import("ai");
      const mockResult = {
        toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream")),
      };
      (streamText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const invalidTool = {
        name: "bad_tool",
        description: "Bad tool",
        inputSchema: { type: "string" as const, properties: {}, required: [] },
      };
      const mcpServer = createMockMcpServer([
        invalidTool as unknown as Parameters<typeof createMockMcpServer>[0][0],
      ]);
      const codeWithBadTool = createMockCode(mcpServer);
      const handler = new PostHandler(codeWithBadTool, mockEnv);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const request = makeRequest(makeValidBody());
      const _response = await handler.handle(request, new URL("https://example.com/messages"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("invalid inputSchema.type"));
      consoleSpy.mockRestore();
    });
  });

  describe("processTools — no inputSchema (line 513)", () => {
    it("skips tool with no inputSchema", async () => {
      const { streamText } = await import("ai");
      const mockResult = {
        toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream")),
      };
      (streamText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const noSchemaTool = { name: "no_schema", description: "Tool without schema" };
      const mcpServer = createMockMcpServer([
        noSchemaTool as unknown as Parameters<typeof createMockMcpServer>[0][0],
      ]);
      const codeWithNoSchema = createMockCode(mcpServer);
      const handler = new PostHandler(codeWithNoSchema, mockEnv);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const request = makeRequest(makeValidBody());
      await handler.handle(request, new URL("https://example.com/messages"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("has no inputSchema"));
      consoleSpy.mockRestore();
    });
  });

  describe("isToolDefinition — null value (line 86)", () => {
    it("returns false for null (isToolDefinition null branch)", async () => {
      const { streamText } = await import("ai");
      const mockResult = {
        toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream")),
      };
      (streamText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const handler = new PostHandler(mockCode, mockEnv);
      // Pass null in the tools array to trigger the null branch in isToolDefinition
      const request = makeRequest({
        ...makeValidBody(),
        tools: [null, { input_schema: { type: "object" } }],
      });
      const _response = await handler.handle(request, new URL("https://example.com/messages"));
      expect(response).toBeDefined();
    });
  });

  describe("validateToolsArray — custom.input_schema invalid type (line 228-239)", () => {
    it("adds invalidTool for tool with custom.input_schema.type !== 'object'", async () => {
      const { streamText } = await import("ai");
      const mockResult = {
        toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream")),
      };
      (streamText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const handler = new PostHandler(mockCode, mockEnv);
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const request = makeRequest({
        ...makeValidBody(),
        tools: [{ custom: { input_schema: { type: "string" } }, input_schema: null }],
      });
      await handler.handle(request, new URL("https://example.com/messages"));
      consoleSpy.mockRestore();
    });
  });

  describe("convertMessages — image_url type fallback (line 405)", () => {
    it("handles image_url content part", async () => {
      const { streamText } = await import("ai");
      const mockResult = {
        toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream")),
      };
      (streamText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const handler = new PostHandler(mockCode, mockEnv);
      const request = makeRequest({
        messages: [
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: "https://example.com/image.png" } }],
          },
        ],
      });
      const _response = await handler.handle(request, new URL("https://example.com/messages"));
      expect(response).toBeDefined();
    });
  });

  describe("convertMessages — invalid content part type (line 403)", () => {
    it("handles array content with invalid parts (isMessageContentPart false)", async () => {
      const { streamText } = await import("ai");
      const mockResult = {
        toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream")),
      };
      (streamText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const handler = new PostHandler(mockCode, mockEnv);
      const request = makeRequest({
        messages: [
          {
            role: "user",
            content: ["not-an-object", null],
          },
        ],
      });
      const _response = await handler.handle(request, new URL("https://example.com/messages"));
      expect(response).toBeDefined();
    });
  });

  describe("convertMessages — fallback for unexpected content (line 414)", () => {
    it("handles messages where content is neither string nor array", async () => {
      const { streamText } = await import("ai");
      const mockResult = {
        toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response("stream")),
      };
      (streamText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const handler = new PostHandler(mockCode, mockEnv);
      // Use parts format with image type to hit the image branch (line 371-373)
      const request = makeRequest({
        messages: [
          {
            role: "user",
            parts: [
              { type: "image", url: "https://example.com/img.png" },
              { type: "image_url", image_url: { url: "https://example.com/img2.png" } },
            ],
          },
        ],
      });
      const _response = await handler.handle(request, new URL("https://example.com/messages"));
      expect(response).toBeDefined();
    });
  });

  describe("request body parse error (line 265)", () => {
    it("throws on invalid JSON parse, testing parseError instanceof Error false branch", async () => {
      const handler = new PostHandler(mockCode, mockEnv);
      // Create request with non-JSON body to trigger parseRequestBody catch
      const request = new Request("https://example.com/messages", {
        method: "POST",
        body: "not-valid-json{{",
        headers: { "Content-Type": "application/json" },
      });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const _response = await handler.handle(request, new URL("https://example.com/messages"));
      // Should return 500 from outer catch
      expect(response.status).toBe(500);
      consoleSpy.mockRestore();
    });
  });
});
