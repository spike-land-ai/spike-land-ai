import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  workspace: { findFirst: vi.fn() },
  workspaceAuditLog: { findMany: vi.fn() },
  aIDecisionLog: { findMany: vi.fn() },
  agentAuditLog: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerAuditTools } from "./audit";

describe("audit tools", () => {
  const userId = "test-user-123";
  const wsId = "ws-1";
  const mockWorkspace = { id: wsId, slug: "my-ws", name: "My Workspace" };
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerAuditTools(registry, userId);
    mockPrisma.workspace.findFirst.mockResolvedValue(mockWorkspace);
  });

  it("should register 4 audit tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("audit_query_logs")).toBe(true);
    expect(registry.handlers.has("audit_export")).toBe(true);
    expect(registry.handlers.has("audit_get_ai_decisions")).toBe(true);
    expect(registry.handlers.has("audit_get_agent_trail")).toBe(true);
  });

  describe("audit_query_logs", () => {
    it("should return audit logs", async () => {
      mockPrisma.workspaceAuditLog.findMany.mockResolvedValue([
        {
          action: "CREATE",
          targetType: "Post",
          userId: "user-1",
          createdAt: new Date("2025-06-01"),
          details: "Created post",
        },
        {
          action: "UPDATE",
          targetType: "Settings",
          userId: null,
          createdAt: new Date("2025-06-02"),
          details: null,
        },
      ]);
      const handler = registry.handlers.get("audit_query_logs")!;
      const result = await handler({ workspace_slug: "my-ws" });
      const text = getText(result);
      expect(text).toContain("Audit Logs (2)");
      expect(text).toContain("CREATE");
      expect(text).toContain("Post");
      expect(text).toContain("system");
    });

    it("should return message when no logs found", async () => {
      mockPrisma.workspaceAuditLog.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("audit_query_logs")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("No audit logs found");
    });

    it("should show 'unknown' for null targetType and 'system' for null userId", async () => {
      mockPrisma.workspaceAuditLog.findMany.mockResolvedValue([
        {
          action: "DELETE",
          targetType: null,
          userId: null,
          createdAt: new Date("2025-06-03"),
          details: null,
        },
      ]);
      const handler = registry.handlers.get("audit_query_logs")!;
      const result = await handler({ workspace_slug: "my-ws" });
      const text = getText(result);
      expect(text).toContain("unknown");
      expect(text).toContain("system");
    });

    it("should apply action and target_type filters", async () => {
      mockPrisma.workspaceAuditLog.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("audit_query_logs")!;
      await handler({
        workspace_slug: "my-ws",
        action: "DELETE",
        target_type: "User",
      });
      expect(mockPrisma.workspaceAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: "DELETE",
            targetType: "User",
          }),
        }),
      );
    });
  });

  describe("audit_export", () => {
    it("should return export summary", async () => {
      mockPrisma.workspaceAuditLog.findMany.mockResolvedValue([
        { action: "CREATE" },
        { action: "UPDATE" },
        { action: "DELETE" },
      ]);
      const handler = registry.handlers.get("audit_export")!;
      const result = await handler({
        workspace_slug: "my-ws",
        from_date: "2025-01-01",
        to_date: "2025-06-30",
        format: "json",
      });
      const text = getText(result);
      expect(text).toContain("Audit Export Summary");
      expect(text).toContain("Records:** 3");
      expect(text).toContain("json");
    });
  });

  describe("audit_get_ai_decisions", () => {
    it("should return AI decision logs", async () => {
      mockPrisma.aIDecisionLog.findMany.mockResolvedValue([
        {
          requestType: "CONTENT_MODERATION",
          inputPrompt: "Review post #42",
          outputResult: "Approved",
          createdAt: new Date("2025-06-01"),
        },
      ]);
      const handler = registry.handlers.get("audit_get_ai_decisions")!;
      const result = await handler({ workspace_slug: "my-ws" });
      const text = getText(result);
      expect(text).toContain("AI Decisions (1)");
      expect(text).toContain("CONTENT_MODERATION");
      expect(text).toContain("Review post #42");
    });

    it("should show n/a for null inputPrompt and outputResult", async () => {
      mockPrisma.aIDecisionLog.findMany.mockResolvedValue([
        {
          requestType: "GENERATION",
          inputPrompt: null,
          outputResult: null,
          createdAt: new Date("2025-06-01"),
        },
      ]);
      const handler = registry.handlers.get("audit_get_ai_decisions")!;
      const result = await handler({ workspace_slug: "my-ws" });
      const text = getText(result);
      expect(text).toContain("input: n/a");
      expect(text).toContain("output: n/a");
    });

    it("should return message when no decisions found", async () => {
      mockPrisma.aIDecisionLog.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("audit_get_ai_decisions")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("No AI decisions found");
    });
  });

  describe("audit_get_agent_trail", () => {
    it("should return agent activity trail", async () => {
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([
        {
          action: "TOOL_CALL",
          durationMs: 1234,
          createdAt: new Date("2025-06-01"),
        },
      ]);
      const handler = registry.handlers.get("audit_get_agent_trail")!;
      const result = await handler({ workspace_slug: "my-ws" });
      const text = getText(result);
      expect(text).toContain("Agent Trail (1)");
      expect(text).toContain("TOOL_CALL");
      expect(text).toContain("1234ms");
    });

    it("should return message when no trail found", async () => {
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("audit_get_agent_trail")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("No agent activity found");
    });

    it("should filter by agent_id when provided", async () => {
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("audit_get_agent_trail")!;
      await handler({ workspace_slug: "my-ws", agent_id: "agent-42" });
      expect(mockPrisma.agentAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ agentId: "agent-42" }),
        }),
      );
    });
  });
});
