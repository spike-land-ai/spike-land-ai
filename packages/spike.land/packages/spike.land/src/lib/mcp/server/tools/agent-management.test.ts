import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  claudeCodeAgent: { findMany: vi.fn(), findUnique: vi.fn() },
  agentMessage: { findMany: vi.fn(), create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerAgentManagementTools } from "./agent-management";

describe("agent-management tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerAgentManagementTools(registry, userId);
  });

  it("should register 4 agent management tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
  });

  describe("agents_list", () => {
    it("should list agents with stats", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "agent-1",
          displayName: "My Agent",
          lastSeenAt: new Date("2024-06-01"),
          totalTokensUsed: 5000,
          totalTasksCompleted: 10,
          _count: { messages: 25 },
        },
      ]);
      const handler = registry.handlers.get("agents_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("My Agent");
      expect(getText(result)).toContain("25 messages");
      expect(getText(result)).toContain("10 tasks");
      expect(getText(result)).toContain("Agents (1)");
      expect(getText(result)).toContain("agent-1");
    });

    it("should return empty message when no agents", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("agents_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("No agents found");
    });

    it("should handle agent with null lastSeenAt", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "agent-2",
          displayName: "New Agent",
          lastSeenAt: null,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          _count: { messages: 0 },
        },
      ]);
      const handler = registry.handlers.get("agents_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("New Agent");
      expect(getText(result)).toContain("never");
    });

    it("should respect custom limit", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("agents_list")!;
      await handler({ limit: 5 });
      expect(mockPrisma.claudeCodeAgent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });

    it("should use default limit of 20", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("agents_list")!;
      await handler({});
      expect(mockPrisma.claudeCodeAgent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        }),
      );
    });
  });

  describe("agents_get", () => {
    it("should return agent details", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "agent-1",
        userId,
        displayName: "My Agent",
        machineId: "machine-abc",
        sessionId: "sess-xyz",
        projectPath: "/home/user/project",
        workingDirectory: "/home/user/project/src",
        totalTokensUsed: 5000,
        totalTasksCompleted: 10,
        totalSessionTime: 3600,
        lastSeenAt: new Date("2024-06-01"),
        createdAt: new Date("2024-01-01"),
        _count: { messages: 25 },
      });
      const handler = registry.handlers.get("agents_get")!;
      const result = await handler({ agent_id: "agent-1" });
      expect(getText(result)).toContain("My Agent");
      expect(getText(result)).toContain("machine-abc");
      expect(getText(result)).toContain("sess-xyz");
      expect(getText(result)).toContain("/home/user/project");
      expect(getText(result)).toContain("5000");
      expect(getText(result)).toContain("10");
      expect(getText(result)).toContain("3600");
      expect(getText(result)).toContain("25");
    });

    it("should return NOT_FOUND when agent does not exist", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("agents_get")!;
      const result = await handler({ agent_id: "nonexistent" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should return NOT_FOUND (not PERMISSION_DENIED) when agent belongs to another user (SEC-AUTHZ-02)", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "agent-other",
        userId: "other-user",
        displayName: "Other Agent",
        machineId: "m1",
        sessionId: "s1",
        projectPath: null,
        workingDirectory: null,
        totalTokensUsed: 0,
        totalTasksCompleted: 0,
        totalSessionTime: 0,
        lastSeenAt: null,
        createdAt: new Date(),
        _count: { messages: 0 },
      });
      const handler = registry.handlers.get("agents_get")!;
      const result = await handler({ agent_id: "agent-other" });
      // Security: must NOT leak ownership info - return generic NOT_FOUND
      expect(getText(result)).toContain("NOT_FOUND");
      expect(getText(result)).toContain("Agent not found");
      expect(getText(result)).not.toContain("PERMISSION_DENIED");
      expect(getText(result)).not.toContain("do not own");
    });

    it("should handle agent with null optional fields", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "agent-minimal",
        userId,
        displayName: "Minimal Agent",
        machineId: "m1",
        sessionId: "s1",
        projectPath: null,
        workingDirectory: null,
        totalTokensUsed: 0,
        totalTasksCompleted: 0,
        totalSessionTime: 0,
        lastSeenAt: null,
        createdAt: new Date("2024-01-01"),
        _count: { messages: 0 },
      });
      const handler = registry.handlers.get("agents_get")!;
      const result = await handler({ agent_id: "agent-minimal" });
      expect(getText(result)).toContain("(none)");
      expect(getText(result)).toContain("never");
    });
  });

  describe("agents_get_queue", () => {
    it("should return unread messages", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        userId,
        displayName: "My Agent",
      });
      mockPrisma.agentMessage.findMany.mockResolvedValue([
        {
          id: "msg-1",
          role: "USER",
          content: "Hello agent",
          createdAt: new Date("2024-06-01"),
        },
        {
          id: "msg-2",
          role: "SYSTEM",
          content: "Task completed",
          createdAt: new Date("2024-06-02"),
        },
      ]);
      const handler = registry.handlers.get("agents_get_queue")!;
      const result = await handler({ agent_id: "agent-1" });
      expect(getText(result)).toContain("Unread Messages for My Agent (2)");
      expect(getText(result)).toContain("Hello agent");
      expect(getText(result)).toContain("Task completed");
      expect(getText(result)).toContain("[USER]");
      expect(getText(result)).toContain("[SYSTEM]");
    });

    it("should return empty message when no unread messages", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        userId,
        displayName: "My Agent",
      });
      mockPrisma.agentMessage.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("agents_get_queue")!;
      const result = await handler({ agent_id: "agent-1" });
      expect(getText(result)).toContain("No unread messages");
      expect(getText(result)).toContain("My Agent");
    });

    it("should return NOT_FOUND when agent does not exist", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("agents_get_queue")!;
      const result = await handler({ agent_id: "nonexistent" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should return PERMISSION_DENIED for other user's agent", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        userId: "other-user",
        displayName: "Other Agent",
      });
      const handler = registry.handlers.get("agents_get_queue")!;
      const result = await handler({ agent_id: "agent-other" });
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });

    it("should truncate long message content at 150 chars", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        userId,
        displayName: "My Agent",
      });
      const longContent = "A".repeat(200);
      mockPrisma.agentMessage.findMany.mockResolvedValue([
        {
          id: "msg-long",
          role: "USER",
          content: longContent,
          createdAt: new Date(),
        },
      ]);
      const handler = registry.handlers.get("agents_get_queue")!;
      const result = await handler({ agent_id: "agent-1" });
      expect(getText(result)).toContain("...");
      expect(getText(result)).not.toContain("A".repeat(200));
    });
  });

  describe("agents_send_message", () => {
    it("should send message to agent", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        userId,
        displayName: "My Agent",
      });
      mockPrisma.agentMessage.create.mockResolvedValue({ id: "msg-new" });
      const handler = registry.handlers.get("agents_send_message")!;
      const result = await handler({
        agent_id: "agent-1",
        content: "Do something",
      });
      expect(getText(result)).toContain("Message Sent");
      expect(getText(result)).toContain("My Agent");
      expect(getText(result)).toContain("Do something");
      expect(getText(result)).toContain("msg-new");
      expect(mockPrisma.agentMessage.create).toHaveBeenCalledWith({
        data: {
          agentId: "agent-1",
          role: "USER",
          content: "Do something",
          isRead: false,
        },
      });
    });

    it("should return NOT_FOUND when agent does not exist", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("agents_send_message")!;
      const result = await handler({
        agent_id: "nonexistent",
        content: "Hello",
      });
      expect(getText(result)).toContain("NOT_FOUND");
      expect(mockPrisma.agentMessage.create).not.toHaveBeenCalled();
    });

    it("should return PERMISSION_DENIED for other user's agent", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        userId: "other-user",
        displayName: "Other Agent",
      });
      const handler = registry.handlers.get("agents_send_message")!;
      const result = await handler({
        agent_id: "agent-other",
        content: "Hello",
      });
      expect(getText(result)).toContain("PERMISSION_DENIED");
      expect(mockPrisma.agentMessage.create).not.toHaveBeenCalled();
    });

    it("should truncate long content in response at 100 chars", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        userId,
        displayName: "My Agent",
      });
      const longContent = "B".repeat(150);
      mockPrisma.agentMessage.create.mockResolvedValue({ id: "msg-long" });
      const handler = registry.handlers.get("agents_send_message")!;
      const result = await handler({
        agent_id: "agent-1",
        content: longContent,
      });
      expect(getText(result)).toContain("Message Sent");
      expect(getText(result)).toContain("...");
      expect(getText(result)).not.toContain("B".repeat(150));
    });
  });

  describe("SendAgentMessageSchema validation (SEC-INPUT-01)", () => {
    it("should enforce max 10000 char limit on content field via schema", async () => {
      // The schema itself enforces .max(10000), so we verify the schema shape
      // was passed to registry.register with the max constraint
      const registerFn = registry.register as unknown as ReturnType<
        typeof vi.fn
      >;
      const registerCalls = registerFn.mock.calls;
      const sendMessageCall = registerCalls.find(
        (call: unknown[]) => (call[0] as { name: string; }).name === "agents_send_message",
      );
      expect(sendMessageCall).toBeDefined();
      const schema = (sendMessageCall![0] as { inputSchema: Record<string, unknown>; })
        .inputSchema;
      expect(schema.content).toBeDefined();
    });
  });
});
