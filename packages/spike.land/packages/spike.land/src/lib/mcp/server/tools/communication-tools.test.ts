import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  workspace: { findFirst: vi.fn(), update: vi.fn() },
  emailLog: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  notification: { findMany: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  newsletterSubscriber: { upsert: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import {
  registerEmailTools,
  registerNewsletterTools,
  registerNotificationsTools,
} from "./communication-tools";

// ── Email tools ──

describe("email tools", () => {
  const userId = "test-user-123";
  const wsId = "ws-1";
  const mockWorkspace = { id: wsId, slug: "my-ws", name: "My Workspace" };
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerEmailTools(registry, userId);
    mockPrisma.workspace.findFirst.mockResolvedValue(mockWorkspace);
  });

  it("should register 3 email tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("email_send")).toBe(true);
    expect(registry.handlers.has("email_get_status")).toBe(true);
    expect(registry.handlers.has("email_list")).toBe(true);
  });

  describe("email_send", () => {
    it("should create an email log with SENT status", async () => {
      mockPrisma.emailLog.create.mockResolvedValue({ id: "email-1" });
      const handler = registry.handlers.get("email_send")!;
      const result = await handler({
        workspace_slug: "my-ws",
        to: "recipient@example.com",
        subject: "Hello",
        template: "welcome",
      });
      const text = getText(result);
      expect(text).toContain("Email Queued");
      expect(text).toContain("email-1");
      expect(text).toContain("recipient@example.com");
      expect(text).toContain("SENT");
      expect(mockPrisma.emailLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          to: "recipient@example.com",
          subject: "Hello",
          template: "welcome",
          status: "SENT",
        }),
      });
    });
  });

  describe("email_get_status", () => {
    it("should return email delivery status", async () => {
      mockPrisma.emailLog.findFirst.mockResolvedValue({
        id: "email-1",
        to: "user@example.com",
        subject: "Hello",
        status: "DELIVERED",
        openedAt: new Date("2025-06-01"),
        clickedAt: null,
        bouncedAt: null,
      });
      const handler = registry.handlers.get("email_get_status")!;
      const result = await handler({
        workspace_slug: "my-ws",
        email_id: "email-1",
      });
      const text = getText(result);
      expect(text).toContain("Email Status");
      expect(text).toContain("DELIVERED");
      expect(text).toContain("Opened:");
      expect(text).toContain("Clicked:** No");
    });

    it("should show dates when openedAt, clickedAt, and bouncedAt are present", async () => {
      mockPrisma.emailLog.findFirst.mockResolvedValue({
        id: "email-2",
        to: "user@example.com",
        subject: "Promo",
        status: "DELIVERED",
        openedAt: new Date("2025-06-01T12:00:00Z"),
        clickedAt: new Date("2025-06-01T12:05:00Z"),
        bouncedAt: new Date("2025-06-01T12:10:00Z"),
      });
      const handler = registry.handlers.get("email_get_status")!;
      const result = await handler({
        workspace_slug: "my-ws",
        email_id: "email-2",
      });
      const text = getText(result);
      expect(text).toContain("Opened:** 2025-06-01T12:00:00.000Z");
      expect(text).toContain("Clicked:** 2025-06-01T12:05:00.000Z");
      expect(text).toContain("Bounced:** 2025-06-01T12:10:00.000Z");
    });

    it("should show 'No' for all null date fields", async () => {
      mockPrisma.emailLog.findFirst.mockResolvedValue({
        id: "email-3",
        to: "user@example.com",
        subject: "Test",
        status: "SENT",
        openedAt: null,
        clickedAt: null,
        bouncedAt: null,
      });
      const handler = registry.handlers.get("email_get_status")!;
      const result = await handler({
        workspace_slug: "my-ws",
        email_id: "email-3",
      });
      const text = getText(result);
      expect(text).toContain("Opened:** No");
      expect(text).toContain("Clicked:** No");
      expect(text).toContain("Bounced:** No");
    });

    it("should return NOT_FOUND for missing email", async () => {
      mockPrisma.emailLog.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("email_get_status")!;
      const result = await handler({
        workspace_slug: "my-ws",
        email_id: "missing",
      });
      expect(getText(result)).toContain("NOT_FOUND");
    });
  });

  describe("email_list", () => {
    it("should list email logs", async () => {
      mockPrisma.emailLog.findMany.mockResolvedValue([
        {
          id: "e-1",
          subject: "Welcome",
          to: "a@test.com",
          status: "SENT",
          sentAt: new Date("2025-06-01"),
        },
      ]);
      const handler = registry.handlers.get("email_list")!;
      const result = await handler({ workspace_slug: "my-ws" });
      const text = getText(result);
      expect(text).toContain("Email Logs");
      expect(text).toContain("Welcome");
    });

    it("should respect explicit limit parameter", async () => {
      mockPrisma.emailLog.findMany.mockResolvedValue([
        {
          id: "e-1",
          subject: "First",
          to: "a@test.com",
          status: "SENT",
          sentAt: new Date("2025-06-01"),
        },
      ]);
      const handler = registry.handlers.get("email_list")!;
      const result = await handler({ workspace_slug: "my-ws", limit: 5 });
      const text = getText(result);
      expect(text).toContain("Email Logs");
      expect(mockPrisma.emailLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it("should return message when no emails found", async () => {
      mockPrisma.emailLog.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("email_list")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("No email records found");
    });
  });
});

// ── Notifications tools ──

describe("notifications tools", () => {
  const userId = "test-user-123";
  const wsId = "ws-1";
  const mockWorkspace = { id: wsId, slug: "my-ws", name: "My Workspace" };
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerNotificationsTools(registry, userId);
    mockPrisma.workspace.findFirst.mockResolvedValue(mockWorkspace);
  });

  it("should register 4 notifications tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("notification_list")).toBe(true);
    expect(registry.handlers.has("notification_mark_read")).toBe(true);
    expect(registry.handlers.has("notification_configure_channels")).toBe(true);
    expect(registry.handlers.has("notification_send")).toBe(true);
  });

  describe("notification_list", () => {
    it("should list notifications", async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        {
          id: "n1",
          type: "INFO",
          title: "Welcome",
          message: "Hello!",
          read: false,
          createdAt: new Date("2025-06-01"),
        },
        {
          id: "n2",
          type: "ALERT",
          title: "Warning",
          message: "Check settings",
          read: true,
          createdAt: new Date("2025-06-02"),
        },
      ]);
      const handler = registry.handlers.get("notification_list")!;
      const result = await handler({ workspace_slug: "my-ws" });
      const text = getText(result);
      expect(text).toContain("Notifications (2)");
      expect(text).toContain("Welcome");
      expect(text).toContain("[UNREAD]");
      expect(text).toContain("Warning");
    });

    it("should return message when no notifications found", async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("notification_list")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("No notifications found");
    });

    it("should filter unread only", async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("notification_list")!;
      await handler({ workspace_slug: "my-ws", unread_only: true });
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ read: false }),
        }),
      );
    });
  });

  describe("notification_mark_read", () => {
    it("should mark notifications as read", async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });
      const handler = registry.handlers.get("notification_mark_read")!;
      const result = await handler({
        workspace_slug: "my-ws",
        notification_ids: ["n1", "n2", "n3"],
      });
      const text = getText(result);
      expect(text).toContain("Notifications Updated");
      expect(text).toContain("3");
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["n1", "n2", "n3"] } },
        data: expect.objectContaining({ read: true }),
      });
    });
  });

  describe("notification_configure_channels", () => {
    it("should update notification channel settings", async () => {
      mockPrisma.workspace.update.mockResolvedValue({});
      const handler = registry.handlers.get("notification_configure_channels")!;
      const result = await handler({
        workspace_slug: "my-ws",
        email_enabled: true,
        slack_enabled: false,
        in_app_enabled: true,
      });
      const text = getText(result);
      expect(text).toContain("Notification Channels Updated");
      expect(text).toContain("Email:** true");
      expect(text).toContain("Slack:** false");
      expect(text).toContain("In-App:** true");
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: wsId },
        data: {
          settings: {
            emailNotifications: true,
            slackNotifications: false,
            inAppNotifications: true,
          },
        },
      });
    });

    it("should handle partial channel updates", async () => {
      mockPrisma.workspace.update.mockResolvedValue({});
      const handler = registry.handlers.get("notification_configure_channels")!;
      const result = await handler({
        workspace_slug: "my-ws",
        email_enabled: false,
      });
      const text = getText(result);
      expect(text).toContain("Email:** false");
      expect(text).toContain("Slack:** (unchanged)");
    });

    it("should show (unchanged) for all channels when none are specified", async () => {
      mockPrisma.workspace.update.mockResolvedValue({});
      const handler = registry.handlers.get("notification_configure_channels")!;
      const result = await handler({ workspace_slug: "my-ws" });
      const text = getText(result);
      expect(text).toContain("Email:** (unchanged)");
      expect(text).toContain("Slack:** (unchanged)");
      expect(text).toContain("In-App:** (unchanged)");
    });
  });

  describe("notification_send", () => {
    it("should create a notification", async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: "notif-1" });
      const handler = registry.handlers.get("notification_send")!;
      const result = await handler({
        workspace_slug: "my-ws",
        title: "Deployment Complete",
        message: "v2.0 has been deployed",
        priority: "HIGH",
      });
      const text = getText(result);
      expect(text).toContain("Notification Sent");
      expect(text).toContain("notif-1");
      expect(text).toContain("HIGH");
      expect(text).toContain("workspace-wide");
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: wsId,
          userId: null,
          title: "Deployment Complete",
          priority: "HIGH",
          type: "MANUAL",
        }),
      });
    });

    it("should target a specific user when user_id provided", async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: "notif-2" });
      const handler = registry.handlers.get("notification_send")!;
      const result = await handler({
        workspace_slug: "my-ws",
        title: "Task Assigned",
        message: "You have a new task",
        user_id: "target-user-42",
      });
      const text = getText(result);
      expect(text).toContain("target-user-42");
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "target-user-42" }),
      });
    });
  });
});

