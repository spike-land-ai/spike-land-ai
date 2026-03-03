import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  workspace: {
    findFirst: vi.fn(),
  },
  connectionReminder: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { registerRemindersTools } from "./reminders";

interface ToolResult {
  content: Array<{ text: string; }>;
  isError?: boolean;
}

function createMockRegistry() {
  const tools = new Map<
    string,
    {
      handler: (...args: unknown[]) => Promise<ToolResult>;
      inputSchema: Record<string, unknown>;
    }
  >();
  return {
    tools,
    register: vi.fn(
      (
        { name, handler, inputSchema }: {
          name: string;
          handler: (...args: unknown[]) => Promise<ToolResult>;
          inputSchema: Record<string, unknown>;
        },
      ) => {
        tools.set(name, { handler, inputSchema });
      },
    ),
  };
}

const MOCK_WORKSPACE = {
  id: "ws-1",
  slug: "test-workspace",
  name: "Test Workspace",
  subscriptionTier: "PRO" as const,
};

describe("Reminders MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerRemindersTools(
      registry as unknown as Parameters<typeof registerRemindersTools>[0],
      "user123",
    );
  });

  it("registers 3 reminders tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.tools.has("reminders_list")).toBe(true);
    expect(registry.tools.has("reminders_create")).toBe(true);
    expect(registry.tools.has("reminders_complete")).toBe(true);
  });

  describe("reminders_list", () => {
    it("returns active reminders for workspace", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(MOCK_WORKSPACE);
      mockPrisma.connectionReminder.findMany.mockResolvedValueOnce([
        {
          id: "rem-1",
          title: "Follow up with client",
          status: "ACTIVE",
          dueDate: new Date("2026-02-20T10:00:00Z"),
          description: "Discuss project timeline",
          connection: { displayName: "John Doe" },
        },
      ]);

      const handler = registry.tools.get("reminders_list")!.handler;
      const result = await handler({ workspace_slug: "test-workspace" });

      expect(result.content[0]!.text).toContain("Follow up with client");
      expect(result.content[0]!.text).toContain("John Doe");
      expect(result.content[0]!.text).toContain("ACTIVE");
    });

    it("filters by COMPLETED status", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(MOCK_WORKSPACE);
      mockPrisma.connectionReminder.findMany.mockResolvedValueOnce([]);

      const handler = registry.tools.get("reminders_list")!.handler;
      await handler({ workspace_slug: "test-workspace", status: "COMPLETED" });

      expect(mockPrisma.connectionReminder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: "ws-1", status: "COMPLETED" },
        }),
      );
    });

    it("returns all reminders when status is ALL", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(MOCK_WORKSPACE);
      mockPrisma.connectionReminder.findMany.mockResolvedValueOnce([]);

      const handler = registry.tools.get("reminders_list")!.handler;
      await handler({ workspace_slug: "test-workspace", status: "ALL" });

      expect(mockPrisma.connectionReminder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: "ws-1" },
        }),
      );
    });

    it("returns message when no reminders found", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(MOCK_WORKSPACE);
      mockPrisma.connectionReminder.findMany.mockResolvedValueOnce([]);

      const handler = registry.tools.get("reminders_list")!.handler;
      const result = await handler({ workspace_slug: "test-workspace" });

      expect(result.content[0]!.text).toContain("No reminders found");
    });

    it("returns error for unknown workspace", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("reminders_list")!.handler;
      const result = await handler({ workspace_slug: "bad-workspace" });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("not found");
    });

    it("filters by ACTIVE status with not-COMPLETED where clause", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(MOCK_WORKSPACE);
      mockPrisma.connectionReminder.findMany.mockResolvedValueOnce([]);
      const handler = registry.tools.get("reminders_list")!.handler;
      await handler({ workspace_slug: "test-workspace", status: "ACTIVE" });
      expect(mockPrisma.connectionReminder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: "ws-1", status: { not: "COMPLETED" } },
        }),
      );
    });

    it("shows reminder without connection info when connection is null", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(MOCK_WORKSPACE);
      mockPrisma.connectionReminder.findMany.mockResolvedValueOnce([
        {
          id: "rem-2",
          title: "Orphan reminder",
          status: "ACTIVE",
          dueDate: new Date("2026-03-01T10:00:00Z"),
          description: null,
          connection: null,
        },
      ]);
      const handler = registry.tools.get("reminders_list")!.handler;
      const result = await handler({ workspace_slug: "test-workspace" });
      expect(result.content[0]!.text).toContain("Orphan reminder");
      expect(result.content[0]!.text).toContain("N/A");
      expect(result.content[0]!.text).not.toContain("(Connection:");
    });
  });

  describe("reminders_create", () => {
    it("creates a new reminder", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(MOCK_WORKSPACE);
      mockPrisma.connectionReminder.create.mockResolvedValueOnce({
        id: "rem-new",
        title: "New reminder",
      });

      const handler = registry.tools.get("reminders_create")!.handler;
      const result = await handler({
        workspace_slug: "test-workspace",
        title: "New reminder",
        type: "FOLLOW_UP",
        dueDate: "2026-03-01T10:00:00Z",
        connectionId: "conn-1",
      });

      expect(result.content[0]!.text).toContain("Reminder Created");
      expect(result.content[0]!.text).toContain("rem-new");
      expect(mockPrisma.connectionReminder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws-1",
          title: "New reminder",
          type: "FOLLOW_UP",
          connectionId: "conn-1",
        }),
      });
    });

    it("returns error for unknown workspace", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("reminders_create")!.handler;
      const result = await handler({
        workspace_slug: "bad-workspace",
        title: "Test",
        type: "OTHER",
        dueDate: "2026-03-01T10:00:00Z",
        connectionId: "conn-1",
      });

      expect(result.isError).toBe(true);
    });

    it("handles database errors gracefully", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(MOCK_WORKSPACE);
      mockPrisma.connectionReminder.create.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("reminders_create")!.handler;
      const result = await handler({
        workspace_slug: "test-workspace",
        title: "Test",
        type: "OTHER",
        dueDate: "2026-03-01T10:00:00Z",
        connectionId: "conn-1",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("reminders_complete", () => {
    it("marks a reminder as completed", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(MOCK_WORKSPACE);
      mockPrisma.connectionReminder.update.mockResolvedValueOnce({
        id: "rem-1",
        title: "Done reminder",
        status: "COMPLETED",
      });

      const handler = registry.tools.get("reminders_complete")!.handler;
      const result = await handler({
        workspace_slug: "test-workspace",
        reminderId: "rem-1",
      });

      expect(result.content[0]!.text).toContain("Reminder Completed");
      expect(result.content[0]!.text).toContain("rem-1");
      expect(mockPrisma.connectionReminder.update).toHaveBeenCalledWith({
        where: { id: "rem-1", workspaceId: "ws-1" },
        data: { status: "COMPLETED" },
      });
    });

    it("returns error for unknown workspace", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("reminders_complete")!.handler;
      const result = await handler({
        workspace_slug: "bad-workspace",
        reminderId: "rem-1",
      });

      expect(result.isError).toBe(true);
    });

    it("handles database errors gracefully", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(MOCK_WORKSPACE);
      mockPrisma.connectionReminder.update.mockRejectedValueOnce(
        new Error("Record not found"),
      );

      const handler = registry.tools.get("reminders_complete")!.handler;
      const result = await handler({
        workspace_slug: "test-workspace",
        reminderId: "bad-id",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("not found");
    });
  });
});
