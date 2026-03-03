import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  directMessage: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerDirectMessageTools } from "./direct-message";

describe("direct message tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerDirectMessageTools(registry, "user-123");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("registers 3 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("dm_send")).toBe(true);
    expect(registry.handlers.has("dm_list")).toBe(true);
    expect(registry.handlers.has("dm_mark_read")).toBe(true);
  });

  describe("dm_send", () => {
    it("should send a message to the default owner", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "owner-1",
        email: "zoltan@spike.land",
        name: "Zoltan",
      });
      mockPrisma.directMessage.create.mockResolvedValue({
        id: "dm-001",
        subject: "Hello",
        message: "Test message",
        priority: "MEDIUM",
      });

      const handler = registry.handlers.get("dm_send")!;
      const result = await handler({
        subject: "Hello",
        message: "Test message",
      });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: {
            equals: "zoltan@spike.land",
            mode: "insensitive",
          },
        },
        select: { id: true, email: true, name: true },
      });
      expect(mockPrisma.directMessage.create).toHaveBeenCalledWith({
        data: {
          fromUserId: "user-123",
          fromSessionId: null,
          toUserId: "owner-1",
          subject: "Hello",
          message: "Test message",
          priority: "MEDIUM",
        },
      });
      expect(getText(result)).toContain("Message Sent");
      expect(getText(result)).toContain("dm-001");
      expect(getText(result)).toContain("Zoltan");
    });

    it("should send a message to a specific email", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-456",
        email: "alice@example.com",
        name: "Alice",
      });
      mockPrisma.directMessage.create.mockResolvedValue({
        id: "dm-002",
        subject: "Urgent",
        message: "Please respond",
        priority: "URGENT",
      });

      const handler = registry.handlers.get("dm_send")!;
      const result = await handler({
        subject: "Urgent",
        message: "Please respond",
        toEmail: "alice@example.com",
        priority: "URGENT",
      });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: {
            equals: "alice@example.com",
            mode: "insensitive",
          },
        },
        select: { id: true, email: true, name: true },
      });
      expect(mockPrisma.directMessage.create).toHaveBeenCalledWith({
        data: {
          fromUserId: "user-123",
          fromSessionId: null,
          toUserId: "user-456",
          subject: "Urgent",
          message: "Please respond",
          priority: "URGENT",
        },
      });
      expect(getText(result)).toContain("Message Sent");
      expect(getText(result)).toContain("dm-002");
      expect(getText(result)).toContain("URGENT");
    });

    it("should use session ID when userId starts with session:", async () => {
      const sessionRegistry = createMockRegistry();
      registerDirectMessageTools(sessionRegistry, "session:abc-123");

      mockPrisma.user.findFirst.mockResolvedValue({
        id: "owner-1",
        email: "zoltan@spike.land",
        name: "Zoltan",
      });
      mockPrisma.directMessage.create.mockResolvedValue({
        id: "dm-003",
        subject: "From session",
        message: "Anonymous message",
        priority: "MEDIUM",
      });

      const handler = sessionRegistry.handlers.get("dm_send")!;
      await handler({ subject: "From session", message: "Anonymous message" });

      expect(mockPrisma.directMessage.create).toHaveBeenCalledWith({
        data: {
          fromUserId: null,
          fromSessionId: "session:abc-123",
          toUserId: "owner-1",
          subject: "From session",
          message: "Anonymous message",
          priority: "MEDIUM",
        },
      });
    });

    it("should fall back to email when name is null", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-789",
        email: "noname@example.com",
        name: null,
      });
      mockPrisma.directMessage.create.mockResolvedValue({
        id: "dm-004",
        subject: "Test",
        message: "Hello",
        priority: "MEDIUM",
      });

      const handler = registry.handlers.get("dm_send")!;
      const result = await handler({
        subject: "Test",
        message: "Hello",
        toEmail: "noname@example.com",
      });

      expect(getText(result)).toContain("noname@example.com");
      expect(getText(result)).toContain("Message Sent");
    });

    it("should find recipient with case-insensitive email lookup", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-mixed",
        email: "alice@example.com",
        name: "Alice",
      });
      mockPrisma.directMessage.create.mockResolvedValue({
        id: "dm-case",
        subject: "Case test",
        message: "Testing case",
        priority: "MEDIUM",
      });

      const handler = registry.handlers.get("dm_send")!;
      const result = await handler({
        subject: "Case test",
        message: "Testing case",
        toEmail: "Alice@EXAMPLE.COM",
      });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: {
            equals: "Alice@EXAMPLE.COM",
            mode: "insensitive",
          },
        },
        select: { id: true, email: true, name: true },
      });
      expect(getText(result)).toContain("Message Sent");
      expect(getText(result)).toContain("Alice");
    });

    it("should return error when recipient not found", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("dm_send")!;
      const result = await handler({
        subject: "Hello",
        message: "Test",
        toEmail: "nobody@example.com",
      });

      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Recipient not found");
      expect(getText(result)).toContain("nobody@example.com");
      expect(mockPrisma.directMessage.create).not.toHaveBeenCalled();
    });

    it("should return error when default owner not found", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("dm_send")!;
      const result = await handler({ subject: "Hello", message: "Test" });

      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Recipient not found");
      expect(getText(result)).toContain("zoltan@spike.land");
    });
  });

  describe("dm_list", () => {
    it("should list messages", async () => {
      mockPrisma.directMessage.findMany.mockResolvedValue([
        {
          id: "dm-001",
          subject: "First message",
          message: "Hello world",
          priority: "MEDIUM",
          read: false,
          createdAt: new Date("2026-02-15T10:00:00Z"),
        },
        {
          id: "dm-002",
          subject: "Second message",
          message: "Follow up",
          priority: "HIGH",
          read: true,
          createdAt: new Date("2026-02-14T08:00:00Z"),
        },
      ]);

      const handler = registry.handlers.get("dm_list")!;
      const result = await handler({});

      expect(mockPrisma.directMessage.findMany).toHaveBeenCalledWith({
        where: { toUserId: "user-123" },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      expect(getText(result)).toContain("Direct Messages (2)");
      expect(getText(result)).toContain("First message");
      expect(getText(result)).toContain("Second message");
      expect(getText(result)).toContain("Unread");
      expect(getText(result)).toContain("Read");
      expect(getText(result)).toContain("MEDIUM");
      expect(getText(result)).toContain("HIGH");
    });

    it("should return empty message when no messages found", async () => {
      mockPrisma.directMessage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("dm_list")!;
      const result = await handler({});

      expect(getText(result)).toContain("No messages found");
    });

    it("should filter unread only when specified", async () => {
      mockPrisma.directMessage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("dm_list")!;
      const result = await handler({ unreadOnly: true });

      expect(mockPrisma.directMessage.findMany).toHaveBeenCalledWith({
        where: { toUserId: "user-123", read: false },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      expect(getText(result)).toContain("No unread messages");
    });

    it("should respect custom limit", async () => {
      mockPrisma.directMessage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("dm_list")!;
      await handler({ limit: 5 });

      expect(mockPrisma.directMessage.findMany).toHaveBeenCalledWith({
        where: { toUserId: "user-123" },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
    });

    it("should truncate long message previews", async () => {
      const longMessage = "A".repeat(120);
      mockPrisma.directMessage.findMany.mockResolvedValue([
        {
          id: "dm-long",
          subject: "Long message",
          message: longMessage,
          priority: "LOW",
          read: false,
          createdAt: new Date("2026-02-15T10:00:00Z"),
        },
      ]);

      const handler = registry.handlers.get("dm_list")!;
      const result = await handler({});

      expect(getText(result)).toContain("...");
      expect(getText(result)).not.toContain(longMessage);
    });
  });

  describe("dm_mark_read", () => {
    it("should mark a message as read", async () => {
      mockPrisma.directMessage.update.mockResolvedValue({
        id: "dm-001",
        read: true,
        readAt: new Date(),
      });

      const handler = registry.handlers.get("dm_mark_read")!;
      const result = await handler({ messageId: "dm-001" });

      expect(mockPrisma.directMessage.update).toHaveBeenCalledWith({
        where: { id: "dm-001", toUserId: "user-123" },
        data: { read: true, readAt: expect.any(Date) },
      });
      expect(getText(result)).toContain("Message marked as read");
      expect(getText(result)).toContain("dm-001");
    });

    it("should propagate error when message not found", async () => {
      mockPrisma.directMessage.update.mockRejectedValue(
        new Error("Record not found"),
      );

      const handler = registry.handlers.get("dm_mark_read")!;
      const result = await handler({ messageId: "nonexistent" });

      // safeToolCall catches the error and returns a classified error result
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("not found");
    });
  });
});
