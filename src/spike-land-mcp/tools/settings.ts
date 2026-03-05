/**
 * Settings MCP Tools
 *
 * API key management: list, create, and revoke user API keys.
 * Runs on Cloudflare Workers with Drizzle ORM.
 */

import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import { apiKeys } from "../db/schema";
import type { DrizzleDB } from "../db/index";

/**
 * Generate a random hex string of the given byte length.
 */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 hash a string and return hex digest.
 */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function registerSettingsTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool("settings_list_api_keys", "List your API keys (keys are masked for security).", {})
      .meta({ category: "settings", tier: "free" })
      .handler(async ({ ctx }) => {
        const keys = await ctx.db
          .select({
            id: apiKeys.id,
            name: apiKeys.name,
            lastUsedAt: apiKeys.lastUsedAt,
            expiresAt: apiKeys.expiresAt,
            createdAt: apiKeys.createdAt,
          })
          .from(apiKeys)
          .where(eq(apiKeys.userId, ctx.userId))
          .orderBy(desc(apiKeys.createdAt));

        if (keys.length === 0) return textResult("No API keys found.");

        let text = `**API Keys (${keys.length}):**\n\n`;
        for (const k of keys) {
          const expired = k.expiresAt && k.expiresAt < Date.now();
          const status = expired ? "Expired" : "Active";
          text +=
            `- **${k.name}** [${status}]\n` +
            `  Last used: ${k.lastUsedAt ? new Date(k.lastUsedAt).toISOString() : "never"}\n` +
            `  Created: ${new Date(k.createdAt).toISOString()}\n` +
            `  ID: ${k.id}\n\n`;
        }
        return textResult(text);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("settings_create_api_key", "Create a new API key. The full key is shown ONLY once.", {
        name: z.string().min(1).max(50).describe("Name for the API key."),
      })
      .meta({ category: "settings", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { name } = input;

        // Generate the raw key: sk_ + 32 random hex chars
        const rawKey = `sk_${randomHex(16)}`;
        const keyHash = await sha256Hex(rawKey);
        const id = crypto.randomUUID();

        await ctx.db.insert(apiKeys).values({
          id,
          userId: ctx.userId,
          name: name.trim(),
          keyHash,
          createdAt: Date.now(),
        });

        return textResult(
          `**API Key Created!**\n\n` +
            `**ID:** ${id}\n` +
            `**Name:** ${name.trim()}\n` +
            `**Key:** ${rawKey}\n\n` +
            `**IMPORTANT:** Copy this key now. It will not be shown again.`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("settings_revoke_api_key", "Revoke (delete) an API key.", {
        key_id: z.string().min(1).describe("API key ID to revoke."),
      })
      .meta({ category: "settings", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { key_id } = input;

        // Verify ownership before deleting
        const keyRows = await ctx.db
          .select({ id: apiKeys.id, userId: apiKeys.userId })
          .from(apiKeys)
          .where(and(eq(apiKeys.id, key_id), eq(apiKeys.userId, ctx.userId)))
          .limit(1);

        if (keyRows.length === 0) {
          return textResult(`**Error: NOT_FOUND**\nAPI key not found.\n**Retryable:** false`);
        }

        await ctx.db
          .delete(apiKeys)
          .where(and(eq(apiKeys.id, key_id), eq(apiKeys.userId, ctx.userId)));

        return textResult(`**API Key Revoked!** ID: ${key_id}`);
      }),
  );
}
