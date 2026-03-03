/**
 * Communication MCP Tools
 *
 * Combined: email sending/tracking, notifications, and newsletter subscription.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { resolveWorkspace, safeToolCall, textResult } from "./tool-helpers";

// ── Email schemas ──

const EmailSendSchema = z.object({
  workspace_slug: z.string().min(1).describe("Workspace slug."),
  to: z.string().min(1).describe("Recipient email address."),
  subject: z.string().min(1).describe("Email subject line."),
  template: z.string().min(1).describe("Email template name."),
});

const EmailGetStatusSchema = z.object({
  workspace_slug: z.string().min(1).describe("Workspace slug."),
  email_id: z.string().min(1).describe("Email log ID."),
});

const EmailListSchema = z.object({
  workspace_slug: z.string().min(1).describe("Workspace slug."),
  limit: z.number().optional().default(20).describe(
    "Max records to return (default 20).",
  ),
});

// ── Notification schemas ──

const NotificationListSchema = z.object({
  workspace_slug: z.string().min(1).describe("Workspace slug."),
  unread_only: z.boolean().optional().default(false).describe(
    "Only show unread notifications.",
  ),
  limit: z.number().optional().default(20).describe(
    "Max items to return (default 20).",
  ),
});

const NotificationMarkReadSchema = z.object({
  workspace_slug: z.string().min(1).describe("Workspace slug."),
  notification_ids: z.array(z.string().min(1)).min(1).describe(
    "Array of notification IDs to mark as read.",
  ),
});

const NotificationConfigureChannelsSchema = z.object({
  workspace_slug: z.string().min(1).describe("Workspace slug."),
  email_enabled: z.boolean().optional().describe("Enable email notifications."),
  slack_enabled: z.boolean().optional().describe("Enable Slack notifications."),
  in_app_enabled: z.boolean().optional().describe(
    "Enable in-app notifications.",
  ),
});

const NotificationSendSchema = z.object({
  workspace_slug: z.string().min(1).describe("Workspace slug."),
  title: z.string().min(1).describe("Notification title."),
  message: z.string().min(1).describe("Notification message body."),
  priority: z.string().optional().default("MEDIUM").describe(
    "Priority: LOW, MEDIUM, HIGH (default MEDIUM).",
  ),
  user_id: z.string().optional().describe(
    "Specific user ID to notify. Omit for workspace-wide.",
  ),
});

// ── Newsletter schemas ──

const NewsletterSubscribeSchema = z.object({
  email: z.string().email().describe("Email address to subscribe."),
});

// ── Registration functions ──

export function registerEmailTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "email_send",
    description: "Send an email from the workspace. Records the send intent with SENT status.",
    category: "email",
    tier: "free",
    inputSchema: EmailSendSchema.shape,
    handler: async (
      args: z.infer<typeof EmailSendSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("email_send", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        await resolveWorkspace(userId, args.workspace_slug);
        const email = await prisma.emailLog.create({
          data: {
            userId,
            to: args.to,
            subject: args.subject,
            template: args.template,
            status: "SENT",
          },
        });
        return textResult(
          `**Email Queued**\n\n`
            + `**ID:** ${email.id}\n`
            + `**To:** ${args.to}\n`
            + `**Subject:** ${args.subject}\n`
            + `**Status:** SENT`,
        );
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "email_get_status",
    description: "Get the delivery status of a sent email.",
    category: "email",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: EmailGetStatusSchema.shape,
    handler: async (
      args: z.infer<typeof EmailGetStatusSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("email_get_status", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        await resolveWorkspace(userId, args.workspace_slug);
        const email = await prisma.emailLog.findFirst({
          where: { id: args.email_id },
        });
        if (!email) {
          return textResult(
            "**Error: NOT_FOUND**\nEmail record not found.\n**Retryable:** false",
          );
        }
        return textResult(
          `**Email Status**\n\n`
            + `**ID:** ${email.id}\n`
            + `**To:** ${email.to}\n`
            + `**Subject:** ${email.subject}\n`
            + `**Status:** ${email.status}\n`
            + `**Opened:** ${email.openedAt ? email.openedAt.toISOString() : "No"}\n`
            + `**Clicked:** ${email.clickedAt ? email.clickedAt.toISOString() : "No"}\n`
            + `**Bounced:** ${email.bouncedAt ? email.bouncedAt.toISOString() : "No"}`,
        );
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "email_list",
    description: "List recent email logs for the current user.",
    category: "email",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: EmailListSchema.shape,
    handler: async (
      args: z.infer<typeof EmailListSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("email_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        await resolveWorkspace(userId, args.workspace_slug);
        const emails = await prisma.emailLog.findMany({
          where: { userId },
          orderBy: { sentAt: "desc" },
          take: args.limit ?? 20,
        });
        if (emails.length === 0) {
          return textResult("**No email records found.**");
        }
        let text = `**Email Logs (${emails.length})**\n\n`;
        for (const e of emails) {
          text += `- **${e.subject}** to ${e.to} — ${e.status} — ${e.sentAt.toISOString()}\n`;
          text += `  ID: ${e.id}\n`;
        }
        return textResult(text);
      }, { timeoutMs: 30_000 }),
  });
}

export function registerNotificationsTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "notification_list",
    description: "List notifications for the workspace, optionally filtered to unread only.",
    category: "notifications",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: NotificationListSchema.shape,
    handler: async (
      args: z.infer<typeof NotificationListSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("notification_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const ws = await resolveWorkspace(userId, args.workspace_slug);
        const where: Record<string, unknown> = {
          workspaceId: ws.id,
          OR: [{ userId }, { userId: null }],
        };
        if (args.unread_only) where.read = false;
        const notifications = await prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: args.limit,
        });
        if (notifications.length === 0) {
          return textResult("**No notifications found.**");
        }
        const lines = notifications.map((
          n: {
            id: string;
            type: string;
            title: string;
            message: string;
            read: boolean;
            createdAt: Date;
          },
        ) =>
          `- ${
            n.read ? "" : "[UNREAD] "
          }**${n.title}** — ${n.message} — ${n.type} — ${n.createdAt.toISOString()}`
        );
        return textResult(
          `**Notifications (${notifications.length})**\n\n${lines.join("\n")}`,
        );
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "notification_mark_read",
    description: "Mark one or more notifications as read.",
    category: "notifications",
    tier: "free",
    inputSchema: NotificationMarkReadSchema.shape,
    handler: async (
      args: z.infer<typeof NotificationMarkReadSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("notification_mark_read", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        await resolveWorkspace(userId, args.workspace_slug);
        const result = await prisma.notification.updateMany({
          where: { id: { in: args.notification_ids } },
          data: { read: true, readAt: new Date() },
        });
        return textResult(
          `**Notifications Updated**\n\n`
            + `**Marked as read:** ${result.count}`,
        );
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "notification_configure_channels",
    description: "Configure notification delivery channels for the workspace.",
    category: "notifications",
    tier: "free",
    inputSchema: NotificationConfigureChannelsSchema.shape,
    handler: async (
      args: z.infer<typeof NotificationConfigureChannelsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("notification_configure_channels", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const ws = await resolveWorkspace(userId, args.workspace_slug);

        // Store notification channel preferences in workspace metadata
        const config: Record<string, boolean> = {};
        if (args.email_enabled !== undefined) {
          config.emailNotifications = args.email_enabled;
        }
        if (args.slack_enabled !== undefined) {
          config.slackNotifications = args.slack_enabled;
        }
        if (args.in_app_enabled !== undefined) {
          config.inAppNotifications = args.in_app_enabled;
        }

        await prisma.workspace.update({
          where: { id: ws.id },
          data: { settings: config },
        });

        return textResult(
          `**Notification Channels Updated**\n\n`
            + `**Email:** ${args.email_enabled ?? "(unchanged)"}\n`
            + `**Slack:** ${args.slack_enabled ?? "(unchanged)"}\n`
            + `**In-App:** ${args.in_app_enabled ?? "(unchanged)"}`,
        );
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "notification_send",
    description: "Send a notification to a specific user or the entire workspace.",
    category: "notifications",
    tier: "free",
    inputSchema: NotificationSendSchema.shape,
    handler: async (
      args: z.infer<typeof NotificationSendSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("notification_send", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const ws = await resolveWorkspace(userId, args.workspace_slug);
        const notification = await prisma.notification.create({
          data: {
            workspaceId: ws.id,
            userId: args.user_id ?? null,
            title: args.title,
            message: args.message,
            priority: args.priority,
            type: "MANUAL",
            read: false,
          },
        });
        return textResult(
          `**Notification Sent**\n\n`
            + `**ID:** ${notification.id}\n`
            + `**Title:** ${args.title}\n`
            + `**Priority:** ${args.priority}\n`
            + `**Target:** ${args.user_id ?? "workspace-wide"}`,
        );
      }, { timeoutMs: 30_000 }),
  });
}

export function registerNewsletterTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "newsletter_subscribe",
    description: "Subscribe an email address to the newsletter.",
    category: "newsletter",
    tier: "free",
    inputSchema: NewsletterSubscribeSchema.shape,
    handler: async (
      { email }: z.infer<typeof NewsletterSubscribeSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("newsletter_subscribe", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const subscriber = await prisma.newsletterSubscriber.upsert({
          where: { email },
          create: { email, source: "mcp" },
          update: { unsubscribed: false, unsubscribedAt: null },
        });

        return textResult(
          `**Newsletter Subscription Confirmed!**\n\n`
            + `**Email:** ${subscriber.email}\n`
            + `**Subscribed at:** ${subscriber.subscribedAt.toISOString()}\n`
            + `**Source:** ${subscriber.source}`,
        );
      }),
  });
}