// ── Newsletter tools ──

describe("newsletter tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerNewsletterTools(registry, userId);
  });

  it("should register 1 newsletter tool", () => {
    expect(registry.register).toHaveBeenCalledTimes(1);
  });

  describe("newsletter_subscribe", () => {
    it("should subscribe a new email", async () => {
      mockPrisma.newsletterSubscriber.upsert.mockResolvedValue({
        email: "test@example.com",
        subscribedAt: new Date("2024-06-15T12:00:00Z"),
        source: "mcp",
      });
      const handler = registry.handlers.get("newsletter_subscribe")!;
      const result = await handler({ email: "test@example.com" });
      expect(getText(result)).toContain("Newsletter Subscription Confirmed!");
      expect(getText(result)).toContain("test@example.com");
      expect(getText(result)).toContain("2024-06-15");
      expect(getText(result)).toContain("mcp");
      expect(mockPrisma.newsletterSubscriber.upsert).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        create: { email: "test@example.com", source: "mcp" },
        update: { unsubscribed: false, unsubscribedAt: null },
      });
    });

    it("should re-subscribe a previously unsubscribed email", async () => {
      mockPrisma.newsletterSubscriber.upsert.mockResolvedValue({
        email: "returning@example.com",
        subscribedAt: new Date("2024-01-01T00:00:00Z"),
        source: "mcp",
      });
      const handler = registry.handlers.get("newsletter_subscribe")!;
      const result = await handler({ email: "returning@example.com" });
      expect(getText(result)).toContain("Newsletter Subscription Confirmed!");
      expect(getText(result)).toContain("returning@example.com");
      expect(mockPrisma.newsletterSubscriber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { unsubscribed: false, unsubscribedAt: null },
        }),
      );
    });

    it("should handle database errors gracefully via safeToolCall", async () => {
      mockPrisma.newsletterSubscriber.upsert.mockRejectedValue(
        new Error("Database connection failed"),
      );
      const handler = registry.handlers.get("newsletter_subscribe")!;
      const result = await handler({ email: "fail@example.com" });
      expect(getText(result)).toContain("Error");
    });
  });
});
