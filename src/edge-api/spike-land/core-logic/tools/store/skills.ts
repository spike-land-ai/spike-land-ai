/**
 * Store Skills MCP Tools (CF Workers)
 *
 * Browse, install, and manage skills from the spike.land skill store.
 * Proxies to spike.land API for skill operations.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../../lazy-imports/types";
import { freeTool } from "../../../lazy-imports/procedures-index.ts";
import { apiRequest, safeToolCall, textResult } from "../../lib/tool-helpers";
import type { DrizzleDB } from "../../../db/db/db-index.ts";

export function registerStoreSkillsTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // store_skills_list
  registry.registerBuilt(
    t
      .tool(
        "store_skills_list",
        "List published skills from the skill store, ordered by popularity.",
        {
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .optional()
            .default(20)
            .describe("Max skills to return (default 20, max 50)"),
        },
      )
      .meta({ category: "store-skills", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_skills_list", async () => {
          const params = new URLSearchParams();
          if (input.limit !== undefined) {
            params.set("limit", String(input.limit));
          }

          const skills = await apiRequest<
            Array<{
              name: string;
              slug: string;
              description: string | null;
              installCount: number;
            }>
          >(`/api/store/skills?${params.toString()}`);

          if (skills.length === 0) {
            return textResult("No skills available yet.");
          }

          const list = skills
            .map(
              (s) =>
                `- **${s.name}** (${s.slug}) — ${
                  s.description ?? "No description"
                }\n  *Installs: ${s.installCount}*`,
            )
            .join("\n");
          return textResult(`## Skill Store\n\n${list}`);
        });
      }),
  );

  // store_skills_get
  registry.registerBuilt(
    t
      .tool("store_skills_get", "Get detailed information about a specific skill by ID or slug.", {
        id: z.string().min(1).describe("Skill ID or slug"),
      })
      .meta({ category: "store-skills", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_skills_get", async () => {
          const skill = await apiRequest<{
            name: string;
            slug: string;
            description: string | null;
            version: string | null;
            category: string | null;
            tags: string[];
            installCount: number;
          } | null>(`/api/store/skills/${input.id}`);

          if (!skill) return textResult("Skill not found.");
          const tags = skill.tags.length > 0 ? skill.tags.join(", ") : "none";
          return textResult(
            `## ${skill.name}\n\n` +
              `- **Slug**: ${skill.slug}\n` +
              `- **Description**: ${skill.description ?? "No description"}\n` +
              `- **Version**: ${skill.version ?? "N/A"}\n` +
              `- **Category**: ${skill.category ?? "Uncategorized"}\n` +
              `- **Tags**: ${tags}\n` +
              `- **Installs**: ${skill.installCount}`,
          );
        });
      }),
  );

  // store_skills_install
  registry.registerBuilt(
    t
      .tool("store_skills_install", "Install a skill from the store for the current user.", {
        id: z.string().min(1).describe("Skill ID or slug"),
      })
      .meta({ category: "store-skills", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_skills_install", async () => {
          const result = await apiRequest<{
            status: "installed" | "already_installed";
            skillName: string;
            skillSlug: string;
          }>("/api/store/skills/install", {
            method: "POST",
            body: JSON.stringify({ id: input.id }),
          });

          if (result.status === "already_installed") {
            return textResult(`"${result.skillName}" is already installed.`);
          }
          return textResult(
            `Installed "${result.skillName}".\n\nRun: \`claude skill add spike-land/${result.skillSlug}\``,
          );
        });
      }),
  );

  // store_skills_my_installs
  registry.registerBuilt(
    t
      .tool("store_skills_my_installs", "List skills installed by the current user.", {})
      .meta({ category: "store-skills", tier: "free" })
      .handler(async () => {
        return safeToolCall("store_skills_my_installs", async () => {
          const installations = await apiRequest<
            Array<{
              skillName: string;
              skillSlug: string;
            }>
          >("/api/store/skills/my-installs");

          if (installations.length === 0) {
            return textResult("No skills installed yet.");
          }
          const list = installations.map((i) => `- **${i.skillName}** (${i.skillSlug})`).join("\n");
          return textResult(`## Your Installed Skills\n\n${list}`);
        });
      }),
  );
}
