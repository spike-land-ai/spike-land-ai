/**
 * My-Apps MCP Tools (CF Workers)
 *
 * Full lifecycle management for user apps: create, list, get, chat,
 * messages, status, bin, restore, permanent delete, versions, batch.
 *
 * Most operations delegate to the spike.land API for codespace
 * transpilation and AI agent features.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "./types";
import { freeTool } from "../procedures/index";
import { apiRequest, textResult } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";

export function registerAppsTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "apps_create",
        "Use this when you have a workspace and want to create a personal app from a prompt. " +
          "Create a new app from a text prompt. This is the STARTING POINT for new apps. " +
          "The AI will generate code based on your prompt.",
        {
          prompt: z
            .string()
            .min(1)
            .max(5000)
            .describe("What the app should do. Be specific about features, layout, and behavior."),
          codespace_id: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-zA-Z0-9_.-]+$/)
            .optional()
            .describe("Custom codespace ID (slug). Auto-generated if omitted."),
          image_ids: z
            .array(z.string())
            .max(5)
            .optional()
            .describe("Image IDs to attach as references."),
          template_id: z.string().optional().describe("Start from a template."),
        },
      )
      .meta({ category: "apps", tier: "free" })
      .examples([
        {
          name: "create_todo_app",
          input: { prompt: "Create a simple todo list app with local storage." },
          description: "Create a basic app"
        },
        {
          name: "create_with_template",
          input: { prompt: "Make it a dark theme analytics dashboard.", template_id: "dashboard" },
          description: "Start from a dashboard template"
        }
      ])
      .handler(async ({ input }) => {
        const { prompt, codespace_id, image_ids, template_id } = input;

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
          `**App Created!**\n\n` +
            `**Name:** ${app.name}\n` +
            `**ID:** ${app.id}\n` +
            `**Slug:** ${app.slug}\n` +
            `**Status:** ${app.status}\n` +
            `**Codespace:** ${app.codespaceId}\n\n` +
            `The AI is now generating your app. Use \`apps_get\` to check progress, ` +
            `or \`apps_chat\` to send follow-up instructions.`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "apps_list",
        "List your apps. Call this FIRST to see what exists before making changes. " +
          "Returns app IDs needed for all other apps_* tools.",
        {
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
            .describe("Filter by status. Omit to see all active apps."),
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .optional()
            .default(20)
            .describe("Max apps to return. Default: 20."),
        },
      )
      .meta({ category: "apps", tier: "free" })
      .examples([
        {
          name: "list_active",
          input: { limit: 10 },
          description: "List up to 10 active apps"
        },
        {
          name: "list_live_apps",
          input: { status: "LIVE" },
          description: "List only published apps"
        }
      ])
      .handler(async ({ input }) => {
        const { status, limit } = input;
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        params.set("limit", String(limit));

        const apps = await apiRequest<
          Array<{
            id: string;
            name: string;
            slug: string;
            status: string;
            codespaceId: string | null;
            messageCount: number;
            versionCount: number;
          }>
        >(`/api/apps?${params.toString()}`);

        if (!Array.isArray(apps) || apps.length === 0) {
          return textResult(
            `**My Apps (0)**\n\nNo apps found. Use \`apps_create\` to create your first app.`,
          );
        }

        let text = `**My Apps (${apps.length})**\n\n`;
        for (const app of apps) {
          text += `- **${app.name}** (${app.status})`;
          text += ` -- ID: \`${app.codespaceId || app.slug || app.id}\``;
          if (app.messageCount !== undefined) {
            text += ` | Messages: ${app.messageCount}`;
          }
          if (app.versionCount !== undefined) {
            text += ` | Versions: ${app.versionCount}`;
          }
          text += `\n`;
        }

        return textResult(text);
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "apps_get",
        "Get full app details including current code and status. Read before editing.",
        {
          app_id: z.string().min(1).describe("App identifier: codespace ID, slug, or database ID."),
        },
      )
      .meta({ category: "apps", tier: "free" })
      .handler(async ({ input }) => {
        const { app_id } = input;

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
          _count?: { messages: number; images: number };
          statusHistory?: Array<{
            status: string;
            message: string | null;
            createdAt: string;
          }>;
        }>(`/api/apps/${encodeURIComponent(app_id)}`);

        let text = `**App: ${app.name}**\n\n`;
        text += `**ID:** ${app.id}\n`;
        text += `**Slug:** ${app.slug || "--"}\n`;
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
  );

  registry.registerBuilt(
    t
      .tool(
        "apps_preview",
        "Get the live preview URL for an app. Use this to quickly check your app in the browser.",
        {
          app_id: z.string().min(1).describe("App identifier: codespace ID, slug, or database ID."),
        },
      )
      .meta({ category: "apps", tier: "free" })
      .handler(async ({ input }) => {
        const { app_id } = input;

        const app = await apiRequest<{
          id: string;
          name: string;
          codespaceId: string | null;
          codespaceUrl: string | null;
          status: string;
        }>(`/api/apps/${encodeURIComponent(app_id)}`);

        if (!app.codespaceId) {
          return textResult(
            `**No Preview Available**\n\nApp "${app.name}" does not have a codespace yet. ` +
              `Current status: ${app.status}. The app may still be building.`,
          );
        }

        const previewUrl = `https://testing.spike.land/live/${app.codespaceId}`;

        return textResult(
          `**Live Preview**\n\n` +
            `**App:** ${app.name}\n` +
            `**Status:** ${app.status}\n` +
            `**Preview URL:** ${previewUrl}\n\n` +
            `Open this URL in a browser to see your app running live.`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "apps_chat",
        "Send a message to iterate on an existing app. PREFERRED over direct code edits.",
        {
          app_id: z.string().min(1).describe("App identifier: codespace ID, slug, or database ID."),
          message: z.string().min(1).max(10000).describe("Your message to iterate on the app."),
          image_ids: z
            .array(z.string())
            .max(5)
            .optional()
            .describe("Image IDs to attach as references."),
        },
      )
      .meta({ category: "apps", tier: "free" })
      .handler(async ({ input }) => {
        const { app_id, message, image_ids } = input;

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
          `**Message Sent!**\n\n` +
            `**Message ID:** ${result.id}\n` +
            `**Status:** The AI is processing your request.\n\n` +
            `Use \`apps_get\` to check when the agent finishes, ` +
            `or \`apps_get_messages\` to see the conversation.`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "apps_get_messages",
        "Get chat history for an app. Shows the conversation between user and AI agent.",
        {
          app_id: z.string().min(1).describe("App identifier."),
          cursor: z.string().optional().describe("Cursor for pagination. Omit for most recent."),
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .optional()
            .default(20)
            .describe("Max messages. Default: 20."),
        },
      )
      .meta({ category: "apps", tier: "free" })
      .handler(async ({ input }) => {
        const { app_id, cursor, limit } = input;
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        if (cursor) params.set("cursor", cursor);

        const messages = await apiRequest<
          Array<{
            id: string;
            role: string;
            content: string;
            createdAt: string;
            codeVersionHash?: string;
          }>
        >(`/api/apps/${encodeURIComponent(app_id)}/messages?${params.toString()}`);

        if (!Array.isArray(messages) || messages.length === 0) {
          return textResult(
            `**Messages for ${app_id}**\n\nNo messages yet. Use \`apps_chat\` to start the conversation.`,
          );
        }

        let text = `**Messages for ${app_id}** (${messages.length})\n\n`;
        for (const msg of messages) {
          const role = msg.role === "USER" ? "You" : "Agent";
          const preview =
            msg.content.length > 300 ? msg.content.slice(0, 300) + "..." : msg.content;
          text += `**${role}** (${msg.createdAt}):\n${preview}\n`;
          if (msg.codeVersionHash) {
            text += `_Code version: ${msg.codeVersionHash}_\n`;
          }
          text += `\n`;
        }

        return textResult(text);
      }),
  );

  registry.registerBuilt(
    t
      .tool("apps_set_status", "Change app status. WARNING: ARCHIVED stops the live app.", {
        app_id: z.string().min(1).describe("App identifier."),
        status: z
          .enum(["ARCHIVED", "PROMPTING", "LIVE", "TEST"])
          .describe("LIVE publishes the app. TEST marks it for testing. ARCHIVED stops the live app. PROMPTING resets to draft state."),
      })
      .meta({ category: "apps", tier: "free" })
      .handler(async ({ input }) => {
        const { app_id, status } = input;

        await apiRequest<{ success: boolean }>(`/api/apps/${encodeURIComponent(app_id)}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });

        return textResult(
          `**Status Updated!**\n\nApp \`${app_id}\` is now **${status}**.` +
            (status === "ARCHIVED" ? `\n\nThe app has been removed from your active list.` : ""),
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool("apps_bin", "Soft-delete app to recycle bin. Recoverable for 30 days.", {
        app_id: z.string().min(1).describe("App identifier."),
      })
      .meta({ category: "apps", tier: "free" })
      .handler(async ({ input }) => {
        const { app_id } = input;

        await apiRequest(`/api/apps/${encodeURIComponent(app_id)}/bin`, {
          method: "POST",
        });

        return textResult(
          `**Moved to Bin!**\n\n` +
            `App \`${app_id}\` is now in the recycle bin.\n` +
            `It will be permanently deleted after 30 days.\n` +
            `Use \`apps_restore\` to recover it.`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool("apps_restore", "Restore an app from the recycle bin.", {
        app_id: z.string().min(1).describe("App identifier."),
      })
      .meta({ category: "apps", tier: "free" })
      .handler(async ({ input }) => {
        const { app_id } = input;

        await apiRequest(`/api/apps/${encodeURIComponent(app_id)}/bin/restore`, { method: "POST" });

        return textResult(
          `**Restored!**\n\n` +
            `App \`${app_id}\` has been restored from the bin.\n` +
            `Use \`apps_get\` to see its current state.`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "apps_delete_permanent",
        "PERMANENTLY delete an app. CANNOT be undone. Must be in the bin first.",
        {
          app_id: z.string().min(1).describe("App identifier. Must already be in the bin."),
          confirm: z.boolean().describe("Must be true. This action CANNOT be undone."),
        },
      )
      .meta({ category: "apps", tier: "free" })
      .handler(async ({ input }) => {
        const { app_id, confirm } = input;

        if (!confirm) {
          return textResult(
            `**Safety Check Failed**\n\n` +
              `You must set confirm=true to permanently delete an app.`,
          );
        }

        await apiRequest(`/api/apps/${encodeURIComponent(app_id)}/permanent`, {
          method: "DELETE",
        });

        return textResult(
          `**Permanently Deleted!**\n\nApp \`${app_id}\` has been permanently deleted. This cannot be undone.`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool("apps_list_versions", "List code versions for an app.", {
        app_id: z.string().min(1).describe("App identifier."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Max versions. Default: 10."),
      })
      .meta({ category: "apps", tier: "free" })
      .handler(async ({ input }) => {
        const { app_id, limit } = input;
        const params = new URLSearchParams();
        params.set("limit", String(limit));

        const versions = await apiRequest<
          Array<{
            id: string;
            hash: string;
            description: string | null;
            createdAt: string;
          }>
        >(`/api/apps/${encodeURIComponent(app_id)}/versions?${params.toString()}`);

        if (!Array.isArray(versions) || versions.length === 0) {
          return textResult(`**Versions for ${app_id}**\n\nNo code versions yet.`);
        }

        let text = `**Versions for ${app_id}** (${versions.length})\n\n`;
        for (const v of versions) {
          text += `- **${v.hash.slice(0, 8)}** (${v.createdAt})`;
          if (v.description) text += ` -- ${v.description}`;
          text += `\n  ID: ${v.id}\n`;
        }

        return textResult(text);
      }),
  );

  registry.registerBuilt(
    t
      .tool("apps_batch_status", "Set status on multiple apps at once.", {
        app_ids: z.array(z.string().min(1)).min(1).max(20).describe("List of app identifiers."),
        status: z.enum(["ARCHIVED", "PROMPTING", "LIVE", "TEST"]).describe("Target status for all apps."),
      })
      .meta({ category: "apps", tier: "free" })
      .handler(async ({ input }) => {
        const { app_ids, status } = input;

        const results: Array<{
          id: string;
          success: boolean;
          error?: string;
        }> = [];

        for (const id of app_ids) {
          try {
            await apiRequest(`/api/apps/${encodeURIComponent(id)}/status`, {
              method: "PATCH",
              body: JSON.stringify({ status }),
            });
            results.push({ id, success: true });
          } catch (error) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            results.push({ id, success: false, error: msg });
          }
        }

        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success);

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
  );

  registry.registerBuilt(
    t
      .tool(
        "apps_clear_messages",
        "Clear all messages in an app's chat history. Cannot be undone.",
        {
          app_id: z.string().min(1).describe("App identifier."),
        },
      )
      .meta({ category: "apps", tier: "free" })
      .handler(async ({ input }) => {
        const { app_id } = input;

        await apiRequest(`/api/apps/${encodeURIComponent(app_id)}/messages`, {
          method: "DELETE",
        });

        return textResult(
          `**Chat Cleared!**\n\nAll messages for app \`${app_id}\` have been deleted.`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool("apps_upload_images", "Get instructions for uploading images to an app.", {
        app_id: z.string().min(1).describe("App identifier."),
        image_count: z.number().int().min(1).max(5).describe("Number of images to upload (max 5)."),
      })
      .meta({ category: "apps", tier: "free" })
      .handler(async ({ input }) => {
        const { app_id, image_count } = input;

        return textResult(
          `**Image Upload Instructions**\n\n` +
            `**App:** \`${app_id}\`\n` +
            `**Count:** ${image_count}\n\n` +
            `POST to \`/api/apps/${app_id}/images\` with a multipart form:\n` +
            `- Field name: \`images\`\n` +
            `- Max per request: 5 images\n` +
            `- Accepted types: image/*\n\n` +
            `The response includes image IDs to use with \`apps_chat\`.`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "apps_generate_codespace_id",
        "Generate a random codespace ID. Useful for creating unique app identifiers.",
        {},
      )
      .meta({ category: "apps", tier: "free" })
      .handler(async () => {
        // Simple ID generation
        const adjectives = [
          "bright",
          "calm",
          "dark",
          "eager",
          "fast",
          "glad",
          "keen",
          "loud",
          "neat",
          "pure",
        ];
        const nouns = [
          "beam",
          "cloud",
          "dawn",
          "edge",
          "flow",
          "gate",
          "hive",
          "iris",
          "jade",
          "kite",
        ];
        const verbs = [
          "build",
          "craft",
          "drift",
          "forge",
          "gleam",
          "hover",
          "ignite",
          "join",
          "knit",
          "leap",
        ];
        const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]!;
        const suffix = Math.random().toString(36).substring(2, 6);
        const id = `${pick(adjectives)}.${pick(nouns)}.${pick(verbs)}.${suffix}`;

        return textResult(
          `**Generated Codespace ID:** \`${id}\`\n\nUse this with \`apps_create\` by setting \`codespace_id\`.`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "apps_list_templates",
        "List available starter templates for app creation. Use a template_id with apps_create to start from a template instead of a blank prompt.",
        {},
      )
      .meta({ category: "apps", tier: "free" })
      .handler(async () => {
        const templates = [
          { id: "blank", name: "Blank Canvas", description: "Start from scratch with an empty React app" },
          { id: "dashboard", name: "Dashboard", description: "Admin dashboard with charts, tables, and sidebar navigation" },
          { id: "landing-page", name: "Landing Page", description: "Marketing landing page with hero, features, and CTA sections" },
          { id: "portfolio", name: "Portfolio", description: "Personal portfolio with project gallery and about section" },
          { id: "chat-app", name: "Chat App", description: "Real-time chat interface with message history and user list" },
        ];

        let text = `**Available App Templates (${templates.length})**\n\n`;
        for (const tmpl of templates) {
          text += `- **${tmpl.name}** (ID: \`${tmpl.id}\`)\n  ${tmpl.description}\n\n`;
        }
        text += `Use \`apps_create\` with \`template_id\` to start from a template.`;

        return textResult(text);
      }),
  );
}
