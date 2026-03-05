/**
 * Direct Message MCP Tools
 *
 * Send, list, and manage private messages between users.
 * Runs on Cloudflare Workers with Drizzle ORM.
 */

import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import { directMessages, users } from "../db/schema";
import type { DrizzleDB } from "../db/index";

export function registerDirectMessageTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool("dm_send", "Send a private message to a user by email address.", {
        content: z.string().min(1).describe("Body of the message."),
        toEmail: z
          .string()
          .email()
          .describe("Recipient email address (required)."),
      })
      .meta({ category: "direct-message", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { content, toEmail } = input;
        const targetEmail = toEmail;

        // Look up recipient by email
        const targetRows = await ctx.db
          .select({ id: users.id, email: users.email, name: users.name })
          .from(users)
          .where(eq(users.email, targetEmail))
          .limit(1);

        const targetUser = targetRows[0];
        if (!targetUser) {
          return textResult(
            `**Error:** Recipient not found (${targetEmail}). Please check the email address and try again.`,
          );
        }

        const id = crypto.randomUUID();
        await ctx.db.insert(directMessages).values({
          id,
          senderId: ctx.userId,
          recipientId: targetUser.id,
          content,
          createdAt: Date.now(),
        });

        return textResult(
          `**Message Sent**\n\n` +
            `**ID:** ${id}\n` +
            `**To:** ${targetUser.name || targetUser.email}\n` +
            `**Content:** ${content.substring(0, 100)}${content.length > 100 ? "..." : ""}`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("dm_list", "List direct messages for the current user.", {
        unreadOnly: z.boolean().optional().describe("When true, only return unread messages."),
        limit: z.number().optional().describe("Maximum number of messages to return (default 20)."),
      })
      .meta({ category: "direct-message", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { unreadOnly, limit } = input;

        const query = ctx.db
          .select({
            id: directMessages.id,
            senderId: directMessages.senderId,
            content: directMessages.content,
            readAt: directMessages.readAt,
            createdAt: directMessages.createdAt,
          })
          .from(directMessages)
          .where(
            unreadOnly
              ? and(eq(directMessages.recipientId, ctx.userId), isNull(directMessages.readAt))
              : eq(directMessages.recipientId, ctx.userId),
          )
          .orderBy(desc(directMessages.createdAt))
          .limit(limit || 20);

        const messages = await query;

        if (messages.length === 0) {
          return textResult(unreadOnly ? "No unread messages." : "No messages found.");
        }

        let text = `**Direct Messages (${messages.length}):**\n\n`;
        for (const msg of messages) {
          const preview = msg.content.length > 80 ? msg.content.slice(0, 80) + "..." : msg.content;
          const readStatus = msg.readAt ? "Read" : "Unread";
          const date = new Date(msg.createdAt).toISOString().split("T")[0];
          text += `- [${readStatus}] (${date})\n`;
          text += `  ID: ${msg.id} | From: ${msg.senderId}\n`;
          text += `  ${preview}\n\n`;
        }

        return textResult(text);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("dm_mark_read", "Mark a direct message as read.", {
        messageId: z.string().min(1).describe("ID of the direct message to mark as read."),
      })
      .meta({ category: "direct-message", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { messageId } = input;

        await ctx.db
          .update(directMessages)
          .set({ readAt: Date.now() })
          .where(and(eq(directMessages.id, messageId), eq(directMessages.recipientId, ctx.userId)));

        return textResult(`**Message marked as read.** (ID: ${messageId})`);
      }),
  );
}
