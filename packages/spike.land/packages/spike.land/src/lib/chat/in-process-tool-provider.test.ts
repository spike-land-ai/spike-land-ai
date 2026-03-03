import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before imports
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    skillUsageEvent: { create: vi.fn() },
  },
  __esModule: true,
}));

vi.mock("@/lib/tracking/google-analytics", () => ({
  trackServerEvent: vi.fn(),
}));

const mockRegisterAllTools = vi.fn();
vi.mock("@/lib/mcp/server/tool-manifest", () => ({
  registerAllTools: (...args: unknown[]) => mockRegisterAllTools(...args),
}));

// Import after mocks
const { InProcessToolProvider } = await import("./in-process-tool-provider");

describe("InProcessToolProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: registerAllTools registers a couple of test tools
    mockRegisterAllTools.mockImplementation(
      (registry: { register: (def: Record<string, unknown>) => void; }) => {
        registry.register({
          name: "test_tool",
          description: "A test tool",
          category: "test",
          tier: "free",
          alwaysEnabled: true,
          inputSchema: { query: { _def: {} } },
          handler: async () => ({
            content: [{ type: "text", text: "test result" }],
          }),
        });
        registry.register({
          name: "another_tool",
          description: "Another test tool",
          category: "other",
          tier: "free",
          handler: async () => ({
            content: [{ type: "text", text: "another result" }],
          }),
        });
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create an instance and register tools", () => {
    const provider = new InProcessToolProvider("test-user");
    expect(provider).toBeDefined();
    expect(mockRegisterAllTools).toHaveBeenCalledOnce();
  });

  it("getAllTools returns NamespacedTool[] with correct shape", () => {
    const provider = new InProcessToolProvider("test-user");
    const tools = provider.getAllTools();

    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool).toHaveProperty("namespacedName");
      expect(tool).toHaveProperty("originalName");
      expect(tool).toHaveProperty("serverName", "in-process");
      expect(tool).toHaveProperty("inputSchema");
      expect(typeof tool.namespacedName).toBe("string");
    }
  });

  it("getAllTools caches results on second call", () => {
    const provider = new InProcessToolProvider("test-user");
    const tools1 = provider.getAllTools();
    const tools2 = provider.getAllTools();
    expect(tools1).toBe(tools2); // Same reference = cached
  });

  it("callTool returns result for known tool", async () => {
    mockRegisterAllTools.mockImplementation(
      (registry: { register: (def: Record<string, unknown>) => void; }) => {
        registry.register({
          name: "echo_tool",
          description: "Echo input",
          category: "test",
          tier: "free",
          alwaysEnabled: true,
          handler: async (input: { text: string; }) => ({
            content: [{ type: "text", text: `Echo: ${input.text}` }],
          }),
        });
      },
    );

    const provider = new InProcessToolProvider("test-user");
    const result = await provider.callTool("echo_tool", { text: "hello" });

    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({
      type: "text",
      text: "Echo: hello",
    });
  });

  it("callTool returns error for unknown tool", async () => {
    const provider = new InProcessToolProvider("test-user");
    const result = await provider.callTool("nonexistent_tool", {});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Tool not found");
  });

  it("getServerNames returns in-process", () => {
    const provider = new InProcessToolProvider("test-user");
    expect(provider.getServerNames()).toEqual(["in-process"]);
  });

  it("closeAll resolves without error", async () => {
    const provider = new InProcessToolProvider("test-user");
    await expect(provider.closeAll()).resolves.toBeUndefined();
  });

  it("connectAll resolves without error", async () => {
    const provider = new InProcessToolProvider("test-user");
    await expect(provider.connectAll()).resolves.toBeUndefined();
  });
});
