/**
 * BYOK (Bring Your Own Key) Tools (CF Workers)
 *
 * Let users store, list, delete, and test their own API keys
 * for AI providers (Anthropic, OpenAI, Google). Keys are encrypted
 * at rest using the same PBKDF2 -> AES-GCM-256 pattern as vault.ts.
 */

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool } from "../procedures/index";
import { textResult } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";
import { userApiKeyVault } from "../db/schema";

const PROVIDERS = ["anthropic", "openai", "google"] as const;

// ─── Encryption (same pattern as vault.ts) ──────────────────────────────────

async function encryptValue(userId: string, value: string, vaultSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyInput = vaultSecret ? `${vaultSecret}:${userId}` : userId;

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(keyInput),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const cryptoKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoder.encode(value),
  );

  const envelope = {
    v: vaultSecret ? 2 : 1,
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    salt: btoa(String.fromCharCode(...salt)),
  };
  return btoa(JSON.stringify(envelope));
}

async function decryptValue(userId: string, encrypted: string, vaultSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  const parsed = JSON.parse(atob(encrypted)) as {
    v?: number;
    iv: string;
    data: string;
    salt: string;
  };
  const iv = Uint8Array.from(atob(parsed.iv), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(parsed.data), (c) => c.charCodeAt(0));
  const salt = Uint8Array.from(atob(parsed.salt), (c) => c.charCodeAt(0));

  const keyInput = parsed.v === 2 && vaultSecret ? `${vaultSecret}:${userId}` : userId;

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(keyInput),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const cryptoKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
}

// ─── Provider validation endpoints ──────────────────────────────────────────

const PROVIDER_TEST_CONFIG: Record<string, { url: string; method: string; headers: (key: string) => Record<string, string>; body?: string }> = {
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: (key) => ({
      "x-api-key": key,
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
    }),
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
  },
  openai: {
    url: "https://api.openai.com/v1/models",
    method: "GET",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    method: "GET",
    headers: (key) => ({ "x-goog-api-key": key }),
  },
};

// ─── Tool Registration ──────────────────────────────────────────────────────

