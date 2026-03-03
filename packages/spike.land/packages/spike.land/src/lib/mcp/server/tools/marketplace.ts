/**
 * Marketplace Tools (Server-Side)
 *
 * Tool marketplace — lets users discover, install, and uninstall
 * community-published tools. Authors earn tokens from installs.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";

type PrismaClient = Awaited<typeof import("@/lib/prisma")>["default"];

const TOKENS_PER_INSTALL = 1;

const MarketplaceSearchSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().min(1).max(50).optional().default(10),
});

const ToolIdSchema = z.object({
  tool_id: z.string().min(1),
});

async function findPublishedTools(
  prisma: PrismaClient,
  query: string,
  limit: number,
): Promise<
  Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    installCount: number;
    user: { name: string | null; };
  }>
> {
  return prisma.registeredTool.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      installCount: true,
      user: { select: { name: true } },
    },
    orderBy: { installCount: "desc" },
    take: limit,
  });
}

export function registerMarketplaceTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "marketplace_search",
    description: "Search the tool marketplace for community-published tools. "
      + "Returns tools matching the query with install counts and author info.",
    category: "marketplace",
    tier: "free",
    inputSchema: MarketplaceSearchSchema.shape,
    handler: async ({
      query,
      limit,
    }: z.infer<typeof MarketplaceSearchSchema>): Promise<CallToolResult> => {
      try {
        const prisma = (await import("@/lib/prisma")).default;
        const tools = await findPublishedTools(prisma, query, limit);

        if (tools.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No marketplace tools found matching "${query}". Try different keywords.`,
              },
            ],
          };
        }

        // Check which ones the user has installed
        const installed = await prisma.toolInstallation.findMany({
          where: {
            userId,
            toolId: { in: tools.map(t => t.id) },
          },
          select: { toolId: true },
        });
        const installedSet = new Set(installed.map(i => i.toolId));

        let text = `**Marketplace Results (${tools.length} tool(s) matching "${query}"):**\n\n`;
        for (const tool of tools) {
          const status = installedSet.has(tool.id) ? " [installed]" : "";
          const author = tool.user.name ?? "Unknown";
          text += `- **${tool.name}**${status}\n`;
          text += `  ${tool.description}\n`;
          text += `  Author: ${author} | Installs: ${tool.installCount} | ID: ${tool.id}\n\n`;
        }

        text += `Use \`marketplace_install\` with a tool ID to install a tool.`;

        return { content: [{ type: "text", text }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{
            type: "text",
            text: `Error searching marketplace: ${msg}`,
          }],
          isError: true,
        };
      }
    },
  });

  registry.register({
    name: "marketplace_install",
    description: "Install a published tool from the marketplace. "
      + "The tool author earns tokens for each install.",
    category: "marketplace",
    tier: "free",
    inputSchema: ToolIdSchema.shape,
    handler: async ({
      tool_id,
    }: z.infer<typeof ToolIdSchema>): Promise<CallToolResult> => {
      try {
        const prisma = (await import("@/lib/prisma")).default;

        const tool = await prisma.registeredTool.findFirst({
          where: { id: tool_id, status: "PUBLISHED" },
          select: { id: true, name: true, userId: true },
        });

        if (!tool) {
          return {
            content: [
              {
                type: "text",
                text: "Tool not found or not published.",
              },
            ],
            isError: true,
          };
        }

        // Check if already installed
        const existing = await prisma.toolInstallation.findUnique({
          where: { userId_toolId: { userId, toolId: tool_id } },
        });

        if (existing) {
          return {
            content: [
              {
                type: "text",
                text: `Tool "${tool.name}" is already installed.`,
              },
            ],
          };
        }

        // Create installation + increment install count + record earning in a transaction
        await prisma.$transaction([
          prisma.toolInstallation.create({
            data: { userId, toolId: tool_id },
          }),
          prisma.registeredTool.update({
            where: { id: tool_id },
            data: { installCount: { increment: 1 } },
          }),
          prisma.toolEarning.create({
            data: {
              toolId: tool_id,
              userId: tool.userId,
              tokens: TOKENS_PER_INSTALL,
              reason: "install",
            },
          }),
        ]);

        return {
          content: [
            {
              type: "text",
              text: `**Tool Installed!**\n\n`
                + `**Name:** ${tool.name}\n`
                + `**ID:** ${tool_id}\n\n`
                + `The tool is now available in your workspace.`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error installing tool: ${msg}` }],
          isError: true,
        };
      }
    },
  });

  registry.register({
    name: "marketplace_uninstall",
    description: "Uninstall a previously installed marketplace tool.",
    category: "marketplace",
    tier: "free",
    inputSchema: ToolIdSchema.shape,
    handler: async ({
      tool_id,
    }: z.infer<typeof ToolIdSchema>): Promise<CallToolResult> => {
      try {
        const prisma = (await import("@/lib/prisma")).default;

        const installation = await prisma.toolInstallation.findUnique({
          where: { userId_toolId: { userId, toolId: tool_id } },
          include: { tool: { select: { name: true } } },
        });

        if (!installation) {
          return {
            content: [
              {
                type: "text",
                text: "Tool is not installed.",
              },
            ],
            isError: true,
          };
        }

        await prisma.$transaction([
          prisma.toolInstallation.delete({
            where: { id: installation.id },
          }),
          prisma.registeredTool.update({
            where: { id: tool_id },
            data: { installCount: { decrement: 1 } },
          }),
        ]);

        return {
          content: [
            {
              type: "text",
              text: `**Tool Uninstalled!**\n\n`
                + `**Name:** ${installation.tool.name}\n\n`
                + `The tool has been removed from your workspace.`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error uninstalling tool: ${msg}` }],
          isError: true,
        };
      }
    },
  });

  registry.register({
    name: "marketplace_my_earnings",
    description: "View your token earnings from published marketplace tools. "
      + "Shows per-tool breakdown and total earnings.",
    category: "marketplace",
    tier: "free",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> => {
      try {
        const prisma = (await import("@/lib/prisma")).default;

        // Get all published tools by this user
        const tools = await prisma.registeredTool.findMany({
          where: { userId, status: "PUBLISHED" },
          select: {
            id: true,
            name: true,
            installCount: true,
          },
          orderBy: { installCount: "desc" },
        });

        if (tools.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "**Marketplace Earnings**\n\n"
                  + "You have no published tools. Publish a tool to start earning tokens from installs.\n\n"
                  + "Use `register_tool` to create a tool, then `publish_tool` to make it available.",
              },
            ],
          };
        }

        // Get total earnings
        const earningsAgg = await prisma.toolEarning.aggregate({
          where: { userId },
          _sum: { tokens: true },
        });
        const totalEarnings = earningsAgg._sum.tokens ?? 0;

        // Get per-tool earnings
        const toolIds = tools.map(t => t.id);
        const perToolEarnings = await prisma.toolEarning.groupBy({
          by: ["toolId"],
          where: { toolId: { in: toolIds } },
          _sum: { tokens: true },
        });
        const earningsMap = new Map(
          perToolEarnings.map(e => [e.toolId, e._sum.tokens ?? 0]),
        );

        let text = `**Marketplace Earnings Dashboard**\n\n`;
        text += `**Total Earnings:** ${totalEarnings} tokens\n`;
        text += `**Published Tools:** ${tools.length}\n\n`;

        text += `### Per-Tool Breakdown\n\n`;
        for (const tool of tools) {
          const earned = earningsMap.get(tool.id) ?? 0;
          text += `- **${tool.name}**\n`;
          text += `  Installs: ${tool.installCount} | Earned: ${earned} tokens\n\n`;
        }

        return { content: [{ type: "text", text }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: `Error fetching earnings: ${msg}` },
          ],
          isError: true,
        };
      }
    },
  });
}
