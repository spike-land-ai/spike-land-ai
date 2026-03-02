/**
 * Marketplace Tools (CF Workers)
 *
 * Tool marketplace — discover, install, uninstall community-published tools.
 * Uses Drizzle ORM + D1 with the registeredTools table.
 *
 * Note: toolInstallation and toolEarning tables don't exist in the D1 schema.
 * Install/uninstall simply updates installCount on registeredTools.
 * Full marketplace features (earnings, per-user installs) are on spike.land.
 */

import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import type { ToolRegistryAdapter } from "./types";
import { freeTool } from "../procedures/index";
import { textResult } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";
import { registeredTools, users } from "../db/schema";

export function registerMarketplaceTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "marketplace_search",
        "Search the tool marketplace for community-published tools. " +
          "Returns tools matching the query with install counts and author info.",
        {
          query: z
            .string()
            .min(1)
            .max(200)
            .describe("Search query to find tools by name or description."),
          limit: z
            .number()
            .min(1)
            .max(50)
            .optional()
            .default(10)
            .describe("Maximum number of results to return (1–50)."),
        },
      )
      .meta({ category: "marketplace", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { query, limit } = input;
        const pattern = `%${query}%`;

        const tools = await ctx.db
          .select({
            id: registeredTools.id,
            name: registeredTools.name,
            description: registeredTools.description,
            installCount: registeredTools.installCount,
            authorName: users.name,
          })
          .from(registeredTools)
          .leftJoin(users, eq(registeredTools.userId, users.id))
          .where(
            and(
              eq(registeredTools.status, "published"),
              sql`(${registeredTools.name} LIKE ${pattern} OR ${registeredTools.description} LIKE ${pattern})`,
            ),
          )
          .orderBy(desc(registeredTools.installCount))
          .limit(limit);

        if (tools.length === 0) {
          return textResult(
            `No marketplace tools found matching "${query}". Try different keywords.`,
          );
        }

        let text = `**Marketplace Results (${tools.length} tool(s) matching "${query}"):**\n\n`;
        for (const tool of tools) {
          const author = tool.authorName ?? "Unknown";
          text += `- **${tool.name}**\n`;
          text += `  ${tool.description}\n`;
          text += `  Author: ${author} | Installs: ${tool.installCount} | ID: ${tool.id}\n\n`;
        }
        text += `Use \`marketplace_install\` with a tool ID to install a tool.`;

        return textResult(text);
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "marketplace_install",
        "Install a published tool from the marketplace. " + "Increments the tool's install count.",
        {
          tool_id: z.string().min(1).describe("The unique ID of the marketplace tool."),
        },
      )
      .meta({ category: "marketplace", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { tool_id } = input;

        const rows = await ctx.db
          .select({ id: registeredTools.id, name: registeredTools.name })
          .from(registeredTools)
          .where(and(eq(registeredTools.id, tool_id), eq(registeredTools.status, "published")))
          .limit(1);

        const tool = rows[0];
        if (!tool) {
          return textResult("Tool not found or not published.");
        }

        await ctx.db
          .update(registeredTools)
          .set({
            installCount: sql`${registeredTools.installCount} + 1`,
            updatedAt: Date.now(),
          })
          .where(eq(registeredTools.id, tool_id));

        return textResult(
          `**Tool Installed!**\n\n` +
            `**Name:** ${tool.name}\n` +
            `**ID:** ${tool_id}\n\n` +
            `The tool is now available in your workspace.`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool("marketplace_uninstall", "Uninstall a previously installed marketplace tool.", {
        tool_id: z.string().min(1).describe("The unique ID of the marketplace tool."),
      })
      .meta({ category: "marketplace", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { tool_id } = input;

        const rows = await ctx.db
          .select({ id: registeredTools.id, name: registeredTools.name })
          .from(registeredTools)
          .where(eq(registeredTools.id, tool_id))
          .limit(1);

        const tool = rows[0];
        if (!tool) {
          return textResult("Tool is not installed.");
        }

        await ctx.db
          .update(registeredTools)
          .set({
            installCount: sql`MAX(${registeredTools.installCount} - 1, 0)`,
            updatedAt: Date.now(),
          })
          .where(eq(registeredTools.id, tool_id));

        return textResult(
          `**Tool Uninstalled!**\n\n` +
            `**Name:** ${tool.name}\n\n` +
            `The tool has been removed from your workspace.`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "marketplace_my_earnings",
        "View your token earnings from published marketplace tools. " + "Shows per-tool breakdown.",
        {},
      )
      .meta({ category: "marketplace", tier: "free" })
      .handler(async ({ ctx }) => {
        const tools = await ctx.db
          .select({
            id: registeredTools.id,
            name: registeredTools.name,
            installCount: registeredTools.installCount,
          })
          .from(registeredTools)
          .where(
            and(eq(registeredTools.userId, ctx.userId), eq(registeredTools.status, "published")),
          )
          .orderBy(desc(registeredTools.installCount));

        if (tools.length === 0) {
          return textResult(
            "**Marketplace Earnings**\n\n" +
              "You have no published tools. Publish a tool to start earning tokens from installs.\n\n" +
              "Use `register_tool` to create a tool, then `publish_tool` to make it available.",
          );
        }

        let totalInstalls = 0;
        let text = `**Marketplace Earnings Dashboard**\n\n`;

        for (const tool of tools) {
          totalInstalls += tool.installCount;
        }

        text += `**Total Installs:** ${totalInstalls}\n`;
        text += `**Published Tools:** ${tools.length}\n\n`;
        text += `### Per-Tool Breakdown\n\n`;

        for (const tool of tools) {
          text += `- **${tool.name}**\n`;
          text += `  Installs: ${tool.installCount}\n\n`;
        }

        text += "\n_Full earnings tracking (token ledger) is available on spike.land._";

        return textResult(text);
      }),
  );
}