export function registerByokTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
  _kv?: KVNamespace,
  vaultSecret?: string,
): void {
  const t = freeTool(userId, db);
  const secret = vaultSecret ?? "";

  // byok_store_key
  registry.registerBuilt(
    t
      .tool(
        "byok_store_key",
        "Store your own API key for an AI provider (Anthropic, OpenAI, Google). " +
          "The key is encrypted at rest and used instead of platform credits.",
        {
          provider: z.enum(PROVIDERS).describe("AI provider: anthropic, openai, or google."),
          key: z.string().min(1).max(500).describe("Your API key for this provider."),
        },
      )
      .meta({ category: "byok", tier: "free" })
      .handler(async ({ input, ctx }) => {
        try {
          const encryptedKey = await encryptValue(ctx.userId, input.key, secret);
          const now = Date.now();

          const existing = await ctx.db
            .select({ id: userApiKeyVault.id })
            .from(userApiKeyVault)
            .where(
              and(
                eq(userApiKeyVault.userId, ctx.userId),
                eq(userApiKeyVault.provider, input.provider),
              ),
            )
            .limit(1);

          if (existing.length > 0 && existing[0]) {
            await ctx.db
              .update(userApiKeyVault)
              .set({ encryptedKey, updatedAt: now })
              .where(eq(userApiKeyVault.id, existing[0].id));
          } else {
            await ctx.db.insert(userApiKeyVault).values({
              id: crypto.randomUUID(),
              userId: ctx.userId,
              provider: input.provider,
              encryptedKey,
              createdAt: now,
              updatedAt: now,
            });
          }

          return textResult(
            `**BYOK Key Stored**\n\n` +
              `**Provider:** ${input.provider}\n` +
              `Your key is encrypted and will be used for ${input.provider} API calls instead of platform credits.`,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return { content: [{ type: "text" as const, text: `Error storing key: ${msg}` }], isError: true };
        }
      }),
  );

  // byok_list_keys
  registry.registerBuilt(
    t
      .tool(
        "byok_list_keys",
        "List all stored BYOK API keys. Returns provider names and dates only — never returns key values.",
        {},
      )
      .meta({ category: "byok", tier: "free" })
      .handler(async ({ ctx }) => {
        try {
          const keys = await ctx.db
            .select({
              provider: userApiKeyVault.provider,
              createdAt: userApiKeyVault.createdAt,
              updatedAt: userApiKeyVault.updatedAt,
            })
            .from(userApiKeyVault)
            .where(eq(userApiKeyVault.userId, ctx.userId));

          if (keys.length === 0) {
            return textResult(
              "**BYOK Keys (0)**\n\nNo API keys stored. Use `byok_store_key` to add one.",
            );
          }

          let text = `**BYOK Keys (${keys.length})**\n\n`;
          for (const k of keys) {
            text += `- **${k.provider}** — stored ${new Date(k.createdAt).toISOString()}, updated ${new Date(k.updatedAt).toISOString()}\n`;
          }

          return textResult(text);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return { content: [{ type: "text" as const, text: `Error listing keys: ${msg}` }], isError: true };
        }
      }),
  );

  // byok_delete_key
  registry.registerBuilt(
    t
      .tool(
        "byok_delete_key",
        "Delete a stored BYOK API key for an AI provider.",
        {
          provider: z.enum(PROVIDERS).describe("AI provider whose key to delete."),
        },
      )
      .meta({ category: "byok", tier: "free" })
      .handler(async ({ input, ctx }) => {
        try {
          const existing = await ctx.db
            .select({ id: userApiKeyVault.id })
            .from(userApiKeyVault)
            .where(
              and(
                eq(userApiKeyVault.userId, ctx.userId),
                eq(userApiKeyVault.provider, input.provider),
              ),
            )
            .limit(1);

          if (existing.length === 0) {
            return {
              content: [{ type: "text" as const, text: `No ${input.provider} key found.` }],
              isError: true,
            };
          }

          await ctx.db
            .delete(userApiKeyVault)
            .where(
              and(
                eq(userApiKeyVault.userId, ctx.userId),
                eq(userApiKeyVault.provider, input.provider),
              ),
            );

          return textResult(
            `**BYOK Key Deleted**\n\n**Provider:** ${input.provider}\n\nFuture ${input.provider} calls will use platform credits.`,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return { content: [{ type: "text" as const, text: `Error deleting key: ${msg}` }], isError: true };
        }
      }),
  );

  // byok_test_key
  registry.registerBuilt(
    t
      .tool(
        "byok_test_key",
        "Test a stored BYOK API key by making a minimal validation call to the provider.",
        {
          provider: z.enum(PROVIDERS).describe("AI provider whose key to test."),
        },
      )
      .meta({ category: "byok", tier: "free" })
      .handler(async ({ input, ctx }) => {
        try {
          const row = await ctx.db
            .select({ encryptedKey: userApiKeyVault.encryptedKey })
            .from(userApiKeyVault)
            .where(
              and(
                eq(userApiKeyVault.userId, ctx.userId),
                eq(userApiKeyVault.provider, input.provider),
              ),
            )
            .limit(1);

          if (row.length === 0 || !row[0]) {
            return {
              content: [{ type: "text" as const, text: `No ${input.provider} key found. Use \`byok_store_key\` first.` }],
              isError: true,
            };
          }

          const apiKey = await decryptValue(ctx.userId, row[0].encryptedKey, secret);
          const config = PROVIDER_TEST_CONFIG[input.provider];
          if (!config) {
            return {
              content: [{ type: "text" as const, text: `Unknown provider: ${input.provider}` }],
              isError: true,
            };
          }

          const response = await fetch(config.url, {
            method: config.method,
            headers: config.headers(apiKey),
            ...(config.body ? { body: config.body } : {}),
          });

          if (response.ok || response.status === 200 || response.status === 201) {
            return textResult(
              `**BYOK Key Valid**\n\n**Provider:** ${input.provider}\n**Status:** ${response.status} OK\n\nYour key is working correctly.`,
            );
          }

          const errorBody = await response.text().catch(() => "Unknown error");
          return {
            content: [{
              type: "text" as const,
              text: `**BYOK Key Invalid**\n\n**Provider:** ${input.provider}\n**Status:** ${response.status}\n**Error:** ${errorBody.slice(0, 500)}`,
            }],
            isError: true,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return { content: [{ type: "text" as const, text: `Error testing key: ${msg}` }], isError: true };
        }
      }),
  );
}
