/**
 * Vault Tools (CF Workers)
 *
 * Sealed Secret Vault — agents can store encrypted secrets
 * but NEVER read them back in plaintext.
 *
 * SECURITY: Do NOT add a vault_approve_secret tool here.
 * Secret approval MUST go through the dashboard (human-in-the-loop).
 *
 * Ported from spike.land — uses Drizzle D1 + WebCrypto AES-GCM.
 * Simplified: no iv/tag/status/allowedUrls separate fields.
 * The encryptedValue stores a JSON envelope with all crypto material.
 */

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool } from "../procedures/index";
import type { DrizzleDB } from "../db/index";
import { subscriptions, vaultSecrets } from "../db/schema";

const FREE_SECRET_LIMIT = 25;
const PREMIUM_SECRET_LIMIT = 500;

async function getSecretCount(db: DrizzleDB, userId: string): Promise<number> {
  const result = await db
    .select({ id: vaultSecrets.id })
    .from(vaultSecrets)
    .where(eq(vaultSecrets.userId, userId));
  return result.length;
}

async function getSecretLimit(db: DrizzleDB, userId: string): Promise<number> {
  const sub = await db
    .select({ plan: subscriptions.plan })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  if (sub.length > 0 && sub[0] && sub[0].plan !== "free") {
    return PREMIUM_SECRET_LIMIT;
  }
  return FREE_SECRET_LIMIT;
}

async function encryptValue(userId: string, value: string, vaultSecret: string): Promise<string> {
  const encoder = new TextEncoder();

  // Random per-secret salt (16 bytes) prevents identical userIds yielding identical keys
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // v2: Combine server-side pepper with userId so offline key derivation is infeasible
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

  // Envelope includes the random salt so decryption can reconstruct the key
  // v: 2 marks secrets encrypted with the server-side pepper
  const envelope = {
    v: vaultSecret ? 2 : 1,
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    salt: btoa(String.fromCharCode(...salt)),
  };
  return btoa(JSON.stringify(envelope));
}

