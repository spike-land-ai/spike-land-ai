/**
 * My-Apps MCP Tools
 *
 * Full lifecycle management for user apps: create, list, get, chat,
 * messages, status, bin, restore, permanent delete, versions, batch.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { apiRequest, safeToolCall, textResult } from "./tool-helpers";

const AppsCreateSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .max(5000)
    .describe(
      "What the app should do. Be specific about features, layout, and behavior.",
    ),
  codespace_id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .optional()
    .describe(
      "Custom codespace ID (slug). Auto-generated if omitted. Example: 'my-dashboard'",
    ),
  image_ids: z
    .array(z.string())
    .max(5)
    .optional()
    .describe("Image IDs to attach as references (from image upload tools)."),
  template_id: z
    .string()
    .optional()
    .describe(
      "Start from a template. Use apps_list to discover available templates.",
    ),
});

const AppsListSchema = z.object({
  status: z
    .enum([
      "PROMPTING",
      "WAITING",
      "DRAFTING",
      "BUILDING",
      "FINE_TUNING",
      "TEST",
      "LIVE",
      "FAILED",
    ])
    .optional()
    .describe(
      "Filter by status. Omit to see all active apps (excludes ARCHIVED).",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("Max apps to return. Default: 20."),
});

const AppIdSchema = z.object({
  app_id: z
    .string()
    .min(1)
    .describe(
      "App identifier: codespace ID, slug, or database ID. Use apps_list to find it.",
    ),
});

const AppsChatSchema = z.object({
  app_id: z
    .string()
    .min(1)
    .describe("App identifier: codespace ID, slug, or database ID."),
  message: z
    .string()
    .min(1)
    .max(10000)
    .describe(
      "Your message to iterate on the app. Be specific about what to change.",
    ),
  image_ids: z
    .array(z.string())
    .max(5)
    .optional()
    .describe("Image IDs to attach as references."),
});

const AppsGetMessagesSchema = z.object({
  app_id: z
    .string()
    .min(1)
    .describe("App identifier."),
  cursor: z
    .string()
    .optional()
    .describe("Cursor for pagination. Omit for most recent messages."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("Max messages. Default: 20."),
});

const AppsSetStatusSchema = z.object({
  app_id: z
    .string()
    .min(1)
    .describe("App identifier."),
  status: z
    .enum(["ARCHIVED", "PROMPTING"])
    .describe("ARCHIVED stops the live app. PROMPTING resets to draft state."),
});

const AppsDeletePermanentSchema = z.object({
  app_id: z
    .string()
    .min(1)
    .describe("App identifier. Must already be in the bin."),
  confirm: z
    .boolean()
    .describe("Must be true. This action CANNOT be undone."),
});

const AppsBatchStatusSchema = z.object({
  app_ids: z
    .array(z.string().min(1))
    .min(1)
    .max(20)
    .describe("List of app identifiers."),
  status: z
    .enum(["ARCHIVED", "PROMPTING"])
    .describe("Target status for all apps."),
});

const AppsListVersionsSchema = z.object({
  app_id: z
    .string()
    .min(1)
    .describe("App identifier."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe("Max versions. Default: 10."),
});

export function registerAppsTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "apps_create",
    description: "Create a new app from a text prompt. This is the STARTING POINT for new apps — "
      + "do NOT use codespace_update to create apps. The AI will generate code based on your prompt.",
    category: "apps",
    tier: "free",
    inputSchema: AppsCreateSchema.shape,
    handler: async ({
      prompt,
      codespace_id,
      image_ids,
      template_id,
    }: z.infer<typeof AppsCreateSchema>): Promise<CallToolResult> =>
      safeToolCall("apps_create", async () => {
        const body: Record<string, unknown> = { prompt };
        if (codespace_id) body.codespaceId = codespace_id;
        if (image_ids?.length) body.imageIds = image_ids;
        if (template_id) body.templateId = template_id;

        const app = await apiRequest<{
          id: string;
          name: string;
          slug: string;
          status: string;
          codespaceId: string;
          codespaceUrl: string;
        }>("/api/apps", { method: "POST", body: JSON.stringify(body) });

        return textResult(
          `**App Created!**\n\n`
            + `**Name:** ${app.name}\n`
            + `**ID:** ${app.id}\n`
            + `**Slug:** ${app.slug}\n`
            + `**Status:** ${app.status}\n`
            + `**Codespace:** ${app.codespaceId}\n\n`
            + `The AI is now generating your app. Use \`apps_get\` to check progress, `
            + `or \`apps_chat\` to send follow-up instructions.`,
        );
      }),
  });

  registry.register({
    name: "apps_list",
    description: "List your apps. Call this FIRST to see what exists before making changes. "
      + "Returns app IDs needed for all other apps_* tools.",
    category: "apps",
    tier: "free",
    inputSchema: AppsListSchema.shape,
    handler: async ({
      status,
      limit,
    }: z.infer<typeof AppsListSchema>): Promise<CallToolResult> =>
      safeToolCall("apps_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const where: Record<string, unknown> = {
          userId,
          deletedAt: null,
        };
        if (status) {
          where.status = status;
        } else {
          where.status = { notIn: ["ARCHIVED"] };
        }

        const apps = await prisma.app.findMany({
          where,
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            codespaceId: true,
            lastAgentActivity: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { messages: true, images: true, codeVersions: true },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: limit,
        });

        if (apps.length === 0) {
          return textResult(
            `**My Apps (0)**\n\nNo apps found. Use \`apps_create\` to create your first app.`,
          );
        }

        let text = `**My Apps (${apps.length})**\n\n`;
        for (const app of apps) {
          text += `- **${app.name}** (${app.status})`;
          text += ` — ID: \`${app.codespaceId || app.slug || app.id}\``;
          text += ` | Messages: ${app._count.messages} | Versions: ${app._count.codeVersions}`;
          text += `\n`;
        }

        return textResult(text);
      }),
  });

  registry.register({
    name: "apps_get",
    description: "Get full app details including current code and status. Read before editing. "
      + "Returns the current code version, messages count, and agent activity status.",
    category: "apps",
    tier: "free",
    inputSchema: AppIdSchema.shape,
    handler: async ({
      app_id,
    }: z.infer<typeof AppIdSchema>): Promise<CallToolResult> =>
      safeToolCall("apps_get", async () => {
        const app = await apiRequest<{
          id: string;
          name: string;
          slug: string;
          description: string | null;
          status: string;
          codespaceId: string | null;
          codespaceUrl: string | null;
          agentWorking: boolean;
          lastAgentActivity: string | null;
          createdAt: string;
          updatedAt: string;
          _count?: { messages: number; images: number; };
          requirements?: Array<{ description: string; status: string; }>;
          statusHistory?: Array<
            { status: string; message: string | null; createdAt: string; }
          >;
        }>(`/api/apps/${encodeURIComponent(app_id)}`);

        let text = `**App: ${app.name}**\n\n`;
        text += `**ID:** ${app.id}\n`;
        text += `**Slug:** ${app.slug || "—"}\n`;
        text += `**Status:** ${app.status}\n`;
        text += `**Agent Working:** ${app.agentWorking ? "Yes" : "No"}\n`;
        if (app.description) text += `**Description:** ${app.description}\n`;
        if (app.codespaceId) text += `**Codespace:** ${app.codespaceId}\n`;
        if (app.codespaceUrl) {
          text += `**Preview:** https://testing.spike.land/live/${app.codespaceId}\n`;
        }
        text += `**Created:** ${app.createdAt}\n`;
        text += `**Updated:** ${app.updatedAt}\n`;

        if (app._count) {
          text += `**Messages:** ${app._count.messages} | **Images:** ${app._count.images}\n`;
        }

        if (app.statusHistory && app.statusHistory.length > 0) {
          text += `\n**Recent Status History:**\n`;
          for (const h of app.statusHistory.slice(0, 5)) {
            text += `- ${h.status}${h.message ? `: ${h.message}` : ""} (${h.createdAt})\n`;
          }
        }

        return textResult(text);
      }),
  });

  registry.register({
    name: "apps_chat",
    description: "Send a message to iterate on an existing app. PREFERRED over direct code edits — "
      + "the AI understands the app's context and will make targeted changes. "
      + "Use this for feature requests, bug fixes, or design changes.",
    category: "apps",
    tier: "free",
    inputSchema: AppsChatSchema.shape,
    handler: async ({
      app_id,
      message,
      image_ids,
    }: z.infer<typeof AppsChatSchema>): Promise<CallToolResult> =>
      safeToolCall("apps_chat", async () => {
        const body: Record<string, unknown> = {
          content: message,
          role: "USER",
        };
        if (image_ids?.length) body.imageIds = image_ids;

        const result = await apiRequest<{
          id: string;
          content: string;
          role: string;
          createdAt: string;
        }>(`/api/apps/${encodeURIComponent(app_id)}/messages`, {
          method: "POST",
          body: JSON.stringify(body),
        });

        return textResult(
          `**Message Sent!**\n\n`
            + `**Message ID:** ${result.id}\n`
            + `**Status:** The AI is processing your request.\n\n`
            + `Use \`apps_get\` to check when the agent finishes, `
            + `or \`apps_get_messages\` to see the conversation.`,
        );
      }),
  });

  registry.register({
    name: "apps_get_messages",
    description: "Get chat history for an app. Shows the conversation between user and AI agent.",
    category: "apps",
    tier: "free",
    inputSchema: AppsGetMessagesSchema.shape,
    handler: async ({
      app_id,
      cursor,
      limit,
    }: z.infer<typeof AppsGetMessagesSchema>): Promise<CallToolResult> =>
      safeToolCall("apps_get_messages", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const { findAppByIdentifierSimple } = await import("@/lib/app-lookup");

        const app = await findAppByIdentifierSimple(app_id, userId);
        if (!app) {
          return textResult(
            `**Error: APP_NOT_FOUND**\nApp '${app_id}' not found.\n**Suggestion:** Use \`apps_list\` to see available apps.\n**Retryable:** false`,
          );
        }

        const where: Record<string, unknown> = {
          appId: app.id,
          deletedAt: null,
        };
        if (cursor) {
          where.createdAt = { lt: new Date(cursor) };
        }

        const messages = await prisma.appMessage.findMany({
          where,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
            codeVersion: { select: { id: true, hash: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

        if (messages.length === 0) {
          return textResult(
            `**Messages for ${app_id}**\n\nNo messages yet. Use \`apps_chat\` to start the conversation.`,
          );
        }

        let text = `**Messages for ${app_id}** (${messages.length})\n\n`;
        // Reverse for chronological order
        for (const msg of [...messages].reverse()) {
          const role = msg.role === "USER" ? "You" : "Agent";
          const preview = msg.content.length > 300
            ? msg.content.slice(0, 300) + "..."
            : msg.content;
          text += `**${role}** (${msg.createdAt.toISOString()}):\n${preview}\n`;
          if (msg.codeVersion) {
            text += `_Code version: ${msg.codeVersion.hash}_\n`;
          }
          text += `\n`;
        }

        if (messages.length === limit) {
          const oldest = messages[messages.length - 1];
          text += `_More messages available. Pass cursor="${
            oldest!.createdAt.toISOString()
          }" for older messages._`;
        }

        return textResult(text);
      }),
  });

  registry.register({
    name: "apps_set_status",
    description:
      "Change app status. WARNING: ARCHIVED stops the live app and removes it from active list. "
      + "Use PROMPTING to reset an app back to draft state for re-generation.",
    category: "apps",
    tier: "free",
    inputSchema: AppsSetStatusSchema.shape,
    handler: async ({
      app_id,
      status,
    }: z.infer<typeof AppsSetStatusSchema>): Promise<CallToolResult> =>
      safeToolCall("apps_set_status", async () => {
        await apiRequest<{ success: boolean; }>(
          `/api/apps/${encodeURIComponent(app_id)}/status`,
          { method: "PATCH", body: JSON.stringify({ status }) },
        );

        return textResult(
          `**Status Updated!**\n\n`
            + `App \`${app_id}\` is now **${status}**.`
            + (status === "ARCHIVED"
              ? `\n\nThe app has been removed from your active list. Use \`apps_bin\` to soft-delete, or \`apps_set_status\` with PROMPTING to reactivate.`
              : ""),
        );
      }),
  });

  registry.register({
    name: "apps_bin",
    description: "Soft-delete app to recycle bin. Recoverable for 30 days. "
      + "For temporary deactivation, use apps_set_status with ARCHIVED instead.",
    category: "apps",
    tier: "free",
    inputSchema: AppIdSchema.shape,
    handler: async ({
      app_id,
    }: z.infer<typeof AppIdSchema>): Promise<CallToolResult> =>
      safeToolCall("apps_bin", async () => {
        await apiRequest(
          `/api/apps/${encodeURIComponent(app_id)}/bin`,
          { method: "POST" },
        );

        return textResult(
          `**Moved to Bin!**\n\n`
            + `App \`${app_id}\` is now in the recycle bin.\n`
            + `It will be permanently deleted after 30 days.\n`
            + `Use \`apps_restore\` to recover it.`,
        );
      }),
  });

  registry.register({
    name: "apps_restore",
    description: "Restore an app from the recycle bin.",
    category: "apps",
    tier: "free",
    inputSchema: AppIdSchema.shape,
    handler: async ({
      app_id,
    }: z.infer<typeof AppIdSchema>): Promise<CallToolResult> =>
      safeToolCall("apps_restore", async () => {
        await apiRequest(
          `/api/apps/${encodeURIComponent(app_id)}/bin/restore`,
          { method: "POST" },
        );

        return textResult(
          `**Restored!**\n\n`
            + `App \`${app_id}\` has been restored from the bin.\n`
            + `Use \`apps_get\` to see its current state.`,
        );
      }),
  });

  registry.register({
    name: "apps_delete_permanent",
    description: "PERMANENTLY delete an app. CANNOT be undone. The app must already be in the bin. "
      + "Requires confirm=true as a safety check.",
    category: "apps",
    tier: "free",
    inputSchema: AppsDeletePermanentSchema.shape,
    annotations: {
      destructiveHint: true,
    },
    handler: async ({
      app_id,
      confirm,
    }: z.infer<typeof AppsDeletePermanentSchema>): Promise<CallToolResult> =>
      safeToolCall("apps_delete_permanent", async () => {
        if (!confirm) {
          return textResult(
            `**Safety Check Failed**\n\n`
              + `You must set confirm=true to permanently delete an app. This action CANNOT be undone.`,
          );
        }

        await apiRequest(
          `/api/apps/${encodeURIComponent(app_id)}/permanent`,
          { method: "DELETE" },
        );

        return textResult(
          `**Permanently Deleted!**\n\nApp \`${app_id}\` has been permanently deleted. This cannot be undone.`,
        );
      }),
  });

  registry.register({
    name: "apps_list_versions",
    description: "List code versions (immutable snapshots) for an app. "
      + "Each version is created when the AI agent updates the code.",
    category: "apps",
    tier: "free",
    inputSchema: AppsListVersionsSchema.shape,
    handler: async ({
      app_id,
      limit,
    }: z.infer<typeof AppsListVersionsSchema>): Promise<CallToolResult> =>
      safeToolCall("apps_list_versions", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const { findAppByIdentifierSimple } = await import("@/lib/app-lookup");

        const app = await findAppByIdentifierSimple(app_id, userId);
        if (!app) {
          return textResult(
            `**Error: APP_NOT_FOUND**\nApp '${app_id}' not found.\n**Suggestion:** Use \`apps_list\` to see available apps.\n**Retryable:** false`,
          );
        }

        const versions = await prisma.appCodeVersion.findMany({
          where: { appId: app.id },
          select: {
            id: true,
            hash: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

        if (versions.length === 0) {
          return textResult(
            `**Versions for ${app_id}**\n\nNo code versions yet. The AI will create versions as it builds the app.`,
          );
        }

        let text = `**Versions for ${app_id}** (${versions.length})\n\n`;
        for (const v of versions) {
          text += `- **${v.hash.slice(0, 8)}** (${v.createdAt.toISOString()})`;
          if (v.description) text += ` — ${v.description}`;
          text += `\n  ID: ${v.id}\n`;
        }

        return textResult(text);
      }),
  });

  registry.register({
    name: "apps_batch_status",
    description: "AGENT-ONLY: Set status on multiple apps at once. No UI equivalent. "
      + "Useful for bulk archiving or reactivating apps.",
    category: "apps",
    tier: "free",
    inputSchema: AppsBatchStatusSchema.shape,
    handler: async ({
      app_ids,
      status,
    }: z.infer<typeof AppsBatchStatusSchema>): Promise<CallToolResult> =>
      safeToolCall("apps_batch_status", async () => {
        const results: Array<{ id: string; success: boolean; error?: string; }> = [];

        for (const id of app_ids) {
          try {
            await apiRequest(
              `/api/apps/${encodeURIComponent(id)}/status`,
              { method: "PATCH", body: JSON.stringify({ status }) },
            );
            results.push({ id, success: true });
          } catch (error) {
            const msg = error instanceof Error
              ? error.message
              : "Unknown error";
            results.push({ id, success: false, error: msg });
          }
        }

        const succeeded = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success);

        let text = `**Batch Status Update**\n\n`;
        text += `**Target:** ${status}\n`;
        text += `**Succeeded:** ${succeeded}/${results.length}\n`;

        if (failed.length > 0) {
          text += `\n**Failed:**\n`;
          for (const f of failed) {
            text += `- \`${f.id}\`: ${f.error}\n`;
          }
        }

        return textResult(text);
      }),
  });

  // apps_clear_messages - DELETE /api/apps/{id}/messages
  const AppsClearMessagesSchema = z.object({
    app_id: z.string().min(1).describe("App identifier."),
  });

  registry.register({
    name: "apps_clear_messages",
    description: "Clear all messages in an app's chat history. This action cannot be undone.",
    category: "apps",
    tier: "free",
    inputSchema: AppsClearMessagesSchema.shape,
    annotations: { destructiveHint: true },
    handler: async (
      { app_id }: z.infer<typeof AppsClearMessagesSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("apps_clear_messages", async () => {
        await apiRequest(`/api/apps/${encodeURIComponent(app_id)}/messages`, {
          method: "DELETE",
        });
        return textResult(
          `**Chat Cleared!**\n\nAll messages for app \`${app_id}\` have been deleted.`,
        );
      }),
  });

  // apps_upload_images - Validate and return upload instructions
  const AppsUploadImagesSchema = z.object({
    app_id: z.string().min(1).describe("App identifier."),
    image_count: z.number().int().min(1).max(5).describe(
      "Number of images to upload (max 5).",
    ),
  });

  registry.register({
    name: "apps_upload_images",
    description:
      "Get instructions for uploading images to an app. Returns the upload endpoint and requirements.",
    category: "apps",
    tier: "free",
    inputSchema: AppsUploadImagesSchema.shape,
    handler: async (
      { app_id, image_count }: z.infer<typeof AppsUploadImagesSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("apps_upload_images", async () => {
        return textResult(
          `**Image Upload Instructions**\n\n`
            + `**App:** \`${app_id}\`\n`
            + `**Count:** ${image_count}\n\n`
            + `POST to \`/api/apps/${app_id}/images\` with a multipart form:\n`
            + `- Field name: \`images\`\n`
            + `- Max per request: 5 images\n`
            + `- Accepted types: image/*\n\n`
            + `The response includes image IDs to use with \`apps_chat\`.`,
        );
      }),
  });

  const AppsGenerateCodespaceIdSchema = z.object({});

  registry.register({
    name: "apps_generate_codespace_id",
    description:
      "Generate a random codespace ID in the format 'adjective.noun.verb.suffix'. Useful for creating unique app identifiers.",
    category: "apps",
    tier: "free",
    inputSchema: AppsGenerateCodespaceIdSchema.shape,
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("apps_generate_codespace_id", async () => {
        const { generateCodespaceId } = await import("@/lib/apps/codespace-id");
        const id = generateCodespaceId();
        return textResult(
          `**Generated Codespace ID:** \`${id}\`\n\nUse this with \`apps_create\` by setting \`codespace_id\`.`,
        );
      }),
  });
}
