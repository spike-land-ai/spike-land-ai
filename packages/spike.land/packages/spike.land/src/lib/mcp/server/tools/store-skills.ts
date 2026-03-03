/**
 * Store Skills MCP Tools
 *
 * Browse, install, and manage skills from the spike.land skill store.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const ListSkillsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(20)
    .describe("Max skills to return (default 20, max 50)"),
});

const SkillIdSchema = z.object({
  id: z.string().min(1).describe("Skill ID or slug"),
});

const EmptySchema = z.object({});

export function registerStoreSkillsTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "store_skills_list",
    description: "List published skills from the skill store, ordered by popularity",
    category: "store-skills",
    tier: "free",
    inputSchema: ListSkillsSchema.shape,
    handler: async ({
      limit,
    }: z.infer<typeof ListSkillsSchema>): Promise<CallToolResult> =>
      safeToolCall("store_skills_list", async () => {
        try {
          const prisma = (await import("@/lib/prisma")).default;
          const skills = await prisma.skill.findMany({
            where: { status: "PUBLISHED", isActive: true },
            take: limit,
            orderBy: { installCount: "desc" },
          });
          if (skills.length === 0) {
            return textResult("No skills available yet.");
          }
          const list = skills
            .map(
              s =>
                `- **${s.name}** (${s.slug}) \u2014 ${
                  s.description ?? "No description"
                }\n  *Installs: ${s.installCount}*`,
            )
            .join("\n");
          return textResult(`## Skill Store\n\n${list}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult(
              "Skills list unavailable (DB table pending migration).",
            );
          }
          throw err;
        }
      }),
  });

  registry.register({
    name: "store_skills_get",
    description: "Get detailed information about a specific skill by ID or slug",
    category: "store-skills",
    tier: "free",
    inputSchema: SkillIdSchema.shape,
    handler: async ({
      id,
    }: z.infer<typeof SkillIdSchema>): Promise<CallToolResult> =>
      safeToolCall("store_skills_get", async () => {
        try {
          const prisma = (await import("@/lib/prisma")).default;
          const skill = await prisma.skill.findFirst({
            where: {
              OR: [{ slug: id }, { id }],
              isActive: true,
            },
          });
          if (!skill) return textResult("Skill not found.");
          const tags = skill.tags.length > 0 ? skill.tags.join(", ") : "none";
          return textResult(
            `## ${skill.name}\n\n`
              + `- **Slug**: ${skill.slug}\n`
              + `- **Description**: ${skill.description ?? "No description"}\n`
              + `- **Version**: ${skill.version ?? "N/A"}\n`
              + `- **Category**: ${skill.category ?? "Uncategorized"}\n`
              + `- **Tags**: ${tags}\n`
              + `- **Installs**: ${skill.installCount}`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult("Skill not found (DB table pending migration).");
          }
          throw err;
        }
      }),
  });

  registry.register({
    name: "store_skills_install",
    description: "Install a skill from the store for the current user",
    category: "store-skills",
    tier: "free",
    inputSchema: SkillIdSchema.shape,
    handler: async ({
      id,
    }: z.infer<typeof SkillIdSchema>): Promise<CallToolResult> =>
      safeToolCall("store_skills_install", async () => {
        if (!userId) {
          return textResult("Authentication required to install skills.");
        }
        try {
          const prisma = (await import("@/lib/prisma")).default;
          const skill = await prisma.skill.findFirst({
            where: {
              OR: [{ slug: id }, { id }],
              isActive: true,
            },
          });
          if (!skill) return textResult("Skill not found.");
          const result = await prisma.$transaction(async tx => {
            const existing = await tx.skillInstallation.findUnique({
              where: {
                skillId_userId: {
                  skillId: skill.id,
                  userId,
                },
              },
            });
            if (existing) return "already_installed" as const;
            await tx.skillInstallation.create({
              data: { skillId: skill.id, userId },
            });
            await tx.skill.update({
              where: { id: skill.id },
              data: { installCount: { increment: 1 } },
            });
            return "installed" as const;
          });
          if (result === "already_installed") {
            return textResult(`"${skill.name}" is already installed.`);
          }
          return textResult(
            `Installed "${skill.name}".\n\nRun: \`claude skill add spike-land/${skill.slug}\``,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult(
              "Skill install failed (DB table pending migration).",
            );
          }
          throw err;
        }
      }),
  });

  registry.register({
    name: "store_skills_my_installs",
    description: "List skills installed by the current user",
    category: "store-skills",
    tier: "free",
    inputSchema: EmptySchema.shape,
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("store_skills_my_installs", async () => {
        if (!userId) return textResult("Authentication required.");
        try {
          const prisma = (await import("@/lib/prisma")).default;
          const installations = await prisma.skillInstallation.findMany({
            where: { userId },
            include: { skill: true },
          });
          if (installations.length === 0) {
            return textResult("No skills installed yet.");
          }
          const list = installations
            .map(
              (i: { skill: { name: string; slug: string; }; }) =>
                `- **${i.skill.name}** (${i.skill.slug})`,
            )
            .join("\n");
          return textResult(`## Your Installed Skills\n\n${list}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult(
              "Install list unavailable (DB table pending migration).",
            );
          }
          throw err;
        }
      }),
  });
}
