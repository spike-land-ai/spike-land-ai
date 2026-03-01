import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    claudeCodeAgent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    agentMessage: {
      createMany: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    agentAuditLog: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerSwarmTools } from "./swarm";

describe("swarm tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    registry = createMockRegistry();
    registerSwarmTools(registry, userId);
  });

  it("should register 11 swarm tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(11);
    expect(registry.handlers.has("swarm_list_agents")).toBe(true);
    expect(registry.handlers.has("swarm_get_agent")).toBe(true);
    expect(registry.handlers.has("swarm_spawn_agent")).toBe(true);
    expect(registry.handlers.has("swarm_stop_agent")).toBe(true);
    expect(registry.handlers.has("swarm_redirect_agent")).toBe(true);
    expect(registry.handlers.has("swarm_broadcast")).toBe(true);
    expect(registry.handlers.has("swarm_agent_timeline")).toBe(true);
    expect(registry.handlers.has("swarm_topology")).toBe(true);
    expect(registry.handlers.has("swarm_send_message")).toBe(true);
    expect(registry.handlers.has("swarm_read_messages")).toBe(true);
    expect(registry.handlers.has("swarm_delegate_task")).toBe(true);
  });

  describe("swarm_list_agents", () => {
    it("should list agents with status labels", async () => {
      const now = new Date();
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "agent-1",
          displayName: "Worker-1",
          lastSeenAt: now,
          totalTokensUsed: 1000,
          totalTasksCompleted: 5,
          machineId: "m1",
          projectPath: "/proj",
          _count: { messages: 10 },
        },
      ]);
      const result = await registry.call("swarm_list_agents", {});
      expect(getText(result)).toContain("Worker-1");
      expect(getText(result)).toContain("ACTIVE");
      expect(getText(result)).toContain("Tasks: 5");
    });

    it("should return message when no agents found", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([]);
      const result = await registry.call("swarm_list_agents", {});
      expect(getText(result)).toContain("No agents found");
    });

    it("should filter by active status", async () => {
      const now = new Date();
      const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "Active",
          lastSeenAt: now,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          machineId: "m1",
          projectPath: null,
          _count: { messages: 0 },
        },
        {
          id: "a2",
          displayName: "Idle",
          lastSeenAt: tenMinAgo,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          machineId: "m2",
          projectPath: null,
          _count: { messages: 0 },
        },
      ]);
      const result = await registry.call("swarm_list_agents", { status: "active" });
      expect(getText(result)).toContain("Active");
      expect(getText(result)).not.toContain("Idle");
    });

    it("should filter by idle status", async () => {
      const now = new Date();
      const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "Active",
          lastSeenAt: now,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          machineId: "m1",
          projectPath: null,
          _count: { messages: 0 },
        },
        {
          id: "a2",
          displayName: "IdleAgent",
          lastSeenAt: tenMinAgo,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          machineId: "m2",
          projectPath: null,
          _count: { messages: 0 },
        },
        {
          id: "a3",
          displayName: "StoppedAgent",
          lastSeenAt: null,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          machineId: "m3",
          projectPath: null,
          _count: { messages: 0 },
        },
      ]);
      const result = await registry.call("swarm_list_agents", { status: "idle" });
      expect(getText(result)).toContain("IdleAgent");
      expect(getText(result)).not.toContain("Active");
      expect(getText(result)).not.toContain("StoppedAgent");
    });

    it("should filter by stopped status (null lastSeenAt)", async () => {
      const now = new Date();
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "Active",
          lastSeenAt: now,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          machineId: "m1",
          projectPath: null,
          _count: { messages: 0 },
        },
        {
          id: "a2",
          displayName: "StoppedAgent",
          lastSeenAt: null,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          machineId: "m2",
          projectPath: null,
          _count: { messages: 0 },
        },
      ]);
      const result = await registry.call("swarm_list_agents", { status: "stopped" });
      expect(getText(result)).toContain("StoppedAgent");
      expect(getText(result)).not.toContain("Active");
    });

    it("should show IDLE for agents seen more than 5 minutes ago", async () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "OldAgent",
          lastSeenAt: tenMinAgo,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          machineId: "m1",
          projectPath: null,
          _count: { messages: 0 },
        },
      ]);
      const result = await registry.call("swarm_list_agents", {});
      expect(getText(result)).toContain("IDLE");
    });

    it("should show STOPPED for agents with no lastSeenAt", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "NeverSeen",
          lastSeenAt: null,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          machineId: "m1",
          projectPath: null,
          _count: { messages: 0 },
        },
      ]);
      const result = await registry.call("swarm_list_agents", {});
      expect(getText(result)).toContain("STOPPED");
    });
  });

  describe("swarm_get_agent", () => {
    it("should return detailed agent info", async () => {
      const now = new Date();
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "agent-1",
        displayName: "Worker-1",
        machineId: "m1",
        sessionId: "s1",
        projectPath: "/proj",
        workingDirectory: "/work",
        totalTokensUsed: 500,
        totalTasksCompleted: 3,
        totalSessionTime: 120,
        lastSeenAt: now,
        createdAt: now,
        deletedAt: null,
        _count: { messages: 5 },
      });
      const result = await registry.call("swarm_get_agent", { agent_id: "agent-1" });
      expect(getText(result)).toContain("Worker-1");
      expect(getText(result)).toContain("Tokens: 500");
      expect(getText(result)).toContain("Tasks: 3");
    });

    it("should show (none) for null projectPath and workingDirectory", async () => {
      const now = new Date();
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "agent-2",
        displayName: "Worker-2",
        machineId: "m1",
        sessionId: "s2",
        projectPath: null,
        workingDirectory: null,
        totalTokensUsed: 0,
        totalTasksCompleted: 0,
        totalSessionTime: 0,
        lastSeenAt: now,
        createdAt: now,
        deletedAt: null,
        _count: { messages: 0 },
      });
      const result = await registry.call("swarm_get_agent", { agent_id: "agent-2" });
      const text = getText(result);
      expect(text).toContain("Project: (none)");
      expect(text).toContain("Working Dir: (none)");
    });

    it("should show 'never' when lastSeenAt is null", async () => {
      const now = new Date();
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "agent-3",
        displayName: "NeverSeen",
        machineId: "m1",
        sessionId: "s3",
        projectPath: "/proj",
        workingDirectory: "/dir",
        totalTokensUsed: 0,
        totalTasksCompleted: 0,
        totalSessionTime: 0,
        lastSeenAt: null,
        createdAt: now,
        deletedAt: null,
        _count: { messages: 0 },
      });
      const result = await registry.call("swarm_get_agent", { agent_id: "agent-3" });
      expect(getText(result)).toContain("Last Seen: never");
    });

    it("should return not found for missing agent", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue(null);
      const result = await registry.call("swarm_get_agent", { agent_id: "missing" });
      expect(getText(result)).toContain("Agent not found");
    });

    it("should return not found for soft-deleted agent", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "agent-1",
        displayName: "Deleted",
        deletedAt: new Date(),
        _count: { messages: 0 },
      });
      const result = await registry.call("swarm_get_agent", { agent_id: "agent-1" });
      expect(getText(result)).toContain("Agent not found");
    });
  });

  describe("swarm_spawn_agent", () => {
    it("should create a new agent", async () => {
      mockPrisma.claudeCodeAgent.create.mockResolvedValue({
        id: "new-session",
        displayName: "NewBot",
      });
      const result = await registry.call("swarm_spawn_agent", {
        display_name: "NewBot",
        machine_id: "m1",
        session_id: "new-session",
        project_path: "/proj",
      });
      expect(getText(result)).toContain("Agent spawned");
      expect(getText(result)).toContain("NewBot");
      expect(mockPrisma.claudeCodeAgent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayName: "NewBot", userId }),
        }),
      );
    });
  });

  describe("swarm_stop_agent", () => {
    it("should soft-delete an agent", async () => {
      mockPrisma.claudeCodeAgent.update.mockResolvedValue({});
      const result = await registry.call("swarm_stop_agent", { agent_id: "agent-1" });
      expect(getText(result)).toContain("stopped");
      expect(mockPrisma.claudeCodeAgent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe("swarm_redirect_agent", () => {
    it("should redirect an agent", async () => {
      mockPrisma.claudeCodeAgent.update.mockResolvedValue({});
      const result = await registry.call("swarm_redirect_agent", {
        agent_id: "agent-1",
        project_path: "/new-proj",
        working_directory: "/new-dir",
      });
      expect(getText(result)).toContain("redirected");
    });

    it("should redirect with only project_path (no working_directory)", async () => {
      mockPrisma.claudeCodeAgent.update.mockResolvedValue({});
      const result = await registry.call("swarm_redirect_agent", {
        agent_id: "agent-1",
        project_path: "/new-proj",
      });
      expect(getText(result)).toContain("redirected");
      expect(mockPrisma.claudeCodeAgent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { projectPath: "/new-proj" },
        }),
      );
    });

    it("should redirect with only working_directory (no project_path)", async () => {
      mockPrisma.claudeCodeAgent.update.mockResolvedValue({});
      const result = await registry.call("swarm_redirect_agent", {
        agent_id: "agent-1",
        working_directory: "/new-dir",
      });
      expect(getText(result)).toContain("redirected");
      expect(mockPrisma.claudeCodeAgent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { workingDirectory: "/new-dir" },
        }),
      );
    });

    it("should redirect with neither path field", async () => {
      mockPrisma.claudeCodeAgent.update.mockResolvedValue({});
      const result = await registry.call("swarm_redirect_agent", {
        agent_id: "agent-1",
      });
      expect(getText(result)).toContain("redirected");
      expect(mockPrisma.claudeCodeAgent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {},
        }),
      );
    });
  });

  describe("swarm_broadcast", () => {
    it("should broadcast to all agents", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        { id: "a1" },
        { id: "a2" },
      ]);
      mockPrisma.agentMessage.createMany.mockResolvedValue({ count: 2 });
      const result = await registry.call("swarm_broadcast", { content: "Hello swarm" });
      expect(getText(result)).toContain("Broadcast sent to 2 agents");
    });
  });

  describe("swarm_agent_timeline", () => {
    it("should return timeline entries", async () => {
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([
        {
          action: "tool_call",
          actionType: "CODE_EDIT",
          createdAt: new Date(),
          durationMs: 150,
          isError: false,
        },
      ]);
      const result = await registry.call("swarm_agent_timeline", { agent_id: "agent-1" });
      expect(getText(result)).toContain("tool_call");
      expect(getText(result)).toContain("CODE_EDIT");
    });

    it("should return message when no timeline entries", async () => {
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([]);
      const result = await registry.call("swarm_agent_timeline", { agent_id: "agent-1" });
      expect(getText(result)).toContain("No timeline entries found");
    });

    it("should show ERROR marker for error entries", async () => {
      mockPrisma.agentAuditLog.findMany.mockResolvedValue([
        {
          action: "compile",
          actionType: "BUILD",
          createdAt: new Date(),
          durationMs: 500,
          isError: true,
        },
      ]);
      const result = await registry.call("swarm_agent_timeline", { agent_id: "agent-1" });
      expect(getText(result)).toContain("[ERROR]");
    });
  });

  describe("swarm_topology", () => {
    it("should show agent topology with trust scores", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "Alpha",
          lastSeenAt: new Date(),
          trustScore: {
            trustLevel: "TRUSTED",
            totalSuccessful: 100,
            totalFailed: 2,
          },
        },
      ]);
      const result = await registry.call("swarm_topology", {});
      expect(getText(result)).toContain("Alpha");
      expect(getText(result)).toContain("TRUSTED");
      expect(getText(result)).toContain("100 ok / 2 fail");
    });

    it("should return message when no agents in swarm", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([]);
      const result = await registry.call("swarm_topology", {});
      expect(getText(result)).toContain("No agents in the swarm");
    });

    it("should default trust level to SANDBOX when no trust score", async () => {
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "Newbie",
          lastSeenAt: new Date(),
          trustScore: null,
        },
      ]);
      const result = await registry.call("swarm_topology", {});
      expect(getText(result)).toContain("SANDBOX");
    });
  });

  describe("requireAdminRole", () => {
    it("should deny access when user has USER role", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const result = await registry.call("swarm_list_agents", {});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });

    it("should deny access when user is not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await registry.call("swarm_list_agents", {});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });

    it("should allow SUPER_ADMIN role", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "SUPER_ADMIN" });
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([]);
      const result = await registry.call("swarm_list_agents", {});
      expect(getText(result)).toContain("No agents found");
    });

    it("should include all agents when status is 'all' (default branch)", async () => {
      const now = new Date();
      mockPrisma.claudeCodeAgent.findMany.mockResolvedValue([
        {
          id: "a1",
          displayName: "Agent1",
          lastSeenAt: now,
          totalTokensUsed: 0,
          totalTasksCompleted: 0,
          machineId: "m1",
          projectPath: null,
          _count: { messages: 0 },
        },
      ]);
      const result = await registry.call("swarm_list_agents", { status: "all" });
      const text = getText(result);
      expect(text).toContain("Agent1");
    });

    it("should check admin role on every swarm tool handler", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      // Map each tool to its minimum valid input shape (to pass Zod then hit requireAdminRole)
      const toolCalls: [string, Record<string, unknown>][] = [
        ["swarm_list_agents", {}],
        ["swarm_get_agent", { agent_id: "x" }],
        ["swarm_spawn_agent", { display_name: "bot", machine_id: "m1", session_id: "s1" }],
        ["swarm_stop_agent", { agent_id: "x" }],
        ["swarm_redirect_agent", { agent_id: "x" }],
        ["swarm_broadcast", { content: "hi" }],
        ["swarm_agent_timeline", { agent_id: "x" }],
        ["swarm_topology", {}],
        ["swarm_send_message", { target_agent_id: "x", content: "hi" }],
        ["swarm_read_messages", { agent_id: "x" }],
        ["swarm_delegate_task", { target_agent_id: "x", task_description: "do something" }],
      ];
      for (const [toolName, args] of toolCalls) {
        const result = await registry.call(toolName, args);
        expect(getText(result)).toContain("PERMISSION_DENIED");
      }
    });
  });

  describe("swarm_send_message", () => {
    it("should send a message to a target agent", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "target-1",
        displayName: "TargetBot",
        deletedAt: null,
      });
      mockPrisma.agentMessage.create.mockResolvedValue({
        id: "msg-1",
        agentId: "target-1",
        role: "AGENT",
        content: "Hello",
      });
      const result = await registry.call("swarm_send_message", {
        target_agent_id: "target-1",
        content: "Hello",
      });
      const text = getText(result);
      expect(text).toContain("Message sent to TargetBot");
      expect(text).toContain("msg-1");
      expect(mockPrisma.agentMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            agentId: "target-1",
            role: "AGENT",
            content: "Hello",
            isRead: false,
          }),
        }),
      );
    });

    it("should send a message with metadata", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "target-1",
        displayName: "TargetBot",
        deletedAt: null,
      });
      mockPrisma.agentMessage.create.mockResolvedValue({
        id: "msg-2",
        agentId: "target-1",
        role: "AGENT",
        content: "WithMeta",
      });
      const result = await registry.call("swarm_send_message", {
        target_agent_id: "target-1",
        content: "WithMeta",
        metadata: { key: "value" },
      });
      expect(getText(result)).toContain("Message sent");
      expect(mockPrisma.agentMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ metadata: { key: "value" } }),
        }),
      );
    });

    it("should fail when target agent not found", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue(null);
      const result = await registry.call("swarm_send_message", {
        target_agent_id: "missing",
        content: "Hello",
      });
      expect(getText(result)).toContain("WORKSPACE_NOT_FOUND");
    });

    it("should fail when target agent is soft-deleted", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "target-1",
        displayName: "Deleted",
        deletedAt: new Date(),
      });
      const result = await registry.call("swarm_send_message", {
        target_agent_id: "target-1",
        content: "Hello",
      });
      expect(getText(result)).toContain("WORKSPACE_NOT_FOUND");
    });
  });

  describe("swarm_read_messages", () => {
    it("should read unread messages by default", async () => {
      const now = new Date();
      mockPrisma.agentMessage.findMany.mockResolvedValue([
        {
          id: "m1",
          role: "AGENT",
          content: "Hello there",
          isRead: false,
          metadata: null,
          createdAt: now,
        },
        {
          id: "m2",
          role: "SYSTEM",
          content: "Task assigned",
          isRead: false,
          metadata: null,
          createdAt: now,
        },
      ]);
      mockPrisma.agentMessage.updateMany.mockResolvedValue({ count: 2 });
      const result = await registry.call("swarm_read_messages", { agent_id: "agent-1" });
      const text = getText(result);
      expect(text).toContain("Messages (2)");
      expect(text).toContain("Hello there");
      expect(text).toContain("Task assigned");
      expect(mockPrisma.agentMessage.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ["m1", "m2"] } },
          data: { isRead: true },
        }),
      );
    });

    it("should return no messages when inbox is empty", async () => {
      mockPrisma.agentMessage.findMany.mockResolvedValue([]);
      const result = await registry.call("swarm_read_messages", { agent_id: "agent-1" });
      expect(getText(result)).toContain("No messages found");
    });

    it("should not mark as read when mark_as_read is false", async () => {
      const now = new Date();
      mockPrisma.agentMessage.findMany.mockResolvedValue([
        {
          id: "m1",
          role: "AGENT",
          content: "Hello",
          isRead: false,
          metadata: null,
          createdAt: now,
        },
      ]);
      await registry.call("swarm_read_messages", { agent_id: "agent-1", mark_as_read: false });
      expect(mockPrisma.agentMessage.updateMany).not.toHaveBeenCalled();
    });

    it("should show UNREAD label for unread messages", async () => {
      const now = new Date();
      mockPrisma.agentMessage.findMany.mockResolvedValue([
        {
          id: "m1",
          role: "AGENT",
          content: "Unread msg",
          isRead: false,
          metadata: null,
          createdAt: now,
        },
      ]);
      mockPrisma.agentMessage.updateMany.mockResolvedValue({ count: 1 });
      const result = await registry.call("swarm_read_messages", { agent_id: "agent-1" });
      expect(getText(result)).toContain("UNREAD");
    });

    it("should show READ label for already-read messages", async () => {
      const now = new Date();
      mockPrisma.agentMessage.findMany.mockResolvedValue([
        {
          id: "m1",
          role: "AGENT",
          content: "Old msg",
          isRead: true,
          metadata: null,
          createdAt: now,
        },
      ]);
      const result = await registry.call("swarm_read_messages", { agent_id: "agent-1", unread_only: false });
      expect(getText(result)).toContain("READ");
    });

    it("should skip updateMany when all messages are already read", async () => {
      const now = new Date();
      mockPrisma.agentMessage.findMany.mockResolvedValue([
        {
          id: "m1",
          role: "AGENT",
          content: "Already read",
          isRead: true,
          metadata: null,
          createdAt: now,
        },
      ]);
      await registry.call("swarm_read_messages", { agent_id: "agent-1", unread_only: false });
      expect(mockPrisma.agentMessage.updateMany).not.toHaveBeenCalled();
    });

    it("should truncate long messages in output", async () => {
      const now = new Date();
      const longContent = "x".repeat(300);
      mockPrisma.agentMessage.findMany.mockResolvedValue([
        {
          id: "m1",
          role: "AGENT",
          content: longContent,
          isRead: false,
          metadata: null,
          createdAt: now,
        },
      ]);
      mockPrisma.agentMessage.updateMany.mockResolvedValue({ count: 1 });
      const result = await registry.call("swarm_read_messages", { agent_id: "agent-1" });
      expect(getText(result)).toContain("...");
    });
  });

  describe("swarm_delegate_task", () => {
    it("should delegate a task to target agent", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "worker-1",
        displayName: "Worker",
        deletedAt: null,
      });
      mockPrisma.agentMessage.create.mockResolvedValue({
        id: "task-msg-1",
        agentId: "worker-1",
        role: "SYSTEM",
        content: "[TASK:MEDIUM] Fix the bug",
      });
      const result = await registry.call("swarm_delegate_task", {
        target_agent_id: "worker-1",
        task_description: "Fix the bug",
      });
      const text = getText(result);
      expect(text).toContain("Task delegated to Worker");
      expect(text).toContain("MEDIUM");
      expect(text).toContain("Fix the bug");
    });

    it("should delegate with custom priority", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "worker-1",
        displayName: "Worker",
        deletedAt: null,
      });
      mockPrisma.agentMessage.create.mockResolvedValue({
        id: "task-msg-2",
        agentId: "worker-1",
        role: "SYSTEM",
        content: "[TASK:CRITICAL] Deploy hotfix",
      });
      const result = await registry.call("swarm_delegate_task", {
        target_agent_id: "worker-1",
        task_description: "Deploy hotfix",
        priority: "critical",
      });
      expect(getText(result)).toContain("CRITICAL");
      expect(mockPrisma.agentMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: "SYSTEM",
            content: expect.stringContaining("[TASK:CRITICAL]"),
            metadata: expect.objectContaining({
              type: "delegation",
              priority: "critical",
              delegated_by: userId,
            }),
          }),
        }),
      );
    });

    it("should delegate with context", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "worker-1",
        displayName: "Worker",
        deletedAt: null,
      });
      mockPrisma.agentMessage.create.mockResolvedValue({
        id: "task-msg-3",
        agentId: "worker-1",
        role: "SYSTEM",
        content: "[TASK:HIGH] Review PR",
      });
      await registry.call("swarm_delegate_task", {
        target_agent_id: "worker-1",
        task_description: "Review PR",
        priority: "high",
        context: { pr_number: 42, repo: "spike-land" },
      });
      expect(mockPrisma.agentMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              context: { pr_number: 42, repo: "spike-land" },
            }),
          }),
        }),
      );
    });

    it("should fail when target agent not found", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue(null);
      const result = await registry.call("swarm_delegate_task", {
        target_agent_id: "missing",
        task_description: "Do something",
      });
      expect(getText(result)).toContain("WORKSPACE_NOT_FOUND");
    });

    it("should fail when target agent is stopped", async () => {
      mockPrisma.claudeCodeAgent.findUnique.mockResolvedValue({
        id: "worker-1",
        displayName: "StoppedWorker",
        deletedAt: new Date(),
      });
      const result = await registry.call("swarm_delegate_task", {
        target_agent_id: "worker-1",
        task_description: "Do something",
      });
      expect(getText(result)).toContain("WORKSPACE_NOT_FOUND");
    });
  });
});
