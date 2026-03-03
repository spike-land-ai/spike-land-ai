import { beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted() for mock functions referenced inside vi.mock() factories
const mockGatewayRegister = vi.hoisted(() => vi.fn());
const mockChessGameRegister = vi.hoisted(() => vi.fn());
const mockChessPlayerRegister = vi.hoisted(() => vi.fn());

// Mock classes — must be actual classes so `new` works in production code
const MockMcpServer = vi.hoisted(() => {
  const cls = vi.fn();
  cls.prototype.connect = vi.fn();
  cls.prototype.close = vi.fn();
  return cls;
});
vi.mock(
  "@modelcontextprotocol/sdk/server/mcp.js",
  () => ({ McpServer: MockMcpServer }),
);

const MockToolRegistry = vi.hoisted(() => {
  const cls = vi.fn();
  cls.prototype.register = vi.fn();
  cls.prototype.searchTools = vi.fn();
  cls.prototype.listCategories = vi.fn();
  return cls;
});
vi.mock("./tool-registry", () => ({ ToolRegistry: MockToolRegistry }));

const MockCapabilityFilteredRegistry = vi.hoisted(() => {
  const cls = vi.fn();
  cls.prototype.register = vi.fn();
  cls.prototype.searchTools = vi.fn();
  cls.prototype.listCategories = vi.fn();
  return cls;
});
vi.mock(
  "./capability-filtered-registry",
  () => ({ CapabilityFilteredRegistry: MockCapabilityFilteredRegistry }),
);

vi.mock("./tools/gateway-meta", () => ({
  registerGatewayMetaTools: mockGatewayRegister,
}));

vi.mock("./app-tool-resolver", () => ({
  getToolModulesForApp: vi.fn(),
}));

vi.mock("@/app/store/data/store-apps", () => ({
  getAppBySlug: (slug: string) => {
    if (slug === "chess-arena") {
      return { slug: "chess-arena", version: "2.0.0", mcpTools: [] };
    }
    if (slug === "empty-app") return { slug: "empty-app", mcpTools: [] };
    return undefined;
  },
}));

import { createAppMcpServer } from "./app-mcp-server";
import { getToolModulesForApp } from "./app-tool-resolver";

describe("createAppMcpServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getToolModulesForApp).mockImplementation((slug: string) => {
      if (slug === "chess-arena") {
        return [
          { register: mockChessGameRegister, categories: ["chess-game"] },
          { register: mockChessPlayerRegister, categories: ["chess-player"] },
        ] as any;
      }
      if (slug === "empty-app") return [];
      return [];
    });
  });

  it("throws for unknown app slug", () => {
    expect(() => createAppMcpServer("nonexistent", "user-1")).toThrow(
      "Unknown app: nonexistent",
    );
  });

  it("creates server with app-specific name", () => {
    createAppMcpServer("chess-arena", "user-1");
    expect(MockMcpServer).toHaveBeenCalledWith(
      { name: "spike-land-chess-arena", version: "2.0.0" },
      { capabilities: { tools: { listChanged: true } } },
    );
  });

  it("registers gateway-meta tools", () => {
    createAppMcpServer("chess-arena", "user-1");
    expect(mockGatewayRegister).toHaveBeenCalled();
  });

  it("registers app-specific tool modules", () => {
    createAppMcpServer("chess-arena", "user-1");
    expect(mockChessGameRegister).toHaveBeenCalled();
    expect(mockChessPlayerRegister).toHaveBeenCalled();
  });

  it("handles app with no tools gracefully", () => {
    const server = createAppMcpServer("empty-app", "user-1");
    expect(server).toBeDefined();
    expect(mockGatewayRegister).toHaveBeenCalled();
  });

  it("skips app tools when condition is not met", () => {
    const mockRegister = vi.fn();
    const mockCondition = vi.fn().mockReturnValue(false);

    // Override the mock implementation for this test
    vi.mocked(getToolModulesForApp).mockImplementationOnce(() =>
      [
        { register: mockRegister, condition: mockCondition },
      ] as any
    );

    createAppMcpServer("chess-arena", "user-1");
    expect(mockCondition).toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
  });
});
