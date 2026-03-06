/**
 * Skill Store MCP Tools (CF Workers)
 *
 * Browse, install, and manage agent skills and extensions.
 * Uses Drizzle ORM + D1 with the registeredTools table as a stand-in
 * for the spike.land Skill model.
 *
 * Full skill management (skill model with categories, versions, featured flags,
 * installations) lives on spike.land. This worker provides a lightweight
 * pass-through via API calls for most operations.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../lazy-imports/types";
import { freeTool } from "../../lazy-imports/procedures-index.ts";
import { apiRequest, SPIKE_LAND_BASE_URL, textResult } from "../lib/tool-helpers";
import type { DrizzleDB } from "../../db/db/db-index.ts";

const SKILL_CATEGORIES = [
  "QUALITY",
  "TESTING",
  "WORKFLOW",
  "SECURITY",
  "PERFORMANCE",
  "OTHER",
] as const;

const SKILL_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export function registerSkillStoreTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "skill_store_list",
        "List published skills from the skill store with optional category and search filters.",
        {
          category: z.enum(SKILL_CATEGORIES).optional().describe("Filter by skill category."),
          search: z.string().max(200).optional().describe("Search skills by name or description."),
          limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .default(20)
            .describe("Max results (default 20)."),
          offset: z
            .number()
            .int()
            .min(0)
            .optional()
            .default(0)
            .describe("Offset for pagination (default 0)."),
        },
      )
      .meta({ category: "skill-store", tier: "free" })
      .handler(async ({ input }) => {
        const { category, search, limit, offset } = input;
        const params = new URLSearchParams();
        if (category) params.set("category", category);
        if (search) params.set("search", search);
        params.set("limit", String(limit));
        params.set("offset", String(offset));

        try {
          const skills = await apiRequest<
            Array<{
              id: string;
              name: string;
              displayName: string;
              description: string;
              category: string;
              version: string;
              author: string;
              installCount: number;
            }>
          >(`/api/skills?${params.toString()}`);

          if (!Array.isArray(skills) || skills.length === 0) {
            return textResult("No published skills found.");
          }

          let text = `**Skills (${skills.length}):**\n\n`;
          for (const s of skills) {
            text += `- **${s.displayName}** [${s.category}] v${s.version}\n`;
            text += `  ${s.description}\n`;
            text += `  Author: ${s.author} | Installs: ${s.installCount}\n`;
            text += `  ID: ${s.id} | Name: ${s.name}\n\n`;
          }
          return textResult(text);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return textResult(
            `**Error listing skills:** ${msg}\n\n` +
              `Browse skills at ${SPIKE_LAND_BASE_URL}/store`,
          );
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool("skill_store_get", "Get detailed information about a specific skill by slug or ID.", {
        identifier: z.string().min(1).describe("Skill slug or ID."),
      })
      .meta({ category: "skill-store", tier: "free" })
      .handler(async ({ input }) => {
        const { identifier } = input;

        try {
          const skill = await apiRequest<{
            id: string;
            name: string;
            slug: string;
            displayName: string;
            description: string;
            longDescription: string | null;
            category: string;
            version: string;
            author: string;
            authorUrl: string | null;
            repoUrl: string | null;
            iconUrl: string | null;
            color: string | null;
            tags: string[];
            installCount: number;
            isFeatured: boolean;
            createdAt: string;
          }>(`/api/skills/${encodeURIComponent(identifier)}`);

          return textResult(
            `**Skill Detail**\n\n` +
              `**ID:** ${skill.id}\n` +
              `**Name:** ${skill.name}\n` +
              `**Slug:** ${skill.slug}\n` +
              `**Display Name:** ${skill.displayName}\n` +
              `**Description:** ${skill.description}\n` +
              `**Category:** ${skill.category}\n` +
              `**Version:** ${skill.version}\n` +
              `**Author:** ${skill.author}${skill.authorUrl ? ` (${skill.authorUrl})` : ""}\n` +
              `**Installs:** ${skill.installCount}\n` +
              `**Featured:** ${skill.isFeatured}\n` +
              (skill.longDescription ? `**Details:** ${skill.longDescription}\n` : "") +
              (skill.tags && skill.tags.length > 0 ? `**Tags:** ${skill.tags.join(", ")}\n` : "") +
              (skill.repoUrl ? `**Repo:** ${skill.repoUrl}\n` : "") +
              (skill.iconUrl ? `**Icon:** ${skill.iconUrl}\n` : "") +
              (skill.color ? `**Color:** ${skill.color}\n` : "") +
              `**Created:** ${skill.createdAt}`,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return textResult(`**Error: NOT_FOUND**\nSkill not found: ${msg}\n**Retryable:** false`);
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "skill_store_install",
        "Install a skill from the store. Records the installation and increments the install count.",
        {
          skill_id: z.string().min(1).describe("Skill ID to install."),
        },
      )
      .meta({ category: "skill-store", tier: "free" })
      .handler(async ({ input }) => {
        const { skill_id } = input;

        try {
          const result = await apiRequest<{
            id: string;
            displayName: string;
          }>(`/api/skills/${encodeURIComponent(skill_id)}/install`, {
            method: "POST",
          });

          return textResult(
            `**Skill Installed!**\n\n**Name:** ${result.displayName}\n**ID:** ${result.id}`,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          if (msg.includes("already installed") || msg.includes("Already")) {
            return textResult(`**Already Installed**\n\nThis skill is already installed.`);
          }
          return textResult(`**Error installing skill:** ${msg}\n**Retryable:** false`);
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool("skill_store_admin_list", "List all skills including drafts and archived (admin).", {
        status: z.enum(SKILL_STATUSES).optional().describe("Filter by skill status."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(20)
          .describe("Max results (default 20)."),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .default(0)
          .describe("Offset for pagination (default 0)."),
      })
      .meta({ category: "skill-store", tier: "free" })
      .handler(async ({ input }) => {
        const { status, limit, offset } = input;
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        params.set("limit", String(limit));
        params.set("offset", String(offset));
        params.set("admin", "true");

        try {
          const skills = await apiRequest<
            Array<{
              id: string;
              name: string;
              displayName: string;
              description: string;
              category: string;
              status: string;
              version: string;
              author: string;
              installCount: number;
              isActive: boolean;
              isFeatured: boolean;
            }>
          >(`/api/skills?${params.toString()}`);

          if (!Array.isArray(skills) || skills.length === 0) {
            return textResult("No skills found.");
          }

          let text = `**All Skills (${skills.length}):**\n\n`;
          for (const s of skills) {
            text += `- **${s.displayName}** [${s.status}] [${s.category}] v${s.version}\n`;
            text += `  ${s.description}\n`;
            text += `  Author: ${s.author} | Installs: ${s.installCount} | Active: ${s.isActive} | Featured: ${s.isFeatured}\n`;
            text += `  ID: ${s.id}\n\n`;
          }
          return textResult(text);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return textResult(`**Error listing skills:** ${msg}`);
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "skill_store_admin_create",
        "Create a new skill in the store (admin). Delegates to spike.land API.",
        {
          name: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-z0-9-]+$/, "Must be lowercase alphanumeric with hyphens")
            .describe("Unique skill name (slug-style)."),
          slug: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-z0-9-]+$/, "Must be lowercase alphanumeric with hyphens")
            .describe("URL-friendly slug."),
          displayName: z.string().min(1).max(200).describe("Human-readable display name."),
          description: z.string().min(1).max(500).describe("Short description."),
          longDescription: z.string().max(10000).optional().describe("Extended description."),
          category: z
            .enum(SKILL_CATEGORIES)
            .optional()
            .default("OTHER")
            .describe("Skill category."),
          status: z
            .enum(SKILL_STATUSES)
            .optional()
            .default("DRAFT")
            .describe("Publication status."),
          version: z
            .string()
            .max(20)
            .optional()
            .default("1.0.0")
            .describe("Semantic version string."),
          author: z.string().min(1).max(200).describe("Author name."),
          authorUrl: z.string().url().optional().describe("Author profile URL."),
          repoUrl: z.string().url().optional().describe("Source repository URL."),
          iconUrl: z.string().url().optional().describe("Skill icon URL."),
          color: z
            .string()
            .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
            .optional()
            .describe("Hex color for the skill card (e.g. #FF5733)."),
          tags: z
            .array(z.string().max(50))
            .max(20)
            .optional()
            .default([])
            .describe("Searchable tags (up to 20)."),
          sortOrder: z
            .number()
            .int()
            .min(0)
            .optional()
            .default(0)
            .describe("Display sort order (lower = earlier)."),
          isActive: z.boolean().optional().default(true).describe("Whether the skill is active."),
          isFeatured: z
            .boolean()
            .optional()
            .default(false)
            .describe("Whether the skill is featured."),
        },
      )
      .meta({ category: "skill-store", tier: "free" })
      .handler(async ({ input }) => {
        try {
          const skill = await apiRequest<{
            id: string;
            name: string;
            displayName: string;
          }>("/api/skills", {
            method: "POST",
            body: JSON.stringify(input),
          });

          return textResult(
            `**Skill Created!**\n\n**ID:** ${skill.id}\n**Name:** ${skill.name}\n**Display Name:** ${skill.displayName}`,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return textResult(`**Error creating skill:** ${msg}`);
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "skill_store_admin_update",
        "Update fields of an existing skill (admin). Delegates to spike.land API.",
        {
          skill_id: z.string().min(1).describe("Skill ID to update."),
          name: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-z0-9-]+$/)
            .optional()
            .describe("URL-friendly skill name."),
          slug: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-z0-9-]+$/)
            .optional()
            .describe("URL-friendly slug."),
          displayName: z
            .string()
            .min(1)
            .max(200)
            .optional()
            .describe("Human-readable display name."),
          description: z.string().min(1).max(500).optional().describe("Short skill description."),
          longDescription: z
            .string()
            .max(10000)
            .optional()
            .describe("Extended markdown description."),
          category: z.enum(SKILL_CATEGORIES).optional().describe("Skill category."),
          status: z.enum(SKILL_STATUSES).optional().describe("Publication status."),
          version: z.string().max(20).optional().describe("Semantic version string."),
          author: z.string().min(1).max(200).optional().describe("Author name."),
          authorUrl: z.string().url().optional().describe("Author profile URL."),
          repoUrl: z.string().url().optional().describe("Source repository URL."),
          iconUrl: z.string().url().optional().describe("Skill icon URL."),
          color: z
            .string()
            .regex(/^#[0-9A-Fa-f]{6}$/)
            .optional()
            .describe("Hex color (e.g. #FF5733)."),
          tags: z
            .array(z.string().max(50))
            .max(20)
            .optional()
            .describe("Searchable tags (up to 20)."),
          sortOrder: z.number().int().min(0).optional().describe("Display sort order."),
          isActive: z.boolean().optional().describe("Whether the skill is active."),
          isFeatured: z.boolean().optional().describe("Whether the skill is featured."),
        },
      )
      .meta({ category: "skill-store", tier: "free" })
      .handler(async ({ input }) => {
        const { skill_id, ...fields } = input;

        try {
          const skill = await apiRequest<{
            displayName: string;
            status: string;
          }>(`/api/skills/${encodeURIComponent(skill_id)}`, {
            method: "PATCH",
            body: JSON.stringify(fields),
          });

          return textResult(`**Skill Updated!** ${skill.displayName} [${skill.status}]`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return textResult(`**Error updating skill:** ${msg}`);
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool("skill_store_admin_delete", "Archive a skill (soft-delete). Sets status to ARCHIVED.", {
        skill_id: z.string().min(1).describe("Skill ID to archive."),
      })
      .meta({ category: "skill-store", tier: "free" })
      .handler(async ({ input }) => {
        const { skill_id } = input;

        try {
          const skill = await apiRequest<{
            displayName: string;
            id: string;
          }>(`/api/skills/${encodeURIComponent(skill_id)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "ARCHIVED", isActive: false }),
          });

          return textResult(`**Skill Archived!** ${skill.displayName} -- ID: ${skill.id}`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return textResult(`**Error archiving skill:** ${msg}`);
        }
      }),
  );
}
