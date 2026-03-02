import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetOrCreateSession = vi.fn();

vi.mock("@/lib/codespace/session-service", () => ({
  getOrCreateSession: (...args: unknown[]) => mockGetOrCreateSession(...args),
  upsertSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/codespace/transpile", () => ({
  transpileCode: vi.fn().mockResolvedValue("transpiled output"),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const { handleMcpRequest, allTools, WRITE_TOOL_NAMES } = await import("./mcp-tools");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleMcpRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrCreateSession.mockResolvedValue({
      code: "const x = 1;",
      codeSpace: "test-cs",
      transpiled: "var x = 1;",
      html: "<div></div>",
      css: "",
      messages: [],
    });
  });

  // -----------------------------------------------------------------------
  // Protocol methods
  // -----------------------------------------------------------------------

  describe("initialize", () => {
    it("should return server info and capabilities", async () => {
      const response = (await handleMcpRequest(
        { jsonrpc: "2.0", id: 1, method: "initialize" },
        "test-cs",
      )) as unknown as {
        jsonrpc: string;
        id: number;
        result: {
          serverInfo: { name: string };
          capabilities: { tools: unknown };
        };
      };

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.serverInfo.name).toBe("spike.land-mcp-server");
      expect(response.result.capabilities.tools).toBeDefined();
    });
  });

  describe("tools/list", () => {
    it("should return all available tools", async () => {
      const response = (await handleMcpRequest(
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
        "test-cs",
      )) as unknown as { result: { tools: unknown[] } };

      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
      expect(response.result.tools.length).toBeGreaterThan(0);
    });
  });

  describe("notifications/initialized", () => {
    it("should return empty success", async () => {
      const response = await handleMcpRequest(
        { jsonrpc: "2.0", id: 3, method: "notifications/initialized" },
        "test-cs",
      );

      expect(response.result).toEqual({});
    });
  });

  describe("unknown method", () => {
    it("should return method not found error", async () => {
      const response = (await handleMcpRequest(
        { jsonrpc: "2.0", id: 4, method: "unknown/method" },
        "test-cs",
      )) as unknown as { error: { code: number } };

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32601);
    });
  });

  // -----------------------------------------------------------------------
  // Tool calls
  // -----------------------------------------------------------------------

  describe("tools/call - read_code", () => {
    it("should return current code", async () => {
      const response = (await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: { name: "read_code", arguments: {} },
        },
        "test-cs",
      )) as unknown as { result: { content: { type: string; text: string }[] } };

      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0]!.type).toBe("text");
      // The result should contain the code
      const text = response.result.content[0]!.text;
      expect(text).toContain("const x = 1;");
    });
  });

  describe("tools/call - read_session", () => {
    it("should return session data", async () => {
      const response = (await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: { name: "read_session", arguments: {} },
        },
        "test-cs",
      )) as unknown as { result: { content: { type: string; text: string }[] } };

      expect(response.result).toBeDefined();
      const text = response.result.content[0]!.text;
      expect(text).toContain("const x = 1;");
      expect(text).toContain("test-cs");
    });
  });

  describe("tools/call - find_lines", () => {
    it("should find matching lines", async () => {
      const response = (await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 7,
          method: "tools/call",
          params: { name: "find_lines", arguments: { pattern: "const" } },
        },
        "test-cs",
      )) as unknown as { result: { content: { type: string; text: string }[] } };

      expect(response.result).toBeDefined();
      const text = response.result.content[0]!.text;
      expect(text).toContain("const");
    });
  });

  describe("tools/call - read_html", () => {
    it("should return current html", async () => {
      const response = (await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 10,
          method: "tools/call",
          params: { name: "read_html", arguments: {} },
        },
        "test-cs",
      )) as unknown as { result: { content: { type: string; text: string }[] } };

      expect(response.result).toBeDefined();
      const text = response.result.content[0]!.text;
      expect(text).toContain("<div></div>");
    });
  });

  describe("tools/call - update_code", () => {
    it("should update code successfully", async () => {
      const response = (await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 11,
          method: "tools/call",
          params: { name: "update_code", arguments: { code: "const y = 2;" } },
        },
        "test-cs",
      )) as unknown as { result: { content: { type: string; text: string }[] } };

      expect(response.result).toBeDefined();
      const text = response.result.content[0]!.text;
      expect(text).toContain("success");
    });

    it("should return error when code param missing", async () => {
      const response = (await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 12,
          method: "tools/call",
          params: { name: "update_code", arguments: {} },
        },
        "test-cs",
      )) as unknown as { error: { code: number } };

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32603);
    });
  });

  describe("tools/call - edit_code", () => {
    it("should return error when edits param missing", async () => {
      const response = (await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 13,
          method: "tools/call",
          params: { name: "edit_code", arguments: {} },
        },
        "test-cs",
      )) as unknown as { error: { code: number } };

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32603);
    });
  });

  describe("tools/call - search_and_replace", () => {
    it("should return error when search param missing", async () => {
      const response = (await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 14,
          method: "tools/call",
          params: { name: "search_and_replace", arguments: { replace: "y" } },
        },
        "test-cs",
      )) as unknown as { error: { code: number } };

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32603);
    });

    it("should return error when replace param missing", async () => {
      const response = (await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 15,
          method: "tools/call",
          params: { name: "search_and_replace", arguments: { search: "x" } },
        },
        "test-cs",
      )) as unknown as { error: { code: number } };

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32603);
    });
  });

  describe("tools/call - find_lines with missing pattern", () => {
    it("should return error when pattern param missing", async () => {
      const response = (await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 16,
          method: "tools/call",
          params: { name: "find_lines", arguments: {} },
        },
        "test-cs",
      )) as unknown as { error: { code: number } };

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32603);
    });
  });

  describe("tools/call - missing tool name", () => {
    it("should return error for missing tool name", async () => {
      const response = (await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 8,
          method: "tools/call",
          params: { arguments: {} },
        },
        "test-cs",
      )) as unknown as { error: { code: number } };

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32603);
    });
  });

  describe("tools/call - unknown tool", () => {
    it("should return error for unknown tool", async () => {
      const response = (await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 9,
          method: "tools/call",
          params: { name: "nonexistent_tool", arguments: {} },
        },
        "test-cs",
      )) as unknown as { error: { code: number } };

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32603);
    });
  });

  describe("tools/call - custom origin", () => {
    it("should accept custom origin parameter", async () => {
      const response = (await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 17,
          method: "tools/call",
          params: { name: "read_code", arguments: {} },
        },
        "test-cs",
        "https://custom-origin.example.com",
      )) as unknown as { result: { content: { type: string; text: string }[] } };

      expect(response.result).toBeDefined();
    });
  });
});

// -----------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------

describe("allTools", () => {
  it("should be an array of tool definitions", () => {
    expect(Array.isArray(allTools)).toBe(true);
    for (const tool of allTools) {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("inputSchema");
    }
  });
});

describe("WRITE_TOOL_NAMES", () => {
  it("should be a Set containing write tool names", () => {
    expect(WRITE_TOOL_NAMES).toBeInstanceOf(Set);
    expect(WRITE_TOOL_NAMES.has("update_code")).toBe(true);
    expect(WRITE_TOOL_NAMES.has("edit_code")).toBe(true);
    expect(WRITE_TOOL_NAMES.has("search_and_replace")).toBe(true);
    // read_code should NOT be a write tool
    expect(WRITE_TOOL_NAMES.has("read_code")).toBe(false);
  });
});
