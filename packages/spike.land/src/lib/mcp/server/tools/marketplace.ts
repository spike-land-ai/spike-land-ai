/**
 * Marketplace Tools (Server-Side)
 *
 * Tool marketplace — lets users discover, install, and uninstall
 * community-published tools. Authors earn tokens from installs.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { freeTool } from "../tool-builder/procedures";

type PrismaClient = Awaited<typeof import("@/lib/prisma")>["default"];

const TOKENS_PER_INSTALL = 1;

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
    registry.registerBuilt(
        freeTool(userId)
            .tool("marketplace_search", "Search the tool marketplace for community-published tools. "
                + "Returns tools matching the query with install counts and author info.", {
                query: z.string().min(1).max(200),
                limit: z.number().min(1).max(50).optional().default(10),
            })
            .meta({ category: "marketplace", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const {
                    query,
                    limit,
                } = input;

                try {
                    const tools = await findPublishedTools(ctx.prisma, query, limit);

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
                    const installed = await ctx.prisma.toolInstallation.findMany({
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
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("marketplace_install", "Install a published tool from the marketplace. "
                + "The tool author earns tokens for each install.", {
                tool_id: z.string().min(1),
            })
            .meta({ category: "marketplace", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const {
                    tool_id,
                } = input;

                try {

                    const tool = await ctx.prisma.registeredTool.findFirst({
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
                    const existing = await ctx.prisma.toolInstallation.findUnique({
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
                    await ctx.prisma.$transaction([
                        ctx.prisma.toolInstallation.create({
                            data: { userId, toolId: tool_id },
                        }),
                        ctx.prisma.registeredTool.update({
                            where: { id: tool_id },
                            data: { installCount: { increment: 1 } },
                        }),
                        ctx.prisma.toolEarning.create({
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
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("marketplace_uninstall", "Uninstall a previously installed marketplace tool.", {
                tool_id: z.string().min(1),
            })
            .meta({ category: "marketplace", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const {
                    tool_id,
                } = input;

                try {

                    const installation = await ctx.prisma.toolInstallation.findUnique({
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

                    await ctx.prisma.$transaction([
                        ctx.prisma.toolInstallation.delete({
                            where: { id: installation.id },
                        }),
                        ctx.prisma.registeredTool.update({
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
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("marketplace_my_earnings", "View your token earnings from published marketplace tools. "
                + "Shows per-tool breakdown and total earnings.", {})
            .meta({ category: "marketplace", tier: "free" })
            .handler(async ({ input: _input, ctx }) => {
                try {

                    // Get all published tools by this user
                    const tools = await ctx.prisma.registeredTool.findMany({
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
                    const earningsAgg = await ctx.prisma.toolEarning.aggregate({
                        where: { userId },
                        _sum: { tokens: true },
                    });
                    const totalEarnings = earningsAgg._sum.tokens ?? 0;

                    // Get per-tool earnings
                    const toolIds = tools.map(t => t.id);
                    const perToolEarnings = await ctx.prisma.toolEarning.groupBy({
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
            })
    );
}
