/**
 * Skill Store MCP Tools
 *
 * Browse, install, and manage agent skills and extensions.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SkillCategory, SkillStatus } from "@/generated/prisma";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const SKILL_CATEGORIES = [
  "QUALITY",
  "TESTING",
  "WORKFLOW",
  "SECURITY",
  "PERFORMANCE",
  "OTHER",
] as const;
const SKILL_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const ListSkillsSchema = z.object({
  category: z.enum(SKILL_CATEGORIES).optional().describe(
    "Filter by skill category.",
  ),
  search: z.string().max(200).optional().describe(
    "Search skills by name, display name, or description.",
  ),
  limit: z.number().int().min(1).max(100).optional().default(20).describe(
    "Max results (default 20).",
  ),
  offset: z.number().int().min(0).optional().default(0).describe(
    "Offset for pagination (default 0).",
  ),
});

const GetSkillSchema = z.object({
  identifier: z.string().min(1).describe("Skill slug or ID."),
});

const InstallSkillSchema = z.object({
  skill_id: z.string().min(1).describe("Skill ID to install."),
});

const AdminListSkillsSchema = z.object({
  status: z.enum(SKILL_STATUSES).optional().describe("Filter by skill status."),
  limit: z.number().int().min(1).max(100).optional().default(20).describe(
    "Max results (default 20).",
  ),
  offset: z.number().int().min(0).optional().default(0).describe(
    "Offset for pagination (default 0).",
  ),
});

const AdminCreateSkillSchema = z.object({
  name: z.string().min(1).max(100).regex(
    /^[a-z0-9-]+$/,
    "Must be lowercase alphanumeric with hyphens",
  ).describe("Unique skill name (slug-style)."),
  slug: z.string().min(1).max(100).regex(
    /^[a-z0-9-]+$/,
    "Must be lowercase alphanumeric with hyphens",
  ).describe("URL-friendly slug."),
  displayName: z.string().min(1).max(200).describe(
    "Human-readable display name.",
  ),
  description: z.string().min(1).max(500).describe("Short description."),
  longDescription: z.string().max(10000).optional().describe(
    "Extended description.",
  ),
  category: z.enum(SKILL_CATEGORIES).optional().default("OTHER").describe(
    "Skill category.",
  ),
  status: z.enum(SKILL_STATUSES).optional().default("DRAFT").describe(
    "Initial status.",
  ),
  version: z.string().max(20).optional().default("1.0.0").describe(
    "Version string.",
  ),
  author: z.string().min(1).max(200).describe("Author name."),
  authorUrl: z.string().url().optional().describe("Author URL."),
  repoUrl: z.string().url().optional().describe("Repository URL."),
  iconUrl: z.string().url().optional().describe("Icon URL."),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .optional().describe("Theme color (hex)."),
  tags: z.array(z.string().max(50)).max(20).optional().default([]).describe(
    "Tags for search/filtering.",
  ),
  sortOrder: z.number().int().min(0).optional().default(0).describe(
    "Sort order (lower = first).",
  ),
  isActive: z.boolean().optional().default(true).describe(
    "Whether skill is active.",
  ),
  isFeatured: z.boolean().optional().default(false).describe(
    "Whether skill is featured.",
  ),
});

const AdminUpdateSkillSchema = z.object({
  skill_id: z.string().min(1).describe("Skill ID to update."),
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional().describe(
    "New name.",
  ),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional().describe(
    "New slug.",
  ),
  displayName: z.string().min(1).max(200).optional().describe(
    "New display name.",
  ),
  description: z.string().min(1).max(500).optional().describe(
    "New description.",
  ),
  longDescription: z.string().max(10000).optional().describe(
    "New long description.",
  ),
  category: z.enum(SKILL_CATEGORIES).optional().describe("New category."),
  status: z.enum(SKILL_STATUSES).optional().describe("New status."),
  version: z.string().max(20).optional().describe("New version."),
  author: z.string().min(1).max(200).optional().describe("New author."),
  authorUrl: z.string().url().optional().describe("New author URL."),
  repoUrl: z.string().url().optional().describe("New repo URL."),
  iconUrl: z.string().url().optional().describe("New icon URL."),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe(
    "New color.",
  ),
  tags: z.array(z.string().max(50)).max(20).optional().describe("New tags."),
  sortOrder: z.number().int().min(0).optional().describe("New sort order."),
  isActive: z.boolean().optional().describe("New active status."),
  isFeatured: z.boolean().optional().describe("New featured status."),
});

const AdminDeleteSkillSchema = z.object({
  skill_id: z.string().min(1).describe("Skill ID to archive."),
});

export function registerSkillStoreTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "skill_store_list",
    description:
      "List published skills from the skill store with optional category and search filters.",
    category: "skill-store",
    tier: "free",
    inputSchema: ListSkillsSchema.shape,
    handler: async (
      { category, search, limit = 20, offset = 0 }: z.infer<
        typeof ListSkillsSchema
      >,
    ): Promise<CallToolResult> =>
      safeToolCall("skill_store_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const where: {
          status: SkillStatus;
          isActive: boolean;
          category?: SkillCategory;
          OR?: Array<
            {
              name?: { contains: string; mode: "insensitive"; };
              displayName?: { contains: string; mode: "insensitive"; };
              description?: { contains: string; mode: "insensitive"; };
            }
          >;
        } = { status: "PUBLISHED", isActive: true };

        if (category) {
          where.category = category as SkillCategory;
        }
        if (search) {
          where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { displayName: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ];
        }

        const skills = await prisma.skill.findMany({
          where,
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            category: true,
            version: true,
            author: true,
            installCount: true,
          },
          take: limit,
          skip: offset,
          orderBy: [{ sortOrder: "asc" }, { installCount: "desc" }],
        });

        if (skills.length === 0) {
          return textResult("No published skills found.");
        }

        let text = `**Skills (${skills.length}):**\n\n`;
        for (const s of skills) {
          text +=
            `- **${s.displayName}** [${s.category}] v${s.version}\n  ${s.description}\n  Author: ${s.author} | Installs: ${s.installCount}\n  ID: ${s.id} | Name: ${s.name}\n\n`;
        }
        return textResult(text);
      }),
  });

  registry.register({
    name: "skill_store_get",
    description: "Get detailed information about a specific skill by slug or ID.",
    category: "skill-store",
    tier: "free",
    inputSchema: GetSkillSchema.shape,
    handler: async (
      { identifier }: z.infer<typeof GetSkillSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("skill_store_get", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const skill = await prisma.skill.findFirst({
          where: {
            OR: [{ slug: identifier }, { id: identifier }],
            status: "PUBLISHED",
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            displayName: true,
            description: true,
            longDescription: true,
            category: true,
            version: true,
            author: true,
            authorUrl: true,
            repoUrl: true,
            iconUrl: true,
            color: true,
            tags: true,
            installCount: true,
            isFeatured: true,
            createdAt: true,
          },
        });

        if (!skill) {
          return textResult(
            "**Error: NOT_FOUND**\nSkill not found.\n**Retryable:** false",
          );
        }

        return textResult(
          `**Skill Detail**\n\n`
            + `**ID:** ${skill.id}\n`
            + `**Name:** ${skill.name}\n`
            + `**Slug:** ${skill.slug}\n`
            + `**Display Name:** ${skill.displayName}\n`
            + `**Description:** ${skill.description}\n`
            + `**Category:** ${skill.category}\n`
            + `**Version:** ${skill.version}\n`
            + `**Author:** ${skill.author}${skill.authorUrl ? ` (${skill.authorUrl})` : ""}\n`
            + `**Installs:** ${skill.installCount}\n`
            + `**Featured:** ${skill.isFeatured}\n`
            + (skill.longDescription
              ? `**Details:** ${skill.longDescription}\n`
              : "")
            + (skill.tags.length > 0
              ? `**Tags:** ${skill.tags.join(", ")}\n`
              : "")
            + (skill.repoUrl ? `**Repo:** ${skill.repoUrl}\n` : "")
            + (skill.iconUrl ? `**Icon:** ${skill.iconUrl}\n` : "")
            + (skill.color ? `**Color:** ${skill.color}\n` : "")
            + `**Created:** ${skill.createdAt.toISOString()}`,
        );
      }),
  });

  registry.register({
    name: "skill_store_install",
    description:
      "Install a skill from the store. Records the installation and increments the install count.",
    category: "skill-store",
    tier: "free",
    inputSchema: InstallSkillSchema.shape,
    handler: async (
      { skill_id }: z.infer<typeof InstallSkillSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("skill_store_install", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const skill = await prisma.skill.findFirst({
          where: { id: skill_id, status: "PUBLISHED", isActive: true },
          select: { id: true, name: true, displayName: true },
        });
        if (!skill) {
          return textResult(
            "**Error: NOT_FOUND**\nSkill not found or not available for installation.\n**Retryable:** false",
          );
        }

        const existing = await prisma.skillInstallation.findFirst({
          where: { skillId: skill_id, userId },
        });
        if (existing) {
          return textResult(
            `**Already Installed**\n\nSkill "${skill.displayName}" is already installed.`,
          );
        }

        await prisma.$transaction([
          prisma.skillInstallation.create({
            data: { skillId: skill_id, userId },
          }),
          prisma.skill.update({
            where: { id: skill_id },
            data: { installCount: { increment: 1 } },
          }),
        ]);

        return textResult(
          `**Skill Installed!**\n\n**Name:** ${skill.displayName}\n**ID:** ${skill.id}`,
        );
      }),
  });

  registry.register({
    name: "skill_store_admin_list",
    description:
      "List all skills including drafts and archived (admin). Shows status, active, and featured flags.",
    category: "skill-store",
    tier: "free",
    inputSchema: AdminListSkillsSchema.shape,
    handler: async (
      { status, limit = 20, offset = 0 }: z.infer<typeof AdminListSkillsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("skill_store_admin_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const where: { status?: SkillStatus; } = {};
        if (status) {
          where.status = status as SkillStatus;
        }

        const skills = await prisma.skill.findMany({
          where,
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            category: true,
            status: true,
            version: true,
            author: true,
            installCount: true,
            isActive: true,
            isFeatured: true,
          },
          take: limit,
          skip: offset,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        });

        if (skills.length === 0) return textResult("No skills found.");

        let text = `**All Skills (${skills.length}):**\n\n`;
        for (const s of skills) {
          text +=
            `- **${s.displayName}** [${s.status}] [${s.category}] v${s.version}\n  ${s.description}\n  Author: ${s.author} | Installs: ${s.installCount} | Active: ${s.isActive} | Featured: ${s.isFeatured}\n  ID: ${s.id}\n\n`;
        }
        return textResult(text);
      }),
  });

  registry.register({
    name: "skill_store_admin_create",
    description: "Create a new skill in the store (admin).",
    category: "skill-store",
    tier: "free",
    inputSchema: AdminCreateSkillSchema.shape,
    handler: async (
      input: z.infer<typeof AdminCreateSkillSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("skill_store_admin_create", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const skill = await prisma.skill.create({
          data: {
            name: input.name,
            slug: input.slug,
            displayName: input.displayName,
            description: input.description,
            longDescription: input.longDescription,
            category: input.category as SkillCategory,
            status: input.status as SkillStatus,
            version: input.version,
            author: input.author,
            authorUrl: input.authorUrl,
            repoUrl: input.repoUrl,
            iconUrl: input.iconUrl,
            color: input.color,
            tags: input.tags,
            sortOrder: input.sortOrder,
            isActive: input.isActive,
            isFeatured: input.isFeatured,
            createdBy: userId,
          },
        });
        return textResult(
          `**Skill Created!**\n\n**ID:** ${skill.id}\n**Name:** ${skill.name}\n**Display Name:** ${skill.displayName}`,
        );
      }),
  });

  registry.register({
    name: "skill_store_admin_update",
    description: "Update fields of an existing skill (admin).",
    category: "skill-store",
    tier: "free",
    inputSchema: AdminUpdateSkillSchema.shape,
    handler: async (
      { skill_id, ...fields }: z.infer<typeof AdminUpdateSkillSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("skill_store_admin_update", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const data: Record<string, unknown> = {};
        if (fields.name !== undefined) data.name = fields.name;
        if (fields.slug !== undefined) data.slug = fields.slug;
        if (fields.displayName !== undefined) {
          data.displayName = fields.displayName;
        }
        if (fields.description !== undefined) {
          data.description = fields.description;
        }
        if (fields.longDescription !== undefined) {
          data.longDescription = fields.longDescription;
        }
        if (fields.category !== undefined) data.category = fields.category;
        if (fields.status !== undefined) data.status = fields.status;
        if (fields.version !== undefined) data.version = fields.version;
        if (fields.author !== undefined) data.author = fields.author;
        if (fields.authorUrl !== undefined) {
          data.authorUrl = fields.authorUrl;
        }
        if (fields.repoUrl !== undefined) data.repoUrl = fields.repoUrl;
        if (fields.iconUrl !== undefined) data.iconUrl = fields.iconUrl;
        if (fields.color !== undefined) data.color = fields.color;
        if (fields.tags !== undefined) data.tags = fields.tags;
        if (fields.sortOrder !== undefined) {
          data.sortOrder = fields.sortOrder;
        }
        if (fields.isActive !== undefined) data.isActive = fields.isActive;
        if (fields.isFeatured !== undefined) {
          data.isFeatured = fields.isFeatured;
        }

        const skill = await prisma.skill.update({
          where: { id: skill_id },
          data,
        });
        return textResult(
          `**Skill Updated!** ${skill.displayName} [${skill.status}]`,
        );
      }),
  });

  registry.register({
    name: "skill_store_admin_delete",
    description: "Archive a skill (soft-delete). Sets status to ARCHIVED and isActive to false.",
    category: "skill-store",
    tier: "free",
    inputSchema: AdminDeleteSkillSchema.shape,
    handler: async (
      { skill_id }: z.infer<typeof AdminDeleteSkillSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("skill_store_admin_delete", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const skill = await prisma.skill.update({
          where: { id: skill_id },
          data: { status: "ARCHIVED", isActive: false },
        });
        return textResult(
          `**Skill Archived!** ${skill.displayName} — ID: ${skill.id}`,
        );
      }),
  });
}
