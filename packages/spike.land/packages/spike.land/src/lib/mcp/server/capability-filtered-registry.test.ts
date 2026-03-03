import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAgentAuditLogCreate = vi.fn();
const mockAgentCapabilityTokenUpdate = vi.fn();

const mockPrisma = {
  agentAuditLog: { create: mockAgentAuditLogCreate },
  agentCapabilityToken: { update: mockAgentCapabilityTokenUpdate },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const mockEvaluateCapability = vi.fn();
const mockCreatePermissionRequest = vi.fn();
vi.mock("./capability-evaluator", () => ({
  evaluateCapability: (...args: unknown[]) => mockEvaluateCapability(...args),
  createPermissionRequest: (...args: unknown[]) => mockCreatePermissionRequest(...args),
}));

import { CapabilityFilteredRegistry } from "./capability-filtered-registry";
import type { ToolDefinition } from "./tool-registry";

function createMockMcpServer() {
  return {
    registerTool: vi.fn().mockReturnValue({
      enable: vi.fn(),
      disable: vi.fn(),
      enabled: true,
    }),
  };
}

function makeToolDef(overrides?: Partial<ToolDefinition>): ToolDefinition {
  return {
    name: "image_generate",
    description: "Generate an image",
    category: "image",
    tier: "free",
    handler: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Generated image result" }],
    }),
    ...overrides,
  };
}

function getRegisteredHandler(
  mockMcpServer: ReturnType<typeof createMockMcpServer>,
) {
  const registerCall = mockMcpServer.registerTool.mock.calls[0]!;
  // The handler is the 3rd argument to registerTool
  return registerCall[2] as (
    input: never,
  ) => Promise<
    { content: Array<{ type: string; text: string; }>; isError?: boolean; }
  >;
}

