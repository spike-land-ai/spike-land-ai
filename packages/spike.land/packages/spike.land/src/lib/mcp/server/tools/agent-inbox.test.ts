import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  appMessage: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  app: { findFirst: vi.fn() },
  bazdmegChatMessage: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const mockUpstash = vi.hoisted(() => ({
  setMcpAgentActive: vi.fn().mockResolvedValue(undefined),
}));

const mockBroadcast = vi.hoisted(() => ({
  broadcastMessage: vi.fn(),
  broadcastCodeUpdated: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/upstash/client", () => mockUpstash);
vi.mock("@/app/api/apps/[id]/messages/stream/route", () => mockBroadcast);

import { createMockRegistry, getText } from "../__test-utils__";
import { registerAgentInboxTools } from "./agent-inbox";

describe("agent inbox tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerAgentInboxTools(registry, "user-123");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("registers 5 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("agent_inbox_poll")).toBe(true);
    expect(registry.handlers.has("agent_inbox_read")).toBe(true);
    expect(registry.handlers.has("agent_inbox_respond")).toBe(true);
    expect(registry.handlers.has("agent_inbox_site_chat_poll")).toBe(true);
    expect(registry.handlers.has("agent_inbox_site_chat_respond")).toBe(true);
  });

  describe("agent_inbox_poll", () => {
    it("should return no unread messages when empty", async () => {
      mockPrisma.appMessage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("agent_inbox_poll")!;
      const result = await handler({});

      expect(getText(result)).toContain("No unread messages");
      expect(getText(result)).toContain("serverTime");
    });

    it("should return grouped messages by app", async () => {
      mockPrisma.appMessage.findMany.mockResolvedValue([
        {
          id: "msg-1",
          appId: "app-1",
          content: "Hello from user",
          createdAt: new Date("2026-02-18T10:00:00Z"),
          app: { id: "app-1", name: "My App", codespaceId: "my-app" },
        },
        {
          id: "msg-2",
          appId: "app-1",
          content: "Another message",
          createdAt: new Date("2026-02-18T10:01:00Z"),
          app: { id: "app-1", name: "My App", codespaceId: "my-app" },
        },
        {
          id: "msg-3",
          appId: "app-2",
          content: "Different app message",
          createdAt: new Date("2026-02-18T10:02:00Z"),
          app: { id: "app-2", name: "Other App", codespaceId: "other-app" },
        },
      ]);

      const handler = registry.handlers.get("agent_inbox_poll")!;
      const result = await handler({});

      expect(getText(result)).toContain("Unread Messages (3 across 2 app(s))");
      expect(getText(result)).toContain("My App");
      expect(getText(result)).toContain("Other App");
      expect(getText(result)).toContain("Unread:** 2");
      expect(mockUpstash.setMcpAgentActive).toHaveBeenCalledWith("app-1");
      expect(mockUpstash.setMcpAgentActive).toHaveBeenCalledWith("app-2");
    });

    it("should filter by app_id when provided", async () => {
      mockPrisma.appMessage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("agent_inbox_poll")!;
      await handler({ app_id: "app-1" });

      expect(mockPrisma.appMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ appId: "app-1" }),
        }),
      );
      // Should still refresh MCP flag for the specific app
      expect(mockUpstash.setMcpAgentActive).toHaveBeenCalledWith("app-1");
    });

    it("should handle non-string content in messages", async () => {
      mockPrisma.appMessage.findMany.mockResolvedValue([
        {
          id: "msg-obj",
          appId: "app-1",
          content: { type: "json", data: "payload" },
          createdAt: new Date("2026-02-18T10:00:00Z"),
          app: { id: "app-1", name: null, codespaceId: null },
        },
      ]);

      const handler = registry.handlers.get("agent_inbox_poll")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Unread Messages");
      // When name and codespaceId are both null, should fall back to appId
      expect(text).toContain("app-1");
    });

    it("should truncate content at 200 chars and add ellipsis", async () => {
      const longContent = "A".repeat(250);
      mockPrisma.appMessage.findMany.mockResolvedValue([
        {
          id: "msg-long",
          appId: "app-1",
          content: longContent,
          createdAt: new Date("2026-02-18T10:00:00Z"),
          app: { id: "app-1", name: "Test", codespaceId: "test" },
        },
      ]);

      const handler = registry.handlers.get("agent_inbox_poll")!;
      const result = await handler({});

      expect(getText(result)).toContain("...");
    });

    it("should filter by since timestamp when provided", async () => {
      mockPrisma.appMessage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("agent_inbox_poll")!;
      await handler({ since: "2026-02-18T09:00:00Z" });

      expect(mockPrisma.appMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gt: new Date("2026-02-18T09:00:00Z") },
          }),
        }),
      );
    });
  });

  describe("agent_inbox_read", () => {
    it("should return error when app not found", async () => {
      mockPrisma.app.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("agent_inbox_read")!;
      const result = await handler({ app_id: "nonexistent" });

      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("App not found");
    });

    it("should return messages for an owned app", async () => {
      mockPrisma.app.findFirst.mockResolvedValue({
        id: "app-1",
        name: "Test App",
        codespaceId: "test-app",
      });
      mockPrisma.appMessage.findMany.mockResolvedValue([
        {
          id: "msg-1",
          role: "USER",
          content: "User question",
          isRead: false,
          createdAt: new Date("2026-02-18T10:00:00Z"),
          attachments: [],
          codeVersion: null,
        },
        {
          id: "msg-2",
          role: "AGENT",
          content: "Agent reply",
          isRead: false,
          createdAt: new Date("2026-02-18T10:01:00Z"),
          attachments: [],
          codeVersion: { id: "cv-1", createdAt: new Date() },
        },
      ]);

      const handler = registry.handlers.get("agent_inbox_read")!;
      const result = await handler({ app_id: "app-1" });

      expect(getText(result)).toContain("Test App");
      expect(getText(result)).toContain("User question");
      expect(getText(result)).toContain("Agent reply");
      expect(getText(result)).toContain("[User]");
      expect(getText(result)).toContain("[Agent]");
      expect(getText(result)).toContain("[Unread]");
      expect(getText(result)).toContain("Code version: cv-1");
    });

    it("should show [Read] status for read user messages", async () => {
      mockPrisma.app.findFirst.mockResolvedValue({
        id: "app-1",
        name: "Test App",
        codespaceId: "test-app",
      });
      mockPrisma.appMessage.findMany.mockResolvedValue([
        {
          id: "msg-read",
          role: "USER",
          content: "Already read message",
          isRead: true,
          createdAt: new Date("2026-02-18T10:00:00Z"),
          attachments: [],
          codeVersion: null,
        },
      ]);

      const handler = registry.handlers.get("agent_inbox_read")!;
      const result = await handler({ app_id: "app-1" });

      expect(getText(result)).toContain("[Read]");
    });

    it("should use codespaceId as fallback when name is null", async () => {
      mockPrisma.app.findFirst.mockResolvedValue({
        id: "app-1",
        name: null,
        codespaceId: "my-codespace",
      });
      mockPrisma.appMessage.findMany.mockResolvedValue([
        {
          id: "msg-1",
          role: "USER",
          content: "Hello",
          isRead: false,
          createdAt: new Date("2026-02-18T10:00:00Z"),
          attachments: [],
          codeVersion: null,
        },
      ]);

      const handler = registry.handlers.get("agent_inbox_read")!;
      const result = await handler({ app_id: "app-1" });

      expect(getText(result)).toContain("my-codespace");
    });

    it("should filter by since timestamp in read", async () => {
      mockPrisma.app.findFirst.mockResolvedValue({
        id: "app-1",
        name: "Test App",
        codespaceId: "test-app",
      });
      mockPrisma.appMessage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("agent_inbox_read")!;
      await handler({ app_id: "app-1", since: "2026-02-18T08:00:00Z" });

      expect(mockPrisma.appMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gt: new Date("2026-02-18T08:00:00Z") },
          }),
        }),
      );
    });

    it("should display attachments with url and imageId", async () => {
      mockPrisma.app.findFirst.mockResolvedValue({
        id: "app-1",
        name: "Test App",
        codespaceId: "test-app",
      });
      mockPrisma.appMessage.findMany.mockResolvedValue([
        {
          id: "msg-att",
          role: "USER",
          content: "See attached",
          isRead: false,
          createdAt: new Date("2026-02-18T10:00:00Z"),
          attachments: [
            {
              imageId: "img-1",
              image: { originalUrl: "https://example.com/file.png" },
            },
            { imageId: "img-123", image: { originalUrl: null } },
          ],
          codeVersion: null,
        },
      ]);

      const handler = registry.handlers.get("agent_inbox_read")!;
      const result = await handler({ app_id: "app-1" });

      expect(getText(result)).toContain("Attachments:");
      expect(getText(result)).toContain("https://example.com/file.png");
      expect(getText(result)).toContain("img-123");
    });

    it("should filter unread only", async () => {
      mockPrisma.app.findFirst.mockResolvedValue({
        id: "app-1",
        name: "Test App",
        codespaceId: "test-app",
      });
      mockPrisma.appMessage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("agent_inbox_read")!;
      await handler({ app_id: "app-1", unread_only: true });

      expect(mockPrisma.appMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: "USER",
            isRead: false,
          }),
        }),
      );
    });

    it("should return empty message when no messages found", async () => {
      mockPrisma.app.findFirst.mockResolvedValue({
        id: "app-1",
        name: "Test App",
        codespaceId: "test-app",
      });
      mockPrisma.appMessage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("agent_inbox_read")!;
      const result = await handler({ app_id: "app-1" });

      expect(getText(result)).toContain("No messages found");
    });

    it("should verify app ownership", async () => {
      mockPrisma.app.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("agent_inbox_read")!;
      await handler({ app_id: "app-1" });

      expect(mockPrisma.app.findFirst).toHaveBeenCalledWith({
        where: { id: "app-1", userId: "user-123" },
        select: { id: true, name: true, codespaceId: true },
      });
    });
  });

  describe("agent_inbox_respond", () => {
    it("should return error when app not found", async () => {
      mockPrisma.app.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("agent_inbox_respond")!;
      const result = await handler({ app_id: "nonexistent", content: "Hello" });

      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("App not found");
    });

    it("should create agent message and broadcast", async () => {
      mockPrisma.app.findFirst.mockResolvedValue({
        id: "app-1",
        name: "Test App",
        codespaceId: "test-app",
      });
      mockPrisma.appMessage.create.mockResolvedValue({
        id: "agent-msg-1",
        appId: "app-1",
        role: "AGENT",
        content: "Here is my response",
        createdAt: new Date("2026-02-18T10:05:00Z"),
      });
      mockPrisma.appMessage.updateMany.mockResolvedValue({ count: 1 });

      const handler = registry.handlers.get("agent_inbox_respond")!;
      const result = await handler({
        app_id: "app-1",
        content: "Here is my response",
        processed_message_ids: ["msg-1"],
      });

      expect(mockPrisma.appMessage.create).toHaveBeenCalledWith({
        data: {
          appId: "app-1",
          role: "AGENT",
          content: "Here is my response",
        },
      });
      expect(mockPrisma.appMessage.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["msg-1"] },
          appId: "app-1",
          role: "USER",
        },
        data: { isRead: true },
      });
      expect(mockBroadcast.broadcastMessage).toHaveBeenCalledWith("app-1", {
        id: "agent-msg-1",
        role: "AGENT",
        content: "Here is my response",
        createdAt: expect.any(Date),
      });
      expect(getText(result)).toContain("Response sent");
      expect(getText(result)).toContain("agent-msg-1");
      expect(getText(result)).toContain("Marked read:** 1");
    });

    it("should broadcast code update when code_updated is true", async () => {
      mockPrisma.app.findFirst.mockResolvedValue({
        id: "app-1",
        name: "Test App",
        codespaceId: "test-app",
      });
      mockPrisma.appMessage.create.mockResolvedValue({
        id: "agent-msg-2",
        appId: "app-1",
        role: "AGENT",
        content: "Updated your code",
        createdAt: new Date(),
      });

      const handler = registry.handlers.get("agent_inbox_respond")!;
      const result = await handler({
        app_id: "app-1",
        content: "Updated your code",
        code_updated: true,
      });

      expect(mockBroadcast.broadcastCodeUpdated).toHaveBeenCalledWith("app-1");
      expect(getText(result)).toContain("Code update broadcast sent");
    });

    it("should not mark messages as read when no processed_message_ids", async () => {
      mockPrisma.app.findFirst.mockResolvedValue({
        id: "app-1",
        name: "Test App",
        codespaceId: "test-app",
      });
      mockPrisma.appMessage.create.mockResolvedValue({
        id: "agent-msg-3",
        appId: "app-1",
        role: "AGENT",
        content: "Reply",
        createdAt: new Date(),
      });

      const handler = registry.handlers.get("agent_inbox_respond")!;
      await handler({ app_id: "app-1", content: "Reply" });

      expect(mockPrisma.appMessage.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("agent_inbox_site_chat_poll", () => {
    it("should return no pending messages when empty", async () => {
      mockPrisma.bazdmegChatMessage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("agent_inbox_site_chat_poll")!;
      const result = await handler({});

      expect(getText(result)).toContain("No pending site chat messages");
      expect(getText(result)).toContain("serverTime");
      expect(mockUpstash.setMcpAgentActive).toHaveBeenCalledWith("site-chat");
    });

    it("should return pending site chat messages", async () => {
      mockPrisma.bazdmegChatMessage.findMany.mockResolvedValue([
        {
          id: "chat-1",
          sessionId: "sess-abc",
          question: "How do I deploy?",
          route: "/docs",
          createdAt: new Date("2026-02-18T10:00:00Z"),
        },
      ]);

      const handler = registry.handlers.get("agent_inbox_site_chat_poll")!;
      const result = await handler({});

      expect(getText(result)).toContain("Pending Site Chat Messages (1)");
      expect(getText(result)).toContain("How do I deploy?");
      expect(getText(result)).toContain("/docs");
    });

    it("should filter by since timestamp", async () => {
      mockPrisma.bazdmegChatMessage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("agent_inbox_site_chat_poll")!;
      await handler({ since: "2026-02-18T09:00:00Z" });

      expect(mockPrisma.bazdmegChatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gt: new Date("2026-02-18T09:00:00Z") },
          }),
        }),
      );
    });
  });

  describe("agent_inbox_site_chat_respond", () => {
    it("should return error when message not found", async () => {
      mockPrisma.bazdmegChatMessage.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("agent_inbox_site_chat_respond")!;
      const result = await handler({
        message_id: "nonexistent",
        answer: "Hello",
      });

      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("not found");
    });

    it("should return error when message already has answer", async () => {
      mockPrisma.bazdmegChatMessage.findUnique.mockResolvedValue({
        id: "chat-1",
        question: "How?",
        answer: "Already answered",
      });

      const handler = registry.handlers.get("agent_inbox_site_chat_respond")!;
      const result = await handler({
        message_id: "chat-1",
        answer: "New answer",
      });

      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("already has an answer");
    });

    it("should save response and update message", async () => {
      mockPrisma.bazdmegChatMessage.findUnique.mockResolvedValue({
        id: "chat-1",
        question: "How do I deploy my app?",
        answer: null,
      });
      mockPrisma.bazdmegChatMessage.update.mockResolvedValue({
        id: "chat-1",
      });

      const handler = registry.handlers.get("agent_inbox_site_chat_respond")!;
      const result = await handler({
        message_id: "chat-1",
        answer: "You can deploy by running yarn deploy.",
      });

      expect(mockPrisma.bazdmegChatMessage.update).toHaveBeenCalledWith({
        where: { id: "chat-1" },
        data: {
          answer: "You can deploy by running yarn deploy.",
          model: "mcp-agent",
          agentModel: "mcp-agent",
        },
      });
      expect(getText(result)).toContain("Site chat response saved");
      expect(getText(result)).toContain("chat-1");
    });

    it("should use custom model name when provided", async () => {
      mockPrisma.bazdmegChatMessage.findUnique.mockResolvedValue({
        id: "chat-2",
        question: "Question",
        answer: null,
      });
      mockPrisma.bazdmegChatMessage.update.mockResolvedValue({
        id: "chat-2",
      });

      const handler = registry.handlers.get("agent_inbox_site_chat_respond")!;
      await handler({
        message_id: "chat-2",
        answer: "Answer",
        model: "claude-opus",
      });

      expect(mockPrisma.bazdmegChatMessage.update).toHaveBeenCalledWith({
        where: { id: "chat-2" },
        data: {
          answer: "Answer",
          model: "claude-opus",
          agentModel: "mcp-agent",
        },
      });
    });
  });
});
