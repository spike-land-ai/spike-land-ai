/**
 * Workspaces Management MCP Tools (CF Workers)
 *
 * Create, list, update, and get workspaces.
 * Ported from spike.land — uses Drizzle D1 instead of Prisma.
 */

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool } from "../procedures/index";
import { textResult } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";
import { workspaces, workspaceMembers } from "../db/schema";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function registerWorkspacesTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool("workspaces_list", "List all workspaces you are a member of.", {})
      .meta({ category: "workspaces", tier: "free" })
      .handler(async ({ ctx }) => {
        const memberships = await ctx.db
          .select({
            role: workspaceMembers.role,
            workspaceId: workspaces.id,
            workspaceName: workspaces.name,
            workspaceSlug: workspaces.slug,
            workspacePlan: workspaces.plan,
            workspaceCreatedAt: workspaces.createdAt,
          })
          .from(workspaceMembers)
          .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
          .where(eq(workspaceMembers.userId, ctx.userId));

        if (memberships.length === 0) return textResult("No workspaces found.");

        let text = `**Workspaces (${memberships.length}):**\n\n`;
        for (const m of memberships) {
          text += `- **${m.workspaceName}** [${m.workspacePlan}] (${m.role})\n  Slug: ${m.workspaceSlug}\n  ID: ${m.workspaceId}\n  Created: ${new Date(m.workspaceCreatedAt).toISOString()}\n\n`;
        }
        return textResult(text);
      }),
  );

  registry.registerBuilt(
    t
      .tool("workspaces_create", "Create a new workspace and become its owner.", {
        name: z.string().min(2).max(50).describe("Workspace name (2-50 chars)."),
        slug: z
          .string()
          .min(1)
          .max(40)
          .optional()
          .describe("URL-safe slug (auto-generated if omitted)."),
      })
      .meta({ category: "workspaces", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { name, slug } = input;
        const baseSlug = slug || generateSlug(name);

        // Ensure slug uniqueness
        let finalSlug = baseSlug;
        let suffix = 0;
        while (true) {
          const existing = await ctx.db
            .select({ id: workspaces.id })
            .from(workspaces)
            .where(eq(workspaces.slug, finalSlug))
            .limit(1);
          if (existing.length === 0) break;
          suffix++;
          finalSlug = `${baseSlug}-${suffix}`;
        }

        const now = Date.now();
        const workspaceId = crypto.randomUUID();

        await ctx.db.insert(workspaces).values({
          id: workspaceId,
          ownerId: ctx.userId,
          name,
          slug: finalSlug,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert(workspaceMembers).values({
          id: crypto.randomUUID(),
          workspaceId,
          userId: ctx.userId,
          role: "owner",
          createdAt: now,
        });

        return textResult(
          `**Workspace Created!**\n\n` +
            `**ID:** ${workspaceId}\n` +
            `**Name:** ${name}\n` +
            `**Slug:** ${finalSlug}`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool("workspaces_get", "Get workspace details by ID or slug.", {
        workspace_id: z.string().min(1).optional().describe("Workspace ID."),
        slug: z.string().min(1).optional().describe("Workspace slug."),
      })
      .meta({ category: "workspaces", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { workspace_id, slug: inputSlug } = input;

        if (!workspace_id && !inputSlug) {
          return textResult(
            "**Error: VALIDATION_ERROR**\nProvide either workspace_id or slug.\n**Retryable:** false",
          );
        }

        const conditions = [eq(workspaceMembers.userId, ctx.userId)];
        if (workspace_id) conditions.push(eq(workspaces.id, workspace_id));
        if (inputSlug) conditions.push(eq(workspaces.slug, inputSlug));

        const result = await ctx.db
          .select({
            id: workspaces.id,
            name: workspaces.name,
            slug: workspaces.slug,
            description: workspaces.description,
            plan: workspaces.plan,
            createdAt: workspaces.createdAt,
            updatedAt: workspaces.updatedAt,
          })
          .from(workspaces)
          .innerJoin(
            workspaceMembers,
            and(
              eq(workspaceMembers.workspaceId, workspaces.id),
              eq(workspaceMembers.userId, ctx.userId),
            ),
          )
          .where(and(...conditions))
          .limit(1);

        const workspace = result[0];
        if (!workspace) {
          return textResult(
            "**Error: NOT_FOUND**\nWorkspace not found or you are not a member.\n**Retryable:** false",
          );
        }
        return textResult(
          `**Workspace**\n\n` +
            `**ID:** ${workspace.id}\n` +
            `**Name:** ${workspace.name}\n` +
            `**Slug:** ${workspace.slug}\n` +
            `**Description:** ${workspace.description || "(none)"}\n` +
            `**Plan:** ${workspace.plan}\n` +
            `**Created:** ${new Date(workspace.createdAt).toISOString()}\n` +
            `**Updated:** ${new Date(workspace.updatedAt).toISOString()}`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool("workspaces_update", "Update a workspace's name or slug.", {
        workspace_id: z.string().min(1).describe("Workspace ID to update."),
        name: z.string().min(2).max(50).optional().describe("New name."),
        slug: z.string().min(1).max(40).optional().describe("New slug."),
      })
      .meta({ category: "workspaces", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { workspace_id, name, slug: newSlug } = input;
        const data: Record<string, unknown> = { updatedAt: Date.now() };
        if (name) data.name = name;
        if (newSlug) data.slug = newSlug;

        if (!name && !newSlug) {
          return textResult(
            "**Error: VALIDATION_ERROR**\nNo fields to update.\n**Retryable:** false",
          );
        }

        await ctx.db.update(workspaces).set(data).where(eq(workspaces.id, workspace_id));

        return textResult(
          `**Workspace Updated!** ${name || "(unchanged)"} (${newSlug || "(unchanged)"})`,
        );
      }),
  );
}
