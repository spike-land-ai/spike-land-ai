/**
 * BAZDMEG+ Skill Store Sync MCP Tools
 *
 * Publish superpowers skills to the spike.land skill store.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

export function registerBazdmegSkillSyncTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // bazdmeg_skill_publish
  const SkillEntry = z.object({
    name: z.string()
      .min(1)
      .max(50)
      .regex(
        /^[a-z0-9-]+$/i,
        "Skill name must be alphanumeric with hyphens only",
      )
      .describe("Skill name (e.g., 'brainstorming')"),
    description: z.string().max(500).describe("Short skill description"),
    content: z.string().optional().describe("Full SKILL.md content"),
    category: z.string().max(50).optional().describe("Skill category"),
    version: z.string().max(20).optional().describe("Skill version"),
  });

  const PublishSchema = z.object({
    skills: z.array(SkillEntry).min(1).describe("Array of skills to publish"),
  });

  registry.register({
    name: "bazdmeg_skill_publish",
    description:
      "Publish superpowers skills to the spike.land skill store. Creates or updates Skill records.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: PublishSchema.shape,
    handler: async ({
      skills,
    }: z.infer<typeof PublishSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_skill_publish", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const results: Array<{ name: string; action: string; }> = [];

        for (const skill of skills) {
          const slug = `superpowers-${skill.name.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
          const displayName = skill.name
            .replace(/-/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());

          await prisma.skill.upsert({
            where: { name: `superpowers:${skill.name}` },
            create: {
              name: `superpowers:${skill.name}`,
              slug,
              displayName,
              description: skill.description,
              longDescription: skill.content,
              author: "superpowers",
              repoUrl: "https://github.com/obra/superpowers",
              version: skill.version ?? "1.0.0",
              status: "PUBLISHED",
              category: "OTHER",
              tags: ["superpowers", skill.category ?? "workflow"].filter(
                Boolean,
              ),
              createdBy: userId,
            },
            update: {
              description: skill.description,
              longDescription: skill.content,
              version: skill.version ?? "1.0.0",
              status: "PUBLISHED",
            },
          });

          results.push({
            name: skill.name,
            action: "upserted",
          });
        }

        let text = `**Skills Published** (${results.length})\n\n`;
        text += `| Skill | Action |\n`;
        text += `|-------|--------|\n`;
        for (const r of results) {
          text += `| ${r.name} | ${r.action} |\n`;
        }
        text += `\nAll skills published with author: "superpowers"`;

        return textResult(text);
      }),
  });

  // bazdmeg_skill_sync_status
  registry.register({
    name: "bazdmeg_skill_sync_status",
    description:
      "Check which superpowers skills are published in the skill store and their versions.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_skill_sync_status", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const skills = await prisma.skill.findMany({
          where: { author: "superpowers" },
          orderBy: { name: "asc" },
          select: {
            name: true,
            version: true,
            status: true,
            updatedAt: true,
          },
        });

        if (skills.length === 0) {
          return textResult(
            "No superpowers skills published yet. Use `bazdmeg_skill_publish` to publish.",
          );
        }

        let text = `**Superpowers Skills in Store** (${skills.length})\n\n`;
        text += `| Name | Version | Status | Updated |\n`;
        text += `|------|---------|--------|---------|\n`;
        for (const s of skills) {
          const updated = s.updatedAt.toISOString().slice(0, 10);
          text += `| ${s.name} | ${s.version} | ${s.status} | ${updated} |\n`;
        }

        return textResult(text);
      }),
  });
}
