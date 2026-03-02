/**
 * Bootstrap Protocol Tools (CF Workers)
 *
 * One-session workspace onboarding — create workspaces,
 * store integration credentials, and deploy apps.
 *
 * DB operations use Drizzle ORM + D1.
 * Next.js-specific features (codespace creation, transpilation)
 * are stubbed to call spike.land API.
 */

import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import type { ToolRegistryAdapter } from "./types";
import { freeTool } from "../procedures/index";
import { textResult, apiRequest, SPIKE_LAND_BASE_URL } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";
import { workspaces, workspaceMembers, vaultSecrets, registeredTools } from "../db/schema";

export function registerBootstrapTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "bootstrap_workspace",
        "Create or update a workspace configuration for the user. " +
          "A workspace is the container for secrets, tools, and apps.",
        {
          name: z.string().min(1).max(100),
          settings: z.record(z.string(), z.unknown()).optional().default({}),
        },
      )
      .meta({ category: "bootstrap", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { name, settings } = input;
        const now = Date.now();
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        // Check if user already has a workspace
        const existing = await ctx.db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.ownerId, ctx.userId))
          .limit(1);

        let workspaceId: string;

        if (existing.length > 0) {
          workspaceId = existing[0]!.id;
          await ctx.db
            .update(workspaces)
            .set({
              name,
              settings: JSON.stringify(settings),
              updatedAt: now,
            })
            .where(eq(workspaces.id, workspaceId));
        } else {
          workspaceId = crypto.randomUUID();
          await ctx.db.insert(workspaces).values({
            id: workspaceId,
            ownerId: ctx.userId,
            name,
            slug: `${slug}-${workspaceId.slice(0, 8)}`,
            description: `Workspace for ${name}`,
            plan: "free",
            settings: JSON.stringify(settings),
            createdAt: now,
            updatedAt: now,
          });

          // Add owner as member
          await ctx.db.insert(workspaceMembers).values({
            id: crypto.randomUUID(),
            workspaceId,
            userId: ctx.userId,
            role: "owner",
            createdAt: now,
          });
        }

        return textResult(
          `**Workspace Ready!**\n\n` +
            `**ID:** ${workspaceId}\n` +
            `**Name:** ${name}\n\n` +
            `Next steps:\n` +
            `- Use \`bootstrap_connect_integration\` to add API credentials\n` +
            `- Use \`bootstrap_create_app\` to deploy a live app`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "bootstrap_connect_integration",
        "Connect an integration by storing its credentials in the encrypted vault. " +
          "Each credential key/value pair is stored separately.",
        {
          integration_name: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
          credentials: z.record(z.string(), z.string()),
        },
      )
      .meta({ category: "bootstrap", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { integration_name, credentials } = input;
        const now = Date.now();

        // Find workspace for this user
        const ws = await ctx.db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.ownerId, ctx.userId))
          .limit(1);

        const workspaceId = ws[0]?.id ?? null;

        const storedSecrets: Array<{ name: string; id: string }> = [];

        for (const [key, value] of Object.entries(credentials)) {
          const secretName = `${integration_name}_${key}`;
          const secretId = crypto.randomUUID();

          // Encrypt using WebCrypto AES-GCM
          const encoder = new TextEncoder();
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(ctx.userId),
            "PBKDF2",
            false,
            ["deriveKey"],
          );
          const cryptoKey = await crypto.subtle.deriveKey(
            {
              name: "PBKDF2",
              salt: encoder.encode("spike-land-vault"),
              iterations: 100000,
              hash: "SHA-256",
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt"],
          );
          const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            cryptoKey,
            encoder.encode(value),
          );

          const encryptedValue = JSON.stringify({
            iv: btoa(String.fromCharCode(...iv)),
            data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
          });

          // Upsert: delete then insert (D1 doesn't support ON CONFLICT well)
          await ctx.db
            .delete(vaultSecrets)
            .where(and(eq(vaultSecrets.userId, ctx.userId), eq(vaultSecrets.key, secretName)));

          await ctx.db.insert(vaultSecrets).values({
            id: secretId,
            userId: ctx.userId,
            workspaceId,
            key: secretName,
            encryptedValue,
            createdAt: now,
            updatedAt: now,
          });

          storedSecrets.push({ name: secretName, id: secretId });
        }

        let text = `**Integration Connected: ${integration_name}**\n\n`;
        text += `**Secrets Stored:**\n`;
        for (const s of storedSecrets) {
          text += `- ${s.name} (ID: ${s.id})\n`;
        }

        return textResult(text);
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "bootstrap_create_app",
        "Create a live app. Delegates codespace creation and app linking to the spike.land API.",
        {
          app_name: z.string().min(3).max(50),
          description: z.string().min(10).max(500).optional(),
          code: z.string().min(1).optional(),
          codespace_id: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-zA-Z0-9_.-]+$/)
            .optional(),
        },
      )
      .meta({ category: "bootstrap", tier: "free" })
      .handler(async ({ input }) => {
        const { app_name, description, code, codespace_id } = input;

        const effectiveCodespaceId =
          codespace_id ||
          app_name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        // Delegate to spike.land API for codespace + app creation
        const body: Record<string, unknown> = {
          name: app_name,
          description: description || `App from codespace ${effectiveCodespaceId}`,
          requirements: "Bootstrap-created app",
          monetizationModel: "free",
          codespaceId: effectiveCodespaceId,
        };
        if (code) body.code = code;

        try {
          const appData = await apiRequest<{
            id: string;
            name: string;
          }>("/api/apps", {
            method: "POST",
            body: JSON.stringify(body),
          });

          const liveUrl = `${SPIKE_LAND_BASE_URL}/api/codespace/${effectiveCodespaceId}/embed`;
          const dashboardUrl = `${SPIKE_LAND_BASE_URL}/create`;

          return textResult(
            `**App Created!**\n\n` +
              `**App:** ${appData.name} (ID: ${appData.id})\n` +
              `**Codespace:** ${effectiveCodespaceId}\n` +
              `**Live URL:** ${liveUrl}\n` +
              `**Dashboard:** ${dashboardUrl}`,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return textResult(`**Error creating app:** ${msg}`);
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "bootstrap_status",
        "Get the current workspace setup status: workspace config, secrets, tools.",
        {},
      )
      .meta({ category: "bootstrap", tier: "free" })
      .handler(async ({ ctx }) => {
        const [ws, secretCount, toolCount] = await Promise.all([
          ctx.db
            .select({
              id: workspaces.id,
              name: workspaces.name,
              settings: workspaces.settings,
            })
            .from(workspaces)
            .where(eq(workspaces.ownerId, ctx.userId))
            .limit(1),
          ctx.db
            .select({ count: sql<number>`count(*)` })
            .from(vaultSecrets)
            .where(eq(vaultSecrets.userId, ctx.userId)),
          ctx.db
            .select({ count: sql<number>`count(*)` })
            .from(registeredTools)
            .where(eq(registeredTools.userId, ctx.userId)),
        ]);

        const workspace = ws[0];
        const secrets = secretCount[0]?.count ?? 0;
        const tools = toolCount[0]?.count ?? 0;

        let text = `**Workspace Status**\n\n`;

        if (workspace) {
          text += `**Workspace:** ${workspace.name}\n`;
          text += `**ID:** ${workspace.id}\n`;
        } else {
          text += `**Workspace:** Not configured\n`;
        }

        text += `**Vault Secrets:** ${secrets}\n`;
        text += `**Registered Tools:** ${tools}\n`;

        if (!workspace) {
          text += `\nUse \`bootstrap_workspace\` to get started.`;
        }

        return textResult(text);
      }),
  );
}
