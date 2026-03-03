import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockMcpServerInstance, mockRegistryInstance, mockRegisterAllTools } = vi
  .hoisted(() => ({
    mockRegistryInstance: {} as Record<string, unknown>,
    mockMcpServerInstance: {
      registerTool: vi.fn().mockReturnValue({
        enabled: true,
        enable: vi.fn(),
        disable: vi.fn(),
      }),
    },
    mockRegisterAllTools: vi.fn(),
  }));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  const MockMcpServer = vi.fn(function McpServer() {
    return mockMcpServerInstance;
  });
  return { McpServer: MockMcpServer };
});

vi.mock("./tool-registry", () => {
  const MockToolRegistry = vi.fn(function ToolRegistry() {
    return mockRegistryInstance;
  });
  return { ToolRegistry: MockToolRegistry };
});

vi.mock("./capability-filtered-registry", () => {
  const MockCapabilityFilteredRegistry = vi.fn(
    function CapabilityFilteredRegistry() {
      return mockRegistryInstance;
    },
  );
  return { CapabilityFilteredRegistry: MockCapabilityFilteredRegistry };
});

vi.mock("./tool-manifest", () => ({
  registerAllTools: mockRegisterAllTools,
}));

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolRegistry } from "./tool-registry";
import { CapabilityFilteredRegistry } from "./capability-filtered-registry";
import { createMcpServer } from "./mcp-server";

describe("createMcpServer", () => {
  const userId = "test-user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create McpServer with correct name, version, and capabilities", () => {
    createMcpServer(userId);

    expect(McpServer).toHaveBeenCalledWith(
      { name: "spike-land", version: "1.0.0" },
      { capabilities: { tools: { listChanged: true } } },
    );
  });

  it("should create a ToolRegistry with the McpServer instance", () => {
    createMcpServer(userId);

    expect(ToolRegistry).toHaveBeenCalledWith(mockMcpServerInstance, userId);
  });

  it("should return the McpServer instance", () => {
    const result = createMcpServer(userId);

    expect(result).toBe(mockMcpServerInstance);
  });

  it("should call registerAllTools with registry and userId", () => {
    createMcpServer(userId);

    expect(mockRegisterAllTools).toHaveBeenCalledWith(
      mockRegistryInstance,
      userId,
    );
  });

  it("should create CapabilityFilteredRegistry when capabilityTokenId is provided", () => {
    createMcpServer(userId, {
      capabilityTokenId: "cap-token-123",
      agentId: "agent-456",
    });

    expect(CapabilityFilteredRegistry).toHaveBeenCalledWith(
      mockMcpServerInstance,
      "cap-token-123",
      "agent-456",
      userId,
    );
    expect(mockRegisterAllTools).toHaveBeenCalledWith(
      mockRegistryInstance,
      userId,
    );
  });

  it("should use empty string for agentId when not provided with capabilityTokenId", () => {
    createMcpServer(userId, { capabilityTokenId: "cap-token-123" });

    expect(CapabilityFilteredRegistry).toHaveBeenCalledWith(
      mockMcpServerInstance,
      "cap-token-123",
      "",
      userId,
    );
  });

  it("should use ToolRegistry when no capabilityTokenId", () => {
    createMcpServer(userId);

    expect(ToolRegistry).toHaveBeenCalledWith(mockMcpServerInstance, userId);
    expect(CapabilityFilteredRegistry).not.toHaveBeenCalled();
  });
});
