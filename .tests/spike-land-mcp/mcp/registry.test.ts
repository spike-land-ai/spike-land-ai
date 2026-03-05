import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolRegistry, validateSchemaDescriptions, formatExamplesAsDescription, compareSemver } from "../../../src/spike-land-mcp/mcp/registry";
import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function createMockMcpServer(): McpServer {
  return {
    registerTool: vi.fn((_name: string, _config: unknown, handler: unknown): RegisteredTool => {
      let isEnabled = true;
      return {
        enable: () => {
          isEnabled = true;
        },
        disable: () => {
          isEnabled = false;
        },
        get enabled() {
          return isEnabled;
        },
        update: vi.fn(),
        remove: vi.fn(),
        handler: handler as RegisteredTool["handler"],
      };
    }),
  } as unknown as McpServer;
}

describe("validateSchemaDescriptions", () => {
  it("returns empty for undefined schema", () => {
    expect(validateSchemaDescriptions(undefined)).toEqual([]);
  });

  it("returns missing fields", () => {
    const schema = {
      name: z.string().describe("A name"),
      age: z.number(), // missing describe
    };
    const missing = validateSchemaDescriptions(schema);
    expect(missing).toEqual(["age"]);
  });

  it("returns empty when all fields have descriptions", () => {
    const schema = {
      name: z.string().describe("A name"),
      age: z.number().describe("An age"),
    };
    expect(validateSchemaDescriptions(schema)).toEqual([]);
  });
});

describe("compareSemver", () => {
  it("compares basic semver strings correctly", () => {
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemver("1.0.1", "1.0.0")).toBe(1);
    expect(compareSemver("1.0.0", "1.0.1")).toBe(-1);
    expect(compareSemver("2.0.0", "1.9.9")).toBe(1);
    expect(compareSemver("0.9.0", "1.0.0")).toBe(-1);
    expect(compareSemver("1.10.0", "1.2.0")).toBe(1);
  });

  it("ignores pre-release tags for now", () => {
    expect(compareSemver("1.0.0-beta", "1.0.0")).toBe(0);
  });
});

describe("formatExamplesAsDescription", () => {
  it("returns original description if no examples", () => {
    expect(formatExamplesAsDescription("Desc", [])).toBe("Desc");
  });

  it("appends examples block", () => {
    const res = formatExamplesAsDescription("Desc", [
      { name: "ex1", description: "desc1", input: { a: 1 } }
    ]);
    expect(res).toContain("Desc");
    expect(res).toContain("### Examples");
    expect(res).toContain("- **ex1**: desc1");
    expect(res).toContain('{"a":1}');
  });
});

