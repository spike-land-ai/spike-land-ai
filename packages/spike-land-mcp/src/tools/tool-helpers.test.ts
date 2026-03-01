/**
 * Tests for tool-helpers.ts
 *
 * Covers: McpError, classifyError (via safeToolCall), textResult, jsonResult, apiRequest,
 * resolveWorkspace, and getVaultSecret.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  McpError,
  McpErrorCode,
  MCP_ERROR_MESSAGES,
  MCP_ERROR_RETRYABLE,
  safeToolCall,
  textResult,
  jsonResult,
  apiRequest,
  resolveWorkspace,
  getVaultSecret,
  SPIKE_LAND_BASE_URL,
} from "./tool-helpers";
import { createMockD1 } from "../__test-utils__/mock-env";
import { createDb } from "../db/index";

// ─── McpError ────────────────────────────────────────────────────────────────

describe("McpError", () => {
  it("stores code, message, and uses retryable from map when not provided", () => {
    const err = new McpError("something timed out", McpErrorCode.TIMEOUT);
    expect(err.message).toBe("something timed out");
    expect(err.code).toBe(McpErrorCode.TIMEOUT);
    expect(err.retryable).toBe(MCP_ERROR_RETRYABLE[McpErrorCode.TIMEOUT]);
    expect(err.name).toBe("McpError");
  });

  it("accepts explicit retryable override", () => {
    const err = new McpError("force retryable", McpErrorCode.PERMISSION_DENIED, true);
    expect(err.retryable).toBe(true);
  });

  it("stores cause when provided", () => {
    const cause = new Error("root cause");
    const err = new McpError("wrapped", McpErrorCode.UNKNOWN, false, cause);
    expect(err.cause).toBe(cause);
  });

  it("getUserMessage returns localized message", () => {
    const err = new McpError("raw", McpErrorCode.RATE_LIMITED);
    expect(err.getUserMessage()).toBe(MCP_ERROR_MESSAGES[McpErrorCode.RATE_LIMITED]);
  });
});

// ─── MCP_ERROR_MESSAGES coverage ─────────────────────────────────────────────

describe("MCP_ERROR_MESSAGES", () => {
  it("has an entry for every McpErrorCode", () => {
    for (const code of Object.values(McpErrorCode)) {
      expect(MCP_ERROR_MESSAGES[code]).toBeTruthy();
    }
  });
});

// ─── safeToolCall ─────────────────────────────────────────────────────────────

describe("safeToolCall", () => {
  it("returns handler result on success", async () => {
    const result = await safeToolCall("my_tool", async () =>
      ({ content: [{ type: "text" as const, text: "ok" }] }));
    expect(result.isError).toBeUndefined();
    expect(result.content[0]).toEqual({ type: "text", text: "ok" });
  });

  it("catches thrown McpError and returns structured error", async () => {
    const result = await safeToolCall("my_tool", async () => {
      throw new McpError("denied", McpErrorCode.PERMISSION_DENIED);
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("PERMISSION_DENIED");
    expect(text).toContain("denied");
  });

  it("catches generic Error and classifies as UNKNOWN", async () => {
    const result = await safeToolCall("my_tool", async () => {
      throw new Error("something exploded");
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("UNKNOWN");
  });

  it("classifies 404-containing error as WORKSPACE_NOT_FOUND for non-app tools", async () => {
    const result = await safeToolCall("workspace_get", async () => {
      throw new Error("Resource not found 404");
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("WORKSPACE_NOT_FOUND");
  });

  it("classifies 404-containing error as APP_NOT_FOUND for apps_ tools", async () => {
    const result = await safeToolCall("apps_get", async () => {
      throw new Error("not found");
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("APP_NOT_FOUND");
  });

  it("classifies rate-limit error as RATE_LIMITED", async () => {
    const result = await safeToolCall("my_tool", async () => {
      throw new Error("Too many requests 429");
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("RATE_LIMITED");
  });

  it("classifies conflict error as CONFLICT", async () => {
    const result = await safeToolCall("my_tool", async () => {
      throw new Error("Already exists 409 conflict");
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("CONFLICT");
  });

  it("classifies unauthorized error as PERMISSION_DENIED", async () => {
    const result = await safeToolCall("my_tool", async () => {
      throw new Error("Unauthorized access 401");
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("PERMISSION_DENIED");
  });

  it("classifies validation error as VALIDATION_ERROR", async () => {
    const result = await safeToolCall("my_tool", async () => {
      throw new Error("Validation failed invalid input");
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("VALIDATION_ERROR");
  });

  it("classifies insufficient credits error as INSUFFICIENT_CREDITS", async () => {
    const result = await safeToolCall("my_tool", async () => {
      throw new Error("Insufficient credits in balance");
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("INSUFFICIENT_CREDITS");
  });

  it("classifies sm_ tool 404 as INVALID_INPUT", async () => {
    const result = await safeToolCall("sm_get", async () => {
      throw new Error("Machine not found");
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("INVALID_INPUT");
  });

  it("respects timeoutMs and returns UNKNOWN on timeout", async () => {
    const result = await safeToolCall(
      "slow_tool",
      async () =>
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timed out after")), 500)
        ),
      { timeoutMs: 50 },
    );
    expect(result.isError).toBe(true);
  });
});

// ─── textResult ──────────────────────────────────────────────────────────────

describe("textResult", () => {
  it("returns content with text type", () => {
    const result = textResult("hello world");
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({ type: "text", text: "hello world" });
  });

  it("truncates text longer than 8192 bytes", () => {
    const longText = "a".repeat(9000);
    const result = textResult(longText);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text.length).toBeLessThan(longText.length);
    expect(text).toContain("truncated");
  });

  it("does not truncate text at exactly 8192 bytes", () => {
    const text = "b".repeat(8192);
    const result = textResult(text);
    expect((result.content[0] as { type: string; text: string }).text).toBe(text);
  });
});

// ─── jsonResult ───────────────────────────────────────────────────────────────

describe("jsonResult", () => {
  it("returns two content parts: text label and JSON", () => {
    const data = { count: 42, items: ["a", "b"] };
    const result = jsonResult("Found items", data);
    expect(result.content).toHaveLength(2);
    expect(result.content[0]).toEqual({ type: "text", text: "Found items" });
    const json = JSON.parse((result.content[1] as { type: string; text: string }).text);
    expect(json).toEqual(data);
  });
});

// ─── apiRequest ───────────────────────────────────────────────────────────────

describe("apiRequest", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses SPIKE_LAND_BASE_URL as base", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: "ok" }),
    } as Response);

    await apiRequest("/api/test");
    expect(mockFetch).toHaveBeenCalledWith(
      `${SPIKE_LAND_BASE_URL}/api/test`,
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
  });

  it("adds Authorization header when token provided", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiRequest("/api/secure", {}, "my-token");
    const [, options] = mockFetch.mock.calls[0]!;
    expect((options as RequestInit & { headers: Record<string, string> }).headers.Authorization)
      .toBe("Bearer my-token");
  });

  it("throws McpError with PERMISSION_DENIED on 401", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "Unauthorized" }),
    } as Response);

    await expect(apiRequest("/api/secure")).rejects.toBeInstanceOf(McpError);
    const caught = await apiRequest("/api/secure").catch(e => e as McpError);
    expect(caught.code).toBe(McpErrorCode.PERMISSION_DENIED);
  });

  it("throws McpError with PERMISSION_DENIED on 403", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    } as Response);

    const err = await apiRequest("/api/secure").catch(e => e as McpError);
    expect(err.code).toBe(McpErrorCode.PERMISSION_DENIED);
    expect(err.retryable).toBe(false);
  });

  it("throws McpError with CONFLICT on 409", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      text: async () => "Conflict",
    } as Response);

    const err = await apiRequest("/api/resource").catch(e => e as McpError);
    expect(err.code).toBe(McpErrorCode.CONFLICT);
  });

  it("throws McpError with RATE_LIMITED on 429", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Too Many Requests",
    } as Response);

    const err = await apiRequest("/api/resource").catch(e => e as McpError);
    expect(err.code).toBe(McpErrorCode.RATE_LIMITED);
    expect(err.retryable).toBe(true);
  });

  it("throws McpError with VALIDATION_ERROR on 400", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    } as Response);

    const err = await apiRequest("/api/resource").catch(e => e as McpError);
    expect(err.code).toBe(McpErrorCode.VALIDATION_ERROR);
  });

  it("throws McpError with UPSTREAM_SERVICE_ERROR on 404", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "Not Found",
    } as Response);

    const err = await apiRequest("/api/resource").catch(e => e as McpError);
    expect(err.code).toBe(McpErrorCode.UPSTREAM_SERVICE_ERROR);
    expect(err.retryable).toBe(false);
  });

  it("throws McpError with UPSTREAM_SERVICE_ERROR on 500", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as Response);

    const err = await apiRequest("/api/resource").catch(e => e as McpError);
    expect(err.code).toBe(McpErrorCode.UPSTREAM_SERVICE_ERROR);
    expect(err.retryable).toBe(true);
  });

  it("returns JSON response on success", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: "data" }),
    } as Response);

    const result = await apiRequest<{ result: string }>("/api/data");
    expect(result.result).toBe("data");
  });
});

// ─── resolveWorkspace ────────────────────────────────────────────────────────

describe("resolveWorkspace", () => {
  it("throws McpError with WORKSPACE_NOT_FOUND when no results returned", async () => {
    const db = createDb(
      createMockD1(() => ({ results: [], success: true, meta: {} })),
    );

    await expect(resolveWorkspace(db, "user-1", "unknown-workspace"))
      .rejects.toBeInstanceOf(McpError);

    try {
      await resolveWorkspace(db, "user-1", "unknown-workspace");
    } catch (e) {
      const err = e as McpError;
      expect(err.code).toBe(McpErrorCode.WORKSPACE_NOT_FOUND);
      expect(err.retryable).toBe(false);
      expect(err.message).toContain("unknown-workspace");
    }
  });

  it("throws McpError when workspace slug is in error message", async () => {
    const db = createDb(
      createMockD1(() => ({ results: [], success: true, meta: {} })),
    );

    try {
      await resolveWorkspace(db, "user-1", "my-project");
    } catch (e) {
      const err = e as McpError;
      expect(err.message).toContain("my-project");
    }
  });
});

// ─── getVaultSecret ───────────────────────────────────────────────────────────

describe("getVaultSecret", () => {
  it("returns undefined when secret not found in db", async () => {
    const db = createDb(
      createMockD1(() => ({ results: [], success: true, meta: {} })),
    );

    const result = await getVaultSecret(db, "user-1", "MY_SECRET");
    expect(result).toBeUndefined();
  });

  it("returns undefined and logs on malformed encrypted value", async () => {
    // drizzle-orm selects encryptedValue which maps to "encrypted_value" column
    const db = createDb(
      createMockD1(() => ({
        results: [{ encrypted_value: "bm90LXZhbGlkLWJhc2U2NC1qc29uISE=" }],
        success: true,
        meta: {},
      })),
    );

    const result = await getVaultSecret(db, "user-1", "MY_SECRET");
    expect(result).toBeUndefined();
  });

  it("returns undefined when db returns no rows for the key", async () => {
    // Different key name — still no results
    const db = createDb(
      createMockD1((sql) => {
        if (sql.includes("vault_secrets")) {
          return { results: [], success: true, meta: {} };
        }
        return { results: [], success: true, meta: {} };
      }),
    );
    const result = await getVaultSecret(db, "user-2", "NONEXISTENT_KEY");
    expect(result).toBeUndefined();
  });
});