describe("CapabilityFilteredRegistry", () => {
  const tokenId = "cap-token-123";
  const agentId = "agent-1";
  const userId = "user-1";

  let mockMcpServer: ReturnType<typeof createMockMcpServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMcpServer = createMockMcpServer();
    mockPrisma.agentAuditLog.create.mockResolvedValue({});
    mockPrisma.agentCapabilityToken.update.mockResolvedValue({});
  });

  it("should execute original handler when capability is allowed", async () => {
    mockEvaluateCapability.mockResolvedValue({ allowed: true });
    const originalHandler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "success" }],
    });
    const def = makeToolDef({ handler: originalHandler });

    const registry = new CapabilityFilteredRegistry(
      mockMcpServer as unknown as Parameters<
        typeof CapabilityFilteredRegistry.prototype.register
      >[0] extends infer _T ? Parameters<
          ConstructorParameters<typeof CapabilityFilteredRegistry>[0] extends infer _U ? never
            : never
        >
        : never,
      tokenId,
      agentId,
      userId,
    );
    // TypeScript doesn't know our mock shape, so cast
    (registry as unknown as { register: (def: ToolDefinition) => void; })
      .register(def);

    const handler = getRegisteredHandler(mockMcpServer);
    const result = await handler({} as never);

    expect(originalHandler).toHaveBeenCalledOnce();
    expect(result.content[0]!.text).toBe("success");
  });

  it("should return PERMISSION_DENIED when capability is denied", async () => {
    mockEvaluateCapability.mockResolvedValue({
      allowed: false,
      reason: "Tool explicitly denied: admin_delete_user",
      action: "deny",
    });
    const originalHandler = vi.fn();
    const def = makeToolDef({
      name: "admin_delete_user",
      category: "admin",
      handler: originalHandler,
    });

    const registry = new CapabilityFilteredRegistry(
      mockMcpServer as never,
      tokenId,
      agentId,
      userId,
    );
    registry.register(def);

    const handler = getRegisteredHandler(mockMcpServer);
    const result = await handler({} as never);

    expect(originalHandler).not.toHaveBeenCalled();
    expect(result.content[0]!.text).toContain("PERMISSION_DENIED");
    expect(result.content[0]!.text).toContain("explicitly denied");
  });

  it("should return PERMISSION_NEEDED and create request when action is request_permission", async () => {
    mockEvaluateCapability.mockResolvedValue({
      allowed: false,
      reason: "Tool not in allowed scope: vault_store",
      action: "request_permission",
    });
    mockCreatePermissionRequest.mockResolvedValue("req-456");
    const originalHandler = vi.fn();
    const def = makeToolDef({
      name: "vault_store",
      category: "vault",
      handler: originalHandler,
    });

    const registry = new CapabilityFilteredRegistry(
      mockMcpServer as never,
      tokenId,
      agentId,
      userId,
    );
    registry.register(def);

    const handler = getRegisteredHandler(mockMcpServer);
    const result = await handler({} as never);

    expect(originalHandler).not.toHaveBeenCalled();
    expect(result.content[0]!.text).toContain("PERMISSION_NEEDED");
    expect(result.content[0]!.text).toContain("vault_store");
    expect(mockCreatePermissionRequest).toHaveBeenCalledWith(
      agentId,
      userId,
      "vault_store",
      "vault",
      {},
      "QUEUE",
    );
  });

  it("should deduct budget after successful execution", async () => {
    mockEvaluateCapability.mockResolvedValue({ allowed: true });
    const def = makeToolDef();

    const registry = new CapabilityFilteredRegistry(
      mockMcpServer as never,
      tokenId,
      agentId,
      userId,
    );
    registry.register(def);

    const handler = getRegisteredHandler(mockMcpServer);
    await handler({} as never);

    // Flush fire-and-forget microtasks: need multiple rounds for dynamic import + Promise.all
    await vi.waitFor(() => {
      expect(mockPrisma.agentCapabilityToken.update).toHaveBeenCalledWith({
        where: { id: tokenId },
        data: { usedApiCalls: { increment: 1 } },
      });
    }, { timeout: 500 });
  });

  it("should record audit log after successful execution", async () => {
    mockEvaluateCapability.mockResolvedValue({ allowed: true });
    const def = makeToolDef({ name: "image_generate", category: "image" });

    const registry = new CapabilityFilteredRegistry(
      mockMcpServer as never,
      tokenId,
      agentId,
      userId,
    );
    registry.register(def);

    const handler = getRegisteredHandler(mockMcpServer);
    await handler({} as never);

    // Flush fire-and-forget microtasks
    await new Promise(r => setTimeout(r, 50));

    expect(mockPrisma.agentAuditLog.create).toHaveBeenCalledOnce();

    const auditData = mockPrisma.agentAuditLog.create.mock.calls[0]![0].data;
    expect(auditData.agentId).toBe(agentId);
    expect(auditData.userId).toBe(userId);
    expect(auditData.capabilityTokenId).toBe(tokenId);
    expect(auditData.action).toBe("image_generate");
    expect(auditData.actionType).toBe("image");
    expect(auditData.isError).toBe(false);
    expect(auditData.delegationChain).toEqual([]);
    expect(typeof auditData.durationMs).toBe("number");
  });

  it("should not record audit or deduct budget when denied", async () => {
    mockEvaluateCapability.mockResolvedValue({
      allowed: false,
      reason: "Token status: REVOKED",
      action: "deny",
    });
    const def = makeToolDef();

    const registry = new CapabilityFilteredRegistry(
      mockMcpServer as never,
      tokenId,
      agentId,
      userId,
    );
    registry.register(def);

    const handler = getRegisteredHandler(mockMcpServer);
    await handler({} as never);

    // Give time for any fire-and-forget to settle
    await new Promise(r => setTimeout(r, 50));
    expect(mockPrisma.agentAuditLog.create).not.toHaveBeenCalled();
    expect(mockPrisma.agentCapabilityToken.update).not.toHaveBeenCalled();
  });

  it("should handle null input when creating permission request", async () => {
    mockEvaluateCapability.mockResolvedValue({
      allowed: false,
      reason: "Not in scope",
      action: "request_permission",
    });
    mockCreatePermissionRequest.mockResolvedValue("req-789");
    const originalHandler = vi.fn();
    const def = makeToolDef({
      name: "some_tool",
      category: "some-cat",
      handler: originalHandler,
    });

    const registry = new CapabilityFilteredRegistry(
      mockMcpServer as never,
      tokenId,
      agentId,
      userId,
    );
    registry.register(def);

    const handler = getRegisteredHandler(mockMcpServer);
    const result = await handler(null as never);

    expect(result.content[0]!.text).toContain("PERMISSION_NEEDED");
    expect(mockCreatePermissionRequest).toHaveBeenCalledWith(
      agentId,
      userId,
      "some_tool",
      "some-cat",
      {},
      "QUEUE",
    );
  });

  it("should pass tool name and category to evaluateCapability", async () => {
    mockEvaluateCapability.mockResolvedValue({ allowed: true });
    const def = makeToolDef({
      name: "codespace_deploy",
      category: "codespace",
    });

    const registry = new CapabilityFilteredRegistry(
      mockMcpServer as never,
      tokenId,
      agentId,
      userId,
    );
    registry.register(def);

    const handler = getRegisteredHandler(mockMcpServer);
    await handler({} as never);

    expect(mockEvaluateCapability).toHaveBeenCalledWith(
      tokenId,
      "codespace_deploy",
      "codespace",
    );
  });

  it("should handle error in evaluateCapability", async () => {
    mockEvaluateCapability.mockRejectedValue(new Error("eval-fail"));
    const def = makeToolDef();
    const registry = new CapabilityFilteredRegistry(
      mockMcpServer as never,
      tokenId,
      agentId,
      userId,
    );
    registry.register(def);

    const handler = getRegisteredHandler(mockMcpServer);
    const result = await handler({} as never);
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("eval-fail");
  });

  it("should support base registry methods", () => {
    const registry = new CapabilityFilteredRegistry(
      mockMcpServer as never,
      tokenId,
      agentId,
      userId,
    );
    expect(() => registry.searchTools("query")).not.toThrow();
    expect(() => registry.listCategories()).not.toThrow();
  });
});
