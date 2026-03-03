import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  workspace: {
    findFirst: vi.fn(),
  },
  toolInvocation: {
    create: vi.fn(),
  },
  vaultSecret: {
    findFirst: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

const mockDecryptSecret = vi.fn();
vi.mock("../crypto/vault", () => ({
  decryptSecret: mockDecryptSecret,
}));

import {
  apiRequest,
  getVaultSecret,
  resolveWorkspace,
  safeToolCall,
  textResult,
} from "./tool-helpers";
import { McpError, McpErrorCode } from "../../errors";
import logger from "@/lib/logger";

interface InvocationData {
  userId: string;
  sessionId?: string;
  tool: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  isError: boolean;
  error?: string;
  parentInvocationId?: string;
}

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("tool-helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getVaultSecret", () => {
    it("should return decrypted secret when found and approved", async () => {
      mockPrisma.vaultSecret.findFirst.mockResolvedValue({
        encryptedValue: "enc",
        iv: "iv",
        tag: "tag",
      });
      mockDecryptSecret.mockReturnValue("plaintext");

      const result = await getVaultSecret("user-1", "my-secret");

      expect(result).toBe("plaintext");
      expect(mockPrisma.vaultSecret.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-1", name: "my-secret", status: "APPROVED" },
      });
      expect(mockDecryptSecret).toHaveBeenCalledWith(
        "user-1",
        "enc",
        "iv",
        "tag",
      );
    });

    it("should return undefined when secret not found", async () => {
      mockPrisma.vaultSecret.findFirst.mockResolvedValue(null);

      const result = await getVaultSecret("user-1", "missing");

      expect(result).toBeUndefined();
    });

    it("should return undefined and log error when decryption fails", async () => {
      mockPrisma.vaultSecret.findFirst.mockResolvedValue({
        encryptedValue: "enc",
        iv: "iv",
        tag: "tag",
      });
      mockDecryptSecret.mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      const result = await getVaultSecret("user-1", "bad-secret");

      expect(result).toBeUndefined();
    });
  });

  describe("textResult", () => {
    it("should format a simple text result", () => {
      const result = textResult("Hello world");
      expect(result).toEqual({
        content: [{ type: "text", text: "Hello world" }],
      });
    });
  });

  describe("safeToolCall", () => {
    it("should return handler result on success", async () => {
      const result = await safeToolCall("test_tool", async () => ({
        content: [{ type: "text" as const, text: "success" }],
      }));

      expect(result.content[0]).toEqual(
        expect.objectContaining({ text: "success" }),
      );
      expect(result.isError).toBeUndefined();
    });

    it("should classify McpError with proper code", async () => {
      const result = await safeToolCall("test_tool", async () => {
        throw new McpError("Not found", McpErrorCode.APP_NOT_FOUND, false);
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("APP_NOT_FOUND");
      expect(text).toContain("Suggestion:");
      expect(text).toContain("Retryable:** false");
    });

    it("should classify generic not-found errors for apps_ tools", async () => {
      const result = await safeToolCall("apps_get", async () => {
        throw new Error("Resource not found");
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("APP_NOT_FOUND");
    });

    it("should classify generic not-found errors for non-apps tools", async () => {
      const result = await safeToolCall("workspace_list", async () => {
        throw new Error("not found");
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("WORKSPACE_NOT_FOUND");
    });

    it("should classify unauthorized errors", async () => {
      const result = await safeToolCall("test_tool", async () => {
        throw new Error("Unauthorized access");
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("PERMISSION_DENIED");
    });

    it("should classify forbidden errors", async () => {
      const result = await safeToolCall("test_tool", async () => {
        throw new Error("403 Forbidden");
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("PERMISSION_DENIED");
    });

    it("should classify conflict errors", async () => {
      const result = await safeToolCall("test_tool", async () => {
        throw new Error("Name already exists");
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("CONFLICT");
    });

    it("should classify validation errors", async () => {
      const result = await safeToolCall("test_tool", async () => {
        throw new Error("Validation failed: invalid input");
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("VALIDATION_ERROR");
    });

    it("should classify rate limit errors", async () => {
      const result = await safeToolCall("test_tool", async () => {
        throw new Error("Rate limit exceeded, too many requests");
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("RATE_LIMITED");
      expect(text).toContain("Retryable:** true");
    });

    it("should classify insufficient credits errors", async () => {
      const result = await safeToolCall("test_tool", async () => {
        throw new Error("Insufficient credits");
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("INSUFFICIENT_CREDITS");
    });

    it("should classify unknown errors", async () => {
      const result = await safeToolCall("test_tool", async () => {
        throw new Error("something weird happened");
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("UNKNOWN");
      expect(text).toContain("Retryable:** true");
    });

    it("should handle non-Error thrown values", async () => {
      const result = await safeToolCall("test_tool", async () => {
        throw "string error";
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("Unknown error");
    });

    it("should record successful invocation when userId is provided", async () => {
      mockPrisma.toolInvocation.create.mockResolvedValue({ id: "inv-1" });

      const result = await safeToolCall(
        "test_tool",
        async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
        { userId: "user-1", sessionId: "sess-1", input: { key: "value" } },
      );

      expect(result.content[0]).toEqual(
        expect.objectContaining({ text: "ok" }),
      );

      // Wait for fire-and-forget recording
      await vi.waitFor(() => {
        expect(mockPrisma.toolInvocation.create).toHaveBeenCalledTimes(1);
      });

      const call = mockPrisma.toolInvocation.create.mock.calls[0]![0] as {
        data: InvocationData;
      };
      expect(call.data.userId).toBe("user-1");
      expect(call.data.sessionId).toBe("sess-1");
      expect(call.data.tool).toBe("test_tool");
      expect(call.data.input).toEqual({ key: "value" });
      expect(call.data.isError).toBe(false);
      expect(call.data.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should record failed invocation when userId is provided", async () => {
      mockPrisma.toolInvocation.create.mockResolvedValue({ id: "inv-2" });

      const result = await safeToolCall(
        "test_tool",
        async () => {
          throw new Error("something broke");
        },
        { userId: "user-1", input: { query: "test" } },
      );

      expect(result.isError).toBe(true);

      // Wait for fire-and-forget recording
      await vi.waitFor(() => {
        expect(mockPrisma.toolInvocation.create).toHaveBeenCalledTimes(1);
      });

      const call = mockPrisma.toolInvocation.create.mock.calls[0]![0] as {
        data: InvocationData;
      };
      expect(call.data.userId).toBe("user-1");
      expect(call.data.tool).toBe("test_tool");
      expect(call.data.isError).toBe(true);
      expect(call.data.error).toBe("something broke");
      expect(call.data.output).toBeUndefined();
    });

    it("should not break tool execution when recording fails", async () => {
      mockPrisma.toolInvocation.create.mockRejectedValue(new Error("DB down"));
      const loggerErrorSpy = vi.spyOn(logger, "error").mockImplementation(
        ((_msg: string, _err?: unknown) => {}) as (message: string, error?: unknown) => void,
      );

      const result = await safeToolCall(
        "test_tool",
        async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
        { userId: "user-1" },
      );

      expect(result.content[0]).toEqual(
        expect.objectContaining({ text: "ok" }),
      );
      expect(result.isError).toBeUndefined();

      // Wait for fire-and-forget to settle
      await vi.waitFor(() => {
        expect(loggerErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Failed to record tool invocation"),
          expect.objectContaining({ error: expect.any(Error) }),
        );
      });

      loggerErrorSpy.mockRestore();
    });

    it("should not break tool error handling when recording of failure itself fails", async () => {
      mockPrisma.toolInvocation.create.mockRejectedValue(new Error("DB down"));
      const loggerErrorSpy = vi.spyOn(logger, "error").mockImplementation(
        ((_msg: string, _err?: unknown) => {}) as (message: string, error?: unknown) => void,
      );

      const result = await safeToolCall(
        "test_tool",
        async () => {
          throw new Error("tool failed");
        },
        { userId: "user-1" },
      );

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("UNKNOWN");

      await vi.waitFor(() => {
        expect(loggerErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Failed to record tool invocation"),
          expect.objectContaining({ error: expect.any(Error) }),
        );
      });

      loggerErrorSpy.mockRestore();
    });

    it("should not record invocation when userId is not provided", async () => {
      await safeToolCall(
        "test_tool",
        async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
      );

      expect(mockPrisma.toolInvocation.create).not.toHaveBeenCalled();
    });

    it("should calculate duration correctly", async () => {
      mockPrisma.toolInvocation.create.mockResolvedValue({ id: "inv-3" });

      await safeToolCall(
        "slow_tool",
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { content: [{ type: "text" as const, text: "done" }] };
        },
        { userId: "user-1" },
      );

      await vi.waitFor(() => {
        expect(mockPrisma.toolInvocation.create).toHaveBeenCalledTimes(1);
      });

      const call = mockPrisma.toolInvocation.create.mock.calls[0]![0] as {
        data: InvocationData;
      };
      expect(call.data.durationMs).toBeGreaterThanOrEqual(40);
    });

    it("should pass parentInvocationId when provided", async () => {
      mockPrisma.toolInvocation.create.mockResolvedValue({ id: "inv-4" });

      await safeToolCall(
        "child_tool",
        async () => ({ content: [{ type: "text" as const, text: "child" }] }),
        { userId: "user-1", parentInvocationId: "parent-inv-1" },
      );

      await vi.waitFor(() => {
        expect(mockPrisma.toolInvocation.create).toHaveBeenCalledTimes(1);
      });

      const call = mockPrisma.toolInvocation.create.mock.calls[0]![0] as {
        data: InvocationData;
      };
      expect(call.data.parentInvocationId).toBe("parent-inv-1");
    });
  });

  describe("safeToolCall timeout", () => {
    it("should trigger error when handler exceeds timeoutMs", async () => {
      const result = await safeToolCall(
        "slow_tool",
        async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return {
            content: [{ type: "text" as const, text: "should not reach" }],
          };
        },
        { timeoutMs: 50 },
      );

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("timed out");
    });

    it("should return normal result when handler completes within timeout", async () => {
      const result = await safeToolCall(
        "fast_tool",
        async () => ({
          content: [{ type: "text" as const, text: "fast result" }],
        }),
        { timeoutMs: 5000 },
      );

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string; }).text).toBe("fast result");
    });
  });

  describe("textResult truncation", () => {
    it("should truncate text exceeding 8KB", () => {
      const longText = "x".repeat(10000);
      const result = textResult(longText);
      const text = (result.content[0] as { text: string; }).text;
      expect(text.length).toBeLessThan(10000);
      expect(text).toContain("truncated, response exceeded 8KB");
    });

    it("should pass through short text unchanged", () => {
      const shortText = "Hello world";
      const result = textResult(shortText);
      expect((result.content[0] as { text: string; }).text).toBe("Hello world");
    });
  });

  describe("resolveWorkspace", () => {
    it("should return workspace when found", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue({
        id: "ws-1",
        slug: "my-workspace",
        name: "My Workspace",
      });

      const result = await resolveWorkspace("user-1", "my-workspace");

      expect(result).toEqual({
        id: "ws-1",
        slug: "my-workspace",
        name: "My Workspace",
      });
      expect(mockPrisma.workspace.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            slug: "my-workspace",
            members: { some: { userId: "user-1" } },
          },
          select: expect.objectContaining({
            id: true,
            slug: true,
            name: true,
            subscriptionTier: true,
          }),
        }),
      );
    });

    it("should throw McpError when workspace not found", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue(null);

      await expect(
        resolveWorkspace("user-1", "nonexistent"),
      ).rejects.toThrow(McpError);

      try {
        await resolveWorkspace("user-1", "nonexistent");
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(McpErrorCode.WORKSPACE_NOT_FOUND);
      }
    });
  });

  describe("apiRequest", () => {
    it("should make successful request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "123", name: "Test" }),
      });

      const result = await apiRequest<{ id: string; name: string; }>(
        "/api/test",
      );

      expect(result).toEqual({ id: "123", name: "Test" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/test"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should throw McpError on 404", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ error: "Not found" })),
      });

      await expect(apiRequest("/api/test")).rejects.toThrow(McpError);

      try {
        await apiRequest("/api/test");
      } catch (error) {
        expect((error as McpError).code).toBe(McpErrorCode.APP_NOT_FOUND);
      }
    });

    it("should throw McpError on 403", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      });

      await expect(apiRequest("/api/test")).rejects.toThrow(McpError);

      try {
        await apiRequest("/api/test");
      } catch (error) {
        expect((error as McpError).code).toBe(McpErrorCode.PERMISSION_DENIED);
      }
    });

    it("should throw McpError on 401", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      await expect(apiRequest("/api/test")).rejects.toThrow(McpError);

      try {
        await apiRequest("/api/test");
      } catch (error) {
        expect((error as McpError).code).toBe(McpErrorCode.PERMISSION_DENIED);
      }
    });

    it("should throw McpError on 409", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        text: () => Promise.resolve(JSON.stringify({ error: "Conflict" })),
      });

      await expect(apiRequest("/api/test")).rejects.toThrow(McpError);

      try {
        await apiRequest("/api/test");
      } catch (error) {
        expect((error as McpError).code).toBe(McpErrorCode.CONFLICT);
      }
    });

    it("should throw McpError on 429", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve("Rate limited"),
      });

      await expect(apiRequest("/api/test")).rejects.toThrow(McpError);

      try {
        await apiRequest("/api/test");
      } catch (error) {
        expect((error as McpError).code).toBe(McpErrorCode.RATE_LIMITED);
        expect((error as McpError).retryable).toBe(true);
      }
    });

    it("should throw McpError on 400", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve(JSON.stringify({ error: "Bad request" })),
      });

      await expect(apiRequest("/api/test")).rejects.toThrow(McpError);

      try {
        await apiRequest("/api/test");
      } catch (error) {
        expect((error as McpError).code).toBe(McpErrorCode.VALIDATION_ERROR);
      }
    });

    it("should throw McpError on 500 as UPSTREAM_SERVICE_ERROR", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal server error"),
      });

      await expect(apiRequest("/api/test")).rejects.toThrow(McpError);

      try {
        await apiRequest("/api/test");
      } catch (error) {
        expect((error as McpError).code).toBe(
          McpErrorCode.UPSTREAM_SERVICE_ERROR,
        );
        expect((error as McpError).retryable).toBe(true);
      }
    });

    it("should handle text() failure gracefully", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error("read error")),
      });

      await expect(apiRequest("/api/test")).rejects.toThrow(McpError);

      try {
        await apiRequest("/api/test");
      } catch (error) {
        expect((error as McpError).message).toBe("Unknown error");
      }
    });

    it("should include Authorization header when service token exists", async () => {
      const original = process.env.SPIKE_LAND_SERVICE_TOKEN;
      process.env.SPIKE_LAND_SERVICE_TOKEN = "test-token";

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiRequest("/api/test");

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>).Authorization).toBe(
        "Bearer test-token",
      );

      if (original === undefined) {
        delete process.env.SPIKE_LAND_SERVICE_TOKEN;
      } else {
        process.env.SPIKE_LAND_SERVICE_TOKEN = original;
      }
    });

    it("should parse JSON error bodies", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ error: "App xyz not found" })),
      });

      try {
        await apiRequest("/api/test");
      } catch (error) {
        expect((error as McpError).message).toBe("App xyz not found");
      }
    });

    it("should handle non-JSON error bodies", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("plain text error"),
      });

      try {
        await apiRequest("/api/test");
      } catch (error) {
        expect((error as McpError).message).toBe("plain text error");
      }
    });

    it("should fall back to raw body when JSON has no error field", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ detail: "not the error key" })),
      });

      try {
        await apiRequest("/api/test");
      } catch (error) {
        // json.error is undefined, so falls back to the raw body string
        expect((error as McpError).message).toBe(
          JSON.stringify({ detail: "not the error key" }),
        );
      }
    });

    it("should fall back to SPIKE_LAND_API_KEY when SPIKE_LAND_SERVICE_TOKEN is not set", async () => {
      const origServiceToken = process.env.SPIKE_LAND_SERVICE_TOKEN;
      const origApiKey = process.env.SPIKE_LAND_API_KEY;
      delete process.env.SPIKE_LAND_SERVICE_TOKEN;
      process.env.SPIKE_LAND_API_KEY = "fallback-api-key";

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiRequest("/api/test");

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>).Authorization).toBe(
        "Bearer fallback-api-key",
      );

      // Restore env
      if (origServiceToken === undefined) {
        delete process.env.SPIKE_LAND_SERVICE_TOKEN;
      } else {
        process.env.SPIKE_LAND_SERVICE_TOKEN = origServiceToken;
      }
      if (origApiKey === undefined) {
        delete process.env.SPIKE_LAND_API_KEY;
      } else {
        process.env.SPIKE_LAND_API_KEY = origApiKey;
      }
    });

    it("should not include Authorization header when no tokens are set", async () => {
      const origServiceToken = process.env.SPIKE_LAND_SERVICE_TOKEN;
      const origApiKey = process.env.SPIKE_LAND_API_KEY;
      delete process.env.SPIKE_LAND_SERVICE_TOKEN;
      delete process.env.SPIKE_LAND_API_KEY;

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiRequest("/api/test");

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>).Authorization)
        .toBeUndefined();

      // Restore env
      if (origServiceToken !== undefined) {
        process.env.SPIKE_LAND_SERVICE_TOKEN = origServiceToken;
      }
      if (origApiKey !== undefined) {
        process.env.SPIKE_LAND_API_KEY = origApiKey;
      }
    });

    it("should pass custom options through to fetch", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
      });

      await apiRequest("/api/test", {
        method: "POST",
        body: JSON.stringify({ key: "value" }),
      });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(options.method).toBe("POST");
      expect(options.body).toBe(JSON.stringify({ key: "value" }));
    });
  });

  describe("edge cases", () => {
    it("should use explicit name in safeToolCall", async () => {
      const handler = vi.fn().mockResolvedValue({ content: [] });
      await safeToolCall("explicit-name", handler);
      expect(handler).toHaveBeenCalled();
    });

    it("should handle error during recordToolInvocation when already in error state", async () => {
      const loggerErrorSpy = vi.spyOn(logger, "error").mockImplementation(
        ((_msg: string, _err?: unknown) => {}) as (message: string, error?: unknown) => void,
      );
      const handler = vi.fn().mockRejectedValue(new Error("handler-fail"));
      mockPrisma.toolInvocation.create.mockRejectedValue(new Error("db-fail"));

      const result = await safeToolCall("test", handler, { userId: "user-1" });

      await vi.waitFor(() => {
        expect(loggerErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Failed to record tool invocation"),
          expect.objectContaining({ error: expect.any(Error) }),
        );
      });
      expect(result.isError).toBe(true);
      loggerErrorSpy.mockRestore();
    });
  });
});