describe("ToolRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a tool and tracks it", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");

    registry.register({
      name: "test_tool",
      description: "A test tool",
      category: "test-cat",
      tier: "free",
      handler: () => ({ content: [{ type: "text" as const, text: "ok" }] }),
    });

    expect(registry.getToolCount()).toBe(1);
    expect(server.registerTool).toHaveBeenCalledOnce();
  });

  it("disables non-alwaysEnabled tools by default", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");

    registry.register({
      name: "test_tool",
      description: "A test tool",
      category: "test-cat",
      tier: "free",
      handler: () => ({ content: [{ type: "text" as const, text: "ok" }] }),
    });

    // Tool should be disabled (not always-enabled)
    expect(registry.getEnabledCount()).toBe(0);
  });

  it("keeps alwaysEnabled tools enabled", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");

    registry.register({
      name: "search_tools",
      description: "Search tools",
      category: "gateway-meta",
      tier: "free",
      alwaysEnabled: true,
      handler: () => ({ content: [{ type: "text" as const, text: "ok" }] }),
    });

    expect(registry.getEnabledCount()).toBe(1);
  });

  it("enableCategory enables all tools in that category", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");

    registry.register({
      name: "tool_a",
      description: "Tool A",
      category: "storage",
      tier: "free",
      handler: () => ({ content: [{ type: "text" as const, text: "a" }] }),
    });
    registry.register({
      name: "tool_b",
      description: "Tool B",
      category: "storage",
      tier: "free",
      handler: () => ({ content: [{ type: "text" as const, text: "b" }] }),
    });

    const enabled = registry.enableCategory("storage");
    expect(enabled).toEqual(["tool_a", "tool_b"]);
    expect(registry.getEnabledCount()).toBe(2);
  });

  it("disableCategory disables tools but not alwaysEnabled ones", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");

    registry.register({
      name: "search_tools",
      description: "Search",
      category: "gateway-meta",
      tier: "free",
      alwaysEnabled: true,
      handler: () => ({ content: [{ type: "text" as const, text: "ok" }] }),
    });
    registry.register({
      name: "tool_a",
      description: "Tool A",
      category: "storage",
      tier: "free",
      handler: () => ({ content: [{ type: "text" as const, text: "a" }] }),
    });

    registry.enableCategory("storage");
    expect(registry.getEnabledCount()).toBe(2);

    registry.disableCategory("storage");
    // search_tools should remain enabled (alwaysEnabled)
    expect(registry.getEnabledCount()).toBe(1);
  });

  it("searchTools finds tools by keyword", async () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");

    registry.register({
      name: "upload_file",
      description: "Upload a file to storage",
      category: "storage",
      tier: "free",
      handler: () => ({ content: [{ type: "text" as const, text: "ok" }] }),
    });

    const results = await registry.searchTools("storage");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.name === "upload_file")).toBe(true);
  });

  it("listCategories returns correct structure", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");

    registry.register({
      name: "tool_a",
      description: "Tool A",
      category: "storage",
      tier: "free",
      handler: () => ({ content: [{ type: "text" as const, text: "a" }] }),
    });

    const categories = registry.listCategories();
    expect(categories).toHaveLength(1);
    expect(categories[0]!.name).toBe("storage");
  });

  it("getEnabledCategories returns only non-gateway enabled categories", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");

    registry.register({
      name: "search_tools",
      description: "Search",
      category: "gateway-meta",
      tier: "free",
      alwaysEnabled: true,
      handler: () => ({ content: [{ type: "text" as const, text: "ok" }] }),
    });
    registry.register({
      name: "tool_a",
      description: "Tool A",
      category: "storage",
      tier: "free",
      handler: () => ({ content: [{ type: "text" as const, text: "a" }] }),
    });

    registry.enableCategory("storage");
    const enabled = registry.getEnabledCategories();
    expect(enabled).toEqual(["storage"]);
    expect(enabled).not.toContain("gateway-meta");
  });

  it("callToolDirect returns error for unknown tool", async () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");

    const result = await registry.callToolDirect("nonexistent", {});
    expect(result.isError).toBe(true);
  });

  it("enableAll enables all tools", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");

    registry.register({
      name: "tool_a",
      description: "A",
      category: "storage",
      tier: "free",
      handler: () => ({ content: [{ type: "text" as const, text: "a" }] }),
    });

    const count = registry.enableAll();
    expect(count).toBe(1);
    expect(registry.getEnabledCount()).toBe(1);
  });

  it("warns when schema fields are missing descriptions", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    registry.register({
      name: "bad_tool",
      description: "No desc",
      category: "test",
      tier: "free",
      inputSchema: {
        field: z.string(), // missing .describe()
      },
      handler: () => ({ content: [] }),
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("handles tools with inputSchema, annotations, and examples", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1", { injectExamples: true });

    registry.register({
      name: "full",
      description: "d",
      category: "c",
      tier: "free",
      inputSchema: { f: z.string().describe("d") },
      annotations: { "mcp.priority": 1 },
      examples: [{ name: "e", input: {}, description: "d" }],
      handler: () => ({ content: [] }),
    });

    expect(server.registerTool).toHaveBeenCalledWith(
      "full",
      expect.objectContaining({
        inputSchema: expect.any(Object),
        annotations: { "mcp.priority": 1 },
        examples: expect.any(Array),
      }),
      expect.any(Function),
    );
  });
  
  it("injects examples into description when injectExamples is true", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1", { injectExamples: true });

    registry.register({
      name: "tool_with_examples",
      description: "Original description",
      category: "test",
      tier: "free",
      examples: [{ name: "ex1", input: {}, description: "An example" }],
      handler: () => ({ content: [] }),
    });

    // The registered description should include "Examples"
    expect(server.registerTool).toHaveBeenCalledWith(
      "tool_with_examples",
      expect.objectContaining({
        description: expect.stringContaining("### Examples"),
      }),
      expect.any(Function),
    );
  });

  it("does not inject examples into description when injectExamples is false", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1", { injectExamples: false });

    registry.register({
      name: "tool_without_injected_examples",
      description: "Original description",
      category: "test",
      tier: "free",
      examples: [{ name: "ex1", input: {}, description: "An example" }],
      handler: () => ({ content: [] }),
    });

    // The registered description should be exactly the original
    expect(server.registerTool).toHaveBeenCalledWith(
      "tool_without_injected_examples",
      expect.objectContaining({
        description: "Original description",
      }),
      expect.any(Function),
    );
  });

  it("hasCategory returns true for registered category", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");
    registry.register({
      name: "t",
      description: "d",
      category: "my-cat",
      tier: "free",
      handler: () => ({ content: [] }),
    });

    expect(registry.hasCategory("my-cat")).toBe(true);
    expect(registry.hasCategory("unknown")).toBe(false);
  });

  it("getToolDefinitions returns all tool info", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");
    registry.register({
      name: "t",
      description: "d",
      category: "c",
      tier: "free",
      handler: () => ({ content: [] }),
    });

    const defs = registry.getToolDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe("t");
    expect(defs[0].enabled).toBe(false); // default
  });

  it("can get examples for a tool", () => {
    const server = createMockMcpServer();
    const registry = new ToolRegistry(server, "user-1");
    registry.register({
      name: "ex_tool",
      description: "d",
      category: "c",
      tier: "free",
      examples: [{ name: "test", description: "test", input: {} }],
      handler: () => ({ content: [] }),
    });

    const examples = registry.getToolExamples("ex_tool");
    expect(examples).toBeDefined();
    expect(examples![0].name).toBe("test");
  });

  describe("Versioning", () => {
    it("registers multiple versions and resolves latest", () => {
      const server = createMockMcpServer();
      const registry = new ToolRegistry(server, "user-1");

      registry.register({
        name: "v_tool",
        description: "v1",
        category: "c",
        tier: "free",
        version: "1.0.0",
        handler: () => ({ content: [{ type: "text", text: "v1" }] }),
      });

      registry.register({
        name: "v_tool",
        description: "v2",
        category: "c",
        tier: "free",
        version: "2.0.0",
        handler: () => ({ content: [{ type: "text", text: "v2" }] }),
      });

      // The latest in the main map should be v2
      const defs = registry.getToolDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].version).toBe("2.0.0");
      
      // Auto-deprecation: v1 should be marked deprecated
      const v1Def = registry.getToolByVersion("v_tool", "1.0.0");
      expect(v1Def?.stability).toBe("deprecated");
    });

    it("does not overwrite latest if older version is registered later", () => {
      const server = createMockMcpServer();
      const registry = new ToolRegistry(server, "user-1");

      registry.register({
        name: "v_tool",
        description: "v2",
        category: "c",
        tier: "free",
        version: "2.0.0",
        handler: () => ({ content: [{ type: "text", text: "v2" }] }),
      });

      registry.register({
        name: "v_tool",
        description: "v1",
        category: "c",
        tier: "free",
        version: "1.0.0",
        handler: () => ({ content: [{ type: "text", text: "v1" }] }),
      });

      // The latest in the main map should still be v2
      const defs = registry.getToolDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].version).toBe("2.0.0");
      
      // The older one can still be accessed via version
      const v1Def = registry.getToolByVersion("v_tool", "1.0.0");
      expect(v1Def?.version).toBe("1.0.0");
    });

    it("listVersions returns sorted list of versions", () => {
      const server = createMockMcpServer();
      const registry = new ToolRegistry(server, "user-1");

      registry.register({ name: "v_tool", description: "v1", category: "c", tier: "free", version: "1.0.0", handler: () => ({ content: [] }) });
      registry.register({ name: "v_tool", description: "v2", category: "c", tier: "free", version: "2.0.0", handler: () => ({ content: [] }) });
      registry.register({ name: "v_tool", description: "v1.5", category: "c", tier: "free", version: "1.5.0", handler: () => ({ content: [] }) });

      const versions = registry.listVersions("v_tool");
      expect(versions).toHaveLength(3);
      expect(versions[0].version).toBe("2.0.0");
      expect(versions[1].version).toBe("1.5.0");
      expect(versions[2].version).toBe("1.0.0");
      expect(versions[2].stability).toBe("deprecated");
    });

    it("can call specific version directly", async () => {
      const server = createMockMcpServer();
      const registry = new ToolRegistry(server, "user-1");

      registry.register({
        name: "v_tool",
        description: "v1",
        category: "c",
        tier: "free",
        version: "1.0.0",
        alwaysEnabled: true,
        handler: () => ({ content: [{ type: "text" as const, text: "v1 response" }] }),
      });

      registry.register({
        name: "v_tool",
        description: "v2",
        category: "c",
        tier: "free",
        version: "2.0.0",
        alwaysEnabled: true,
        handler: () => ({ content: [{ type: "text" as const, text: "v2 response" }] }),
      });

      registry.enableAll();

      const r2 = await registry.callToolDirect("v_tool", {});
      expect(r2.content[0].text).toBe("v2 response");

      const r1 = await registry.callToolDirect("v_tool", {}, undefined, "1.0.0");
      expect(r1.content[0].text).toBe("v1 response");
    });
  });
});