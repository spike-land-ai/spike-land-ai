/**
 * Workspaces Management MCP Tools
 *
 * Create, list, update, get, and favorite workspaces.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";

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
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("workspaces_list", "List all workspaces you are a member of.", {})
            .meta({ category: "workspaces", tier: "free" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                const prisma = (await import("@/lib/prisma")).default;
                const memberships = await prisma.workspaceMember.findMany({
                    where: { userId, joinedAt: { not: null } },
                    include: {
                        workspace: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                subscriptionTier: true,
                                createdAt: true,
                            },
                        },
                    },
                    orderBy: { workspace: { name: "asc" } },
                });
                if (memberships.length === 0) return textResult("No workspaces found.");
                let text = `**Workspaces (${memberships.length}):**\n\n`;
                for (const m of memberships) {
                    const w = m.workspace;
                    text +=
                        `- **${w.name}** [${w.subscriptionTier}] (${m.role})\n  Slug: ${w.slug}\n  ID: ${w.id}\n  Created: ${w.createdAt.toISOString()}\n\n`;
                }
                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("workspaces_create", "Create a new workspace and become its owner.", {
                name: z.string().min(2).max(50).describe("Workspace name (2-50 chars)."),
                slug: z.string().min(1).max(40).optional().describe(
                    "URL-safe slug (auto-generated if omitted).",
                ),
            })
            .meta({ category: "workspaces", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { name, slug } = input;

                const prisma = (await import("@/lib/prisma")).default;
                const baseSlug = slug || generateSlug(name);

                // Ensure slug uniqueness
                let finalSlug = baseSlug;
                let suffix = 0;
                while (true) {
                    const existing = await prisma.workspace.findUnique({
                        where: { slug: finalSlug },
                        select: { id: true },
                    });
                    if (!existing) break;
                    suffix++;
                    finalSlug = `${baseSlug}-${suffix}`;
                }

                const result = await prisma.$transaction(async tx => {
                    const workspace = await tx.workspace.create({
                        data: { name, slug: finalSlug },
                    });
                    await tx.workspaceMember.create({
                        data: {
                            workspaceId: workspace.id,
                            userId,
                            role: "OWNER",
                            joinedAt: new Date(),
                        },
                    });
                    return workspace;
                });

                return textResult(
                    `**Workspace Created!**\n\n`
                    + `**ID:** ${result.id}\n`
                    + `**Name:** ${name}\n`
                    + `**Slug:** ${finalSlug}`,
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("workspaces_get", "Get workspace details by ID or slug.", {
                workspace_id: z.string().min(1).optional().describe("Workspace ID."),
                slug: z.string().min(1).optional().describe("Workspace slug."),
            })
            .meta({ category: "workspaces", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { workspace_id, slug } = input;

                if (!workspace_id && !slug) {
                    return textResult(
                        "**Error: VALIDATION_ERROR**\nProvide either workspace_id or slug.\n**Retryable:** false",
                    );
                }
                const prisma = (await import("@/lib/prisma")).default;
                const where: Record<string, unknown> = {};
                if (workspace_id) where.id = workspace_id;
                if (slug) where.slug = slug;
                // Ensure user is a member
                where.members = { some: { userId } };

                const workspace = await prisma.workspace.findFirst({
                    where,
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        description: true,
                        isPersonal: true,
                        subscriptionTier: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                });
                if (!workspace) {
                    return textResult(
                        "**Error: NOT_FOUND**\nWorkspace not found or you are not a member.\n**Retryable:** false",
                    );
                }
                return textResult(
                    `**Workspace**\n\n`
                    + `**ID:** ${workspace.id}\n`
                    + `**Name:** ${workspace.name}\n`
                    + `**Slug:** ${workspace.slug}\n`
                    + `**Description:** ${workspace.description || "(none)"}\n`
                    + `**Personal:** ${workspace.isPersonal}\n`
                    + `**Tier:** ${workspace.subscriptionTier}\n`
                    + `**Created:** ${workspace.createdAt.toISOString()}\n`
                    + `**Updated:** ${workspace.updatedAt.toISOString()}`,
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("workspaces_update", "Update a workspace's name or slug.", {
                workspace_id: z.string().min(1).describe("Workspace ID to update."),
                name: z.string().min(2).max(50).optional().describe("New name."),
                slug: z.string().min(1).max(40).optional().describe("New slug."),
            })
            .meta({ category: "workspaces", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { workspace_id, name, slug } = input;

                const prisma = (await import("@/lib/prisma")).default;
                const data: Record<string, unknown> = {};
                if (name) data.name = name;
                if (slug) data.slug = slug;
                if (Object.keys(data).length === 0) {
                    return textResult(
                        "**Error: VALIDATION_ERROR**\nNo fields to update.\n**Retryable:** false",
                    );
                }
                const workspace = await prisma.workspace.update({
                    where: { id: workspace_id },
                    data,
                });
                return textResult(
                    `**Workspace Updated!** ${workspace.name} (${workspace.slug})`,
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("workspaces_favorite", "Toggle favorite status for a workspace.", {
                workspace_id: z.string().min(1).describe("Workspace ID to toggle favorite."),
            })
            .meta({ category: "workspaces", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { workspace_id } = input;

                const prisma = (await import("@/lib/prisma")).default;
                const existing = await prisma.workspaceFavorite.findUnique({
                    where: {
                        userId_workspaceId: { userId, workspaceId: workspace_id },
                    },
                });
                if (existing) {
                    await prisma.workspaceFavorite.delete({
                        where: { id: existing.id },
                    });
                    return textResult(
                        `**Favorite Removed!** Workspace ${workspace_id} unfavorited.`,
                    );
                } else {
                    await prisma.workspaceFavorite.create({
                        data: { userId, workspaceId: workspace_id },
                    });
                    return textResult(
                        `**Favorite Added!** Workspace ${workspace_id} favorited.`,
                    );
                }
            })
    );
}