export function registerVaultTools(registry: ToolRegistry, userId: string, db: DrizzleDB, _kv?: KVNamespace, vaultSecret?: string): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "vault_store_secret",
        "Store an encrypted secret (API key, OAuth token, etc.) in the vault. " +
          "The secret is encrypted at rest and NEVER readable in plaintext.",
        {
          name: z
            .string()
            .min(1)
            .max(100)
            .regex(
              /^[a-zA-Z][a-zA-Z0-9_]*$/,
              "Name must start with a letter and contain only letters, numbers, and underscores",
            )
            .describe("Secret name (e.g. OPENAI_API_KEY)."),
          value: z.string().min(1).max(10000).describe("The secret value to encrypt and store."),
        },
      )
      .meta({ category: "vault", tier: "free" })
      .examples([
        {
          name: "store_openai_key",
          input: { name: "OPENAI_API_KEY", value: "sk-proj-1234567890" },
          description: "Store an OpenAI API key"
        },
        {
          name: "store_github_token",
          input: { name: "GITHUB_TOKEN", value: "ghp_abcdefghijklmno" },
          description: "Store a GitHub personal access token"
        }
      ])
      .handler(async ({ input, ctx }) => {
        try {
          const [count, limit] = await Promise.all([
            getSecretCount(ctx.db, ctx.userId),
            getSecretLimit(ctx.db, ctx.userId),
          ]);

          if (count >= limit) {
            return {
              content: [
                {
                  type: "text",
                  text: `Secret limit reached (${count}/${limit}). Upgrade to Premium for up to ${PREMIUM_SECRET_LIMIT} secrets.`,
                },
              ],
              isError: true,
            };
          }

          const encryptedValue = await encryptValue(ctx.userId, input.value, vaultSecret ?? "");
          const now = Date.now();

          // Check if secret with this key already exists for this user
          const existing = await ctx.db
            .select({ id: vaultSecrets.id })
            .from(vaultSecrets)
            .where(and(eq(vaultSecrets.userId, ctx.userId), eq(vaultSecrets.key, input.name)))
            .limit(1);

          let secretId: string;

          if (existing.length > 0 && existing[0]) {
            secretId = existing[0].id;
            await ctx.db
              .update(vaultSecrets)
              .set({ encryptedValue, updatedAt: now })
              .where(eq(vaultSecrets.id, secretId));
          } else {
            secretId = crypto.randomUUID();
            await ctx.db.insert(vaultSecrets).values({
              id: secretId,
              userId: ctx.userId,
              key: input.name,
              encryptedValue,
              createdAt: now,
              updatedAt: now,
            });
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `**Secret Stored!**\n\n` +
                  `**ID:** ${secretId}\n` +
                  `**Name:** ${input.name}\n\n` +
                  `The secret is encrypted and cannot be read back.`,
              },
            ],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return {
            content: [{ type: "text", text: `Error storing secret: ${msg}` }],
            isError: true,
          };
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "vault_list_secrets",
        "List all secrets in the vault. Returns names only — NEVER returns secret values.",
        {},
      )
      .meta({ category: "vault", tier: "free" })
      .examples([
        {
          name: "list_secrets",
          input: {},
          description: "List all stored secrets"
        }
      ])
      .handler(async ({ ctx }) => {
        try {
          const secrets = await ctx.db
            .select({
              id: vaultSecrets.id,
              key: vaultSecrets.key,
              createdAt: vaultSecrets.createdAt,
            })
            .from(vaultSecrets)
            .where(eq(vaultSecrets.userId, ctx.userId));

          const [count, limit] = await Promise.all([
            getSecretCount(ctx.db, ctx.userId),
            getSecretLimit(ctx.db, ctx.userId),
          ]);

          if (secrets.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `**Vault (${count}/${limit} secrets)**\n\nNo secrets stored. Use \`vault_store_secret\` to add one.`,
                },
              ],
            };
          }

          let text = `**Vault (${count}/${limit} secrets)**\n\n`;
          for (const s of secrets) {
            text += `- **${s.key}** — ID: ${s.id}\n  Created: ${new Date(
              s.createdAt,
            ).toISOString()}\n`;
          }

          return { content: [{ type: "text", text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return {
            content: [{ type: "text", text: `Error listing secrets: ${msg}` }],
            isError: true,
          };
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool("vault_delete_secret", "Delete a secret from the vault.", {
        secret_id: z.string().min(1).describe("The ID of the secret to delete."),
      })
      .meta({ category: "vault", tier: "free" })
      .handler(async ({ input, ctx }) => {
        try {
          const secret = await ctx.db
            .select({ id: vaultSecrets.id, key: vaultSecrets.key })
            .from(vaultSecrets)
            .where(and(eq(vaultSecrets.id, input.secret_id), eq(vaultSecrets.userId, ctx.userId)))
            .limit(1);

          if (secret.length === 0 || !secret[0]) {
            return {
              content: [
                {
                  type: "text",
                  text: `Secret not found or you don't have access.`,
                },
              ],
              isError: true,
            };
          }

          await ctx.db.delete(vaultSecrets).where(eq(vaultSecrets.id, input.secret_id));

          return {
            content: [
              {
                type: "text",
                text: `**Secret Deleted!**\n\n**Name:** ${
                  secret[0].key
                }\n\nThe secret has been permanently removed.`,
              },
            ],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return {
            content: [{ type: "text", text: `Error deleting secret: ${msg}` }],
            isError: true,
          };
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "vault_rotate_secret",
        "Rotate an existing secret by replacing its encrypted value atomically. " +
          "The secret must already exist. Returns success/fail — NEVER returns the value.",
        {
          name: z
            .string()
            .min(1)
            .max(100)
            .regex(
              /^[a-zA-Z][a-zA-Z0-9_]*$/,
              "Name must start with a letter and contain only letters, numbers, and underscores",
            )
            .describe("Secret name to rotate (e.g. OPENAI_API_KEY)."),
          value: z.string().min(1).max(10000).describe("The new secret value to encrypt and store."),
        },
      )
      .meta({ category: "vault", tier: "free" })
      .handler(async ({ input, ctx }) => {
        try {
          // Check if secret exists
          const existing = await ctx.db
            .select({ id: vaultSecrets.id })
            .from(vaultSecrets)
            .where(and(eq(vaultSecrets.userId, ctx.userId), eq(vaultSecrets.key, input.name)))
            .limit(1);

          if (existing.length === 0 || !existing[0]) {
            return {
              content: [
                {
                  type: "text",
                  text: `**Error:** Secret "${input.name}" not found. Use \`vault_store_secret\` to create it first.`,
                },
              ],
              isError: true,
            };
          }

          const encryptedValue = await encryptValue(ctx.userId, input.value, vaultSecret ?? "");
          const now = Date.now();

          await ctx.db
            .update(vaultSecrets)
            .set({ encryptedValue, updatedAt: now })
            .where(eq(vaultSecrets.id, existing[0].id));

          return {
            content: [
              {
                type: "text",
                text:
                  `**Secret Rotated!**\n\n` +
                  `**Name:** ${input.name}\n` +
                  `**Updated:** ${new Date(now).toISOString()}\n\n` +
                  `The old value has been replaced. The new value is encrypted and cannot be read back.`,
              },
            ],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return {
            content: [{ type: "text", text: `Error rotating secret: ${msg}` }],
            isError: true,
          };
        }
      }),
  );
}
