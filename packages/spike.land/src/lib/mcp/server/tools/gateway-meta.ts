/**
 * Gateway Meta Tools (Server-Side)
 *
 * 5 always-on discovery tools for Progressive Context Disclosure.
 * Server-side version calls service layer directly instead of HTTP.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { saveEnabledCategories } from "../category-persistence";
import { freeTool } from "../tool-builder/procedures.js";

export function registerGatewayMetaTools(
    registry: ToolRegistry,
    userId: string,
): void {
    // search_tools
    registry.registerBuilt(
        freeTool(userId)
            .tool("search_tools", "Search all available spike.land tools by keyword or description. Also searches the marketplace for community-published tools.", {
                query: z.string().min(1).max(200).describe("Search query"),
                limit: z.number().min(1).max(50).optional().default(10).describe(
                    "Maximum results",
                ),
                semantic: z.boolean().optional().default(false).describe(
                    "Use AI-powered semantic search with synonym expansion",
                ),
            })
            .meta({ category: "gateway-meta", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { query, limit, semantic } = input;

                if (semantic) {
                    const semanticResults = registry.searchToolsSemantic(query, limit);
                    if (semanticResults.length === 0) {
                        return {
                            content: [{
                                type: "text",
                                text:
                                    `No tools found matching "${query}" (semantic). Try different keywords or use list_categories.`,
                            }],
                        };
                    }

                    const names = semanticResults.map(r => r.name);
                    const newlyEnabled = registry.enableTools(names);

                    if (newlyEnabled.length > 0) {
                        void saveEnabledCategories(userId, registry.getEnabledCategories());
                    }

                    let text =
                        `**Found ${semanticResults.length} tool(s) matching "${query}" (semantic):**\n\n`;
                    for (const result of semanticResults) {
                        const status = newlyEnabled.includes(result.name)
                            ? " (now activated)"
                            : result.enabled
                                ? ""
                                : " (inactive)";
                        text +=
                            `- **${result.name}**${status}\n  ${result.description}\n  Category: ${result.category} | Tier: ${result.tier} | Similarity: ${result.score}\n`;
                        if (
                            result.suggestedParams
                            && Object.keys(result.suggestedParams).length > 0
                        ) {
                            text += `  Suggested params: ${JSON.stringify(result.suggestedParams)}\n`;
                        }
                        text += "\n";
                    }

                    if (newlyEnabled.length > 0) {
                        text += `\n${newlyEnabled.length} tool(s) activated and ready to use.\n`;
                    }

                    return { content: [{ type: "text", text }] };
                }

                const results = await registry.searchTools(query, limit);

                // Also search published tools in the DB
                let marketplaceTools: Array<
                    {
                        id: string;
                        name: string;
                        description: string;
                        installCount: number;
                        user: { name: string | null; };
                    }
                > = [];
                try {
                    const prisma = (await import("@/lib/prisma")).default;
                    marketplaceTools = await prisma.registeredTool.findMany({
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
                            installCount: true,
                            user: { select: { name: true } },
                        },
                        orderBy: { installCount: "desc" },
                        take: limit,
                    });
                } catch {
                    // DB query failure should not break platform tool search
                }

                if (results.length === 0 && marketplaceTools.length === 0) {
                    return {
                        content: [{
                            type: "text",
                            text:
                                `No tools found matching "${query}". Try different keywords or use list_categories.`,
                        }],
                    };
                }

                let text = "";

                if (results.length > 0) {
                    const names = results.map(r => r.name);
                    const newlyEnabled = registry.enableTools(names);

                    if (newlyEnabled.length > 0) {
                        void saveEnabledCategories(userId, registry.getEnabledCategories());
                    }

                    text += `**Found ${results.length} platform tool(s) matching "${query}":**\n\n`;
                    for (const result of results) {
                        const status = newlyEnabled.includes(result.name)
                            ? " (now activated)"
                            : result.enabled
                                ? ""
                                : " (inactive)";
                        text +=
                            `- **${result.name}**${status}\n  ${result.description}\n  Category: ${result.category} | Tier: ${result.tier}\n\n`;
                    }

                    if (newlyEnabled.length > 0) {
                        text += `\n${newlyEnabled.length} tool(s) activated and ready to use.\n\n`;
                    }
                }

                if (marketplaceTools.length > 0) {
                    text += `**Marketplace (${marketplaceTools.length} community tool(s)):**\n\n`;
                    for (const tool of marketplaceTools) {
                        const author = tool.user.name ?? "Unknown";
                        text +=
                            `- **${tool.name}** — ${tool.description}\n  Author: ${author} | Installs: ${tool.installCount} | ID: ${tool.id}\n\n`;
                    }
                    text += `Use \`marketplace_install\` to install community tools.\n`;
                }

                return { content: [{ type: "text", text }] };
            })
    );

    // list_categories
    registry.registerBuilt(
        freeTool(userId)
            .tool("list_categories", "List all available tool categories with descriptions and tool counts.", {})
            .meta({ category: "gateway-meta", tier: "free" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                if (typeof registry.listCategories !== "function") {
                    return {
                        content: [{
                            type: "text",
                            text:
                                `Internal error: registry missing listCategories (type: ${typeof registry}, constructor: ${registry?.constructor?.name})`,
                        }],
                        isError: true,
                    };
                }
                const categories = registry.listCategories();

                let text = `**spike.land Tool Categories (${registry.getToolCount()} total tools):**\n\n`;

                const freeCategories = categories.filter(c => c.tier === "free");
                const workspaceCategories = categories.filter(c => c.tier === "workspace");

                if (freeCategories.length > 0) {
                    text += `### Free\n\n`;
                    for (const cat of freeCategories) {
                        if (cat.name === "gateway-meta") continue;
                        const status = cat.enabledCount > 0
                            ? ` (${cat.enabledCount}/${cat.toolCount} active)`
                            : "";
                        text += `- **${cat.name}** (${cat.toolCount} tools)${status}\n  ${cat.description}\n\n`;
                    }
                }

                if (workspaceCategories.length > 0) {
                    text += `### Workspace Required\n\n`;
                    for (const cat of workspaceCategories) {
                        const status = cat.enabledCount > 0
                            ? ` (${cat.enabledCount}/${cat.toolCount} active)`
                            : "";
                        text += `- **${cat.name}** (${cat.toolCount} tools)${status}\n  ${cat.description}\n\n`;
                    }
                }

                text += "\nUse `search_tools` or `enable_category` to activate tools.";
                return { content: [{ type: "text", text }] };
            })
    );

    // enable_category
    registry.registerBuilt(
        freeTool(userId)
            .tool("enable_category", "Activate all tools in a specific category.", {
                category: z.string().min(1).describe("Category name to activate"),
            })
            .meta({ category: "gateway-meta", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { category } = input;

                const enabled = registry.enableCategory(category);

                if (enabled.length === 0) {
                    if (!registry.hasCategory(category)) {
                        if (typeof registry.listCategories !== "function") {
                            return {
                                content: [{
                                    type: "text",
                                    text:
                                        `Internal error: registry missing listCategories (type: ${typeof registry}, constructor: ${registry?.constructor?.name})`,
                                }],
                                isError: true,
                            };
                        }
                        const categories = registry.listCategories();
                        const available = categories.map(c => c.name).filter(n => n !== "gateway-meta").join(
                            ", ",
                        );
                        return {
                            content: [{
                                type: "text",
                                text: `Category "${category}" not found. Available: ${available}`,
                            }],
                            isError: true,
                        };
                    }
                    return {
                        content: [{
                            type: "text",
                            text: `All tools in "${category}" are already active.`,
                        }],
                    };
                }

                // Persist enabled categories to Redis (fire & forget)
                void saveEnabledCategories(userId, registry.getEnabledCategories());

                let text = `**Activated ${enabled.length} tool(s) in "${category}":**\n\n`;
                for (const name of enabled) text += `- ${name}\n`;
                text += `\nThese tools are now available for use.`;
                return { content: [{ type: "text", text }] };
            })
    );

    // get_balance — calls service layer directly
    registry.registerBuilt(
        freeTool(userId)
            .tool("get_balance", "Get the current token balance for AI image generation.", {})
            .meta({ category: "gateway-meta", tier: "free" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                try {
                    // Import dynamically to avoid circular deps at module level
                    const { WorkspaceCreditManager } = await import(
                        "@/lib/credits/workspace-credit-manager"
                    );
                    const balance = await WorkspaceCreditManager.getBalance(userId);
                    return {
                        content: [{
                            type: "text",
                            text:
                                `**Token Balance:** ${balance}\n\nToken costs:\n- 1K (1024px): 2 tokens\n- 2K (2048px): 5 tokens\n- 4K (4096px): 10 tokens`,
                        }],
                    };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [{ type: "text", text: `Error getting balance: ${msg}` }],
                        isError: true,
                    };
                }
            })
    );

    // get_status
    registry.registerBuilt(
        freeTool(userId)
            .tool("get_status", "Get platform status including available features, tool counts, and active categories.", {})
            .meta({ category: "gateway-meta", tier: "free" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                if (typeof registry.listCategories !== "function") {
                    return {
                        content: [{
                            type: "text",
                            text:
                                `Internal error: registry missing listCategories (type: ${typeof registry}, constructor: ${registry?.constructor?.name})`,
                        }],
                        isError: true,
                    };
                }
                const categories = registry.listCategories();
                const totalTools = registry.getToolCount();
                const enabledTools = registry.getEnabledCount();

                let text = `**spike.land Platform Status**\n\n`;
                text += `**Total Tools:** ${totalTools}\n`;
                text += `**Active Tools:** ${enabledTools}\n`;
                text += `**Categories:** ${categories.length}\n\n`;

                const activeCategories = categories.filter(c => c.enabledCount > 0);
                const inactiveCategories = categories.filter(c =>
                    c.enabledCount === 0 && c.name !== "gateway-meta"
                );

                if (activeCategories.length > 0) {
                    text += `**Active:**\n`;
                    for (const cat of activeCategories) {
                        text += `- ${cat.name}: ${cat.enabledCount}/${cat.toolCount} active\n`;
                    }
                    text += "\n";
                }

                if (inactiveCategories.length > 0) {
                    text += `**Available:**\n`;
                    for (const cat of inactiveCategories) {
                        text += `- ${cat.name}: ${cat.toolCount} tools\n`;
                    }
                    text += "\n";
                }

                text += "Use `search_tools` or `enable_category` to activate tools.";
                return { content: [{ type: "text", text }] };
            })
    );
}
