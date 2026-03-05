/**
 * Gateway Meta Tools (CF Workers)
 *
 * 5 always-on discovery tools for Progressive Context Disclosure.
 * Ported from spike.land — uses KV instead of Redis for category persistence,
 * Drizzle instead of Prisma for marketplace search.
 */

import { z } from "zod";
import { and, desc, eq, like, or } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { CATEGORY_AUDIENCES } from "../mcp/categories";
import type { DrizzleDB } from "../db/index";
import { registeredTools, users } from "../db/schema";
import { saveEnabledCategories } from "../kv/categories";
import { freeTool } from "../procedures/index";

export function registerGatewayMetaTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
  kv: KVNamespace,
): void {
  const t = freeTool(userId, db);

  // search_tools
  registry.registerBuilt(
    t
      .tool(
        "search_tools",
        "Search all available spike.land tools by keyword or description. Also searches the marketplace for community-published tools.",
        {
          query: z.string().min(1).max(200).describe("Search query"),
          limit: z.number().min(1).max(50).optional().default(10).describe("Maximum results"),
          semantic: z
            .boolean()
            .optional()
            .default(false)
            .describe("Use AI-powered semantic search with synonym expansion"),
        },
      )
      .meta({ category: "gateway-meta", tier: "free" })
      .examples([
        {
          name: "keyword_search",
          input: { query: "code generation", limit: 5 },
          description: "Search for code generation tools by keyword",
        },
        {
          name: "semantic_search",
          input: { query: "help me write tests", semantic: true },
          description: "Find test-related tools using semantic search",
        },
      ])
      .handler(async ({ input }) => {
        const { query, limit, semantic } = input;

        if (semantic) {
          const semanticResults = registry.searchToolsSemantic(query, limit);
          if (semanticResults.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No tools found matching "${query}" (semantic). Try different keywords or use list_categories.`,
                },
              ],
            };
          }

          const names = semanticResults.map((r) => r.name);
          const newlyEnabled = registry.enableTools(names);

          if (newlyEnabled.length > 0) {
            void saveEnabledCategories(userId, registry.getEnabledCategories(), kv);
          }

          let text = `**Found ${semanticResults.length} tool(s) matching "${query}" (semantic):**\n\n`;
          for (const result of semanticResults) {
            const status = newlyEnabled.includes(result.name)
              ? " (now activated)"
              : result.enabled
                ? ""
                : " (inactive)";
            text += `- **${result.name}**${status}\n  ${result.description}\n  Category: ${result.category} | Tier: ${result.tier} | Similarity: ${result.score}\n`;
            if (result.suggestedParams && Object.keys(result.suggestedParams).length > 0) {
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

        // Also search published tools in the DB (marketplace)
        let marketplaceTools: Array<{
          id: string;
          name: string;
          description: string;
          installCount: number;
          userName: string | null;
        }> = [];
        try {
          // SQLite LIKE is case-insensitive for ASCII — push filter into SQL
          const searchPattern = `%${query}%`;
          marketplaceTools = await db
            .select({
              id: registeredTools.id,
              name: registeredTools.name,
              description: registeredTools.description,
              installCount: registeredTools.installCount,
              userName: users.name,
            })
            .from(registeredTools)
            .leftJoin(users, eq(users.id, registeredTools.userId))
            .where(
              and(
                eq(registeredTools.status, "published"),
                or(
                  like(registeredTools.name, searchPattern),
                  like(registeredTools.description, searchPattern),
                ),
              ),
            )
            .orderBy(desc(registeredTools.installCount))
            .limit(limit);
        } catch {
          // DB query failure should not break platform tool search
        }

        if (results.length === 0 && marketplaceTools.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No tools found matching "${query}". Try different keywords or use list_categories.`,
              },
            ],
          };
        }

        let text = "";

        if (results.length > 0) {
          const names = results.map((r) => r.name);
          const newlyEnabled = registry.enableTools(names);

          if (newlyEnabled.length > 0) {
            void saveEnabledCategories(userId, registry.getEnabledCategories(), kv);
          }

          text += `**Found ${results.length} platform tool(s) matching "${query}":**\n\n`;
          for (const result of results) {
            const status = newlyEnabled.includes(result.name)
              ? " (now activated)"
              : result.enabled
                ? ""
                : " (inactive)";
            text += `- **${result.name}**${status}\n  ${result.description}\n  Category: ${result.category} | Tier: ${result.tier}\n\n`;
          }

          if (newlyEnabled.length > 0) {
            text += `\n${newlyEnabled.length} tool(s) activated and ready to use.\n\n`;
          }
        }

        if (marketplaceTools.length > 0) {
          text += `**Marketplace (${marketplaceTools.length} community tool(s)):**\n\n`;
          for (const tool of marketplaceTools) {
            const author = tool.userName ?? "Unknown";
            text += `- **${tool.name}** — ${tool.description}\n  Author: ${author} | Installs: ${tool.installCount} | ID: ${tool.id}\n\n`;
          }
          text += `Use \`marketplace_install\` to install community tools.\n`;
        }

        return { content: [{ type: "text", text }] };
      }),
  );

  // list_categories
  registry.registerBuilt(
    t
      .tool(
        "list_categories",
        "List all available tool categories with descriptions and tool counts.",
        {},
      )
      .meta({ category: "gateway-meta", tier: "free" })
      .handler(async () => {
        const categories = registry.listCategories();

        let text = `**spike.land Tool Categories (${registry.getToolCount()} total tools)**\n\n`;
        text += `_Tip: The "Labs" group is for distributed systems simulation — skip if building apps._\n\n`;

        // Group by audience
        const audienceLabels: Record<string, string> = {
          "app-building": "App Building",
          "ai-automation": "AI & Automation",
          "labs": "Labs (Distributed Systems)",
          "learning": "Learning",
          "platform": "Platform",
          "domain": "Domain",
          "infrastructure": "Infrastructure",
        };

        const grouped = new Map<string, typeof categories>();
        const ungrouped: typeof categories = [];

        for (const cat of categories) {
          if (cat.name === "gateway-meta") continue;
          const audience = CATEGORY_AUDIENCES[cat.name];
          if (audience) {
            if (!grouped.has(audience)) grouped.set(audience, []);
            grouped.get(audience)!.push(cat);
          } else {
            ungrouped.push(cat);
          }
        }

        for (const [audience, cats] of grouped) {
          const label = audienceLabels[audience] ?? audience;
          text += `### ${label}\n\n`;
          for (const cat of cats) {
            const status = cat.enabledCount > 0 ? ` (${cat.enabledCount}/${cat.toolCount} active)` : "";
            text += `- **${cat.name}** (${cat.toolCount} tools)${status}\n  ${cat.description}\n\n`;
          }
        }

        if (ungrouped.length > 0) {
          text += `### Other\n\n`;
          for (const cat of ungrouped) {
            const status = cat.enabledCount > 0 ? ` (${cat.enabledCount}/${cat.toolCount} active)` : "";
            text += `- **${cat.name}** (${cat.toolCount} tools)${status}\n  ${cat.description}\n\n`;
          }
        }

        text += "\nUse `search_tools` or `enable_category` to activate tools.";
        return { content: [{ type: "text", text }] };
      }),
  );

  // enable_category
  registry.registerBuilt(
    t
      .tool("enable_category", "Activate all tools in a specific category.", {
        category: z.string().min(1).describe("Category name to activate"),
      })
      .meta({ category: "gateway-meta", tier: "free" })
      .examples([
        {
          name: "enable_codegen",
          input: { category: "codegen" },
          description: "Activate all code generation tools",
        },
      ])
      .handler(async ({ input }) => {
        const { category } = input;

        const enabled = registry.enableCategory(category);

        if (enabled.length === 0) {
          if (!registry.hasCategory(category)) {
            const categories = registry.listCategories();
            const available = categories
              .map((c) => c.name)
              .filter((n) => n !== "gateway-meta")
              .join(", ");
            return {
              content: [
                {
                  type: "text",
                  text: `Category "${category}" not found. Available: ${available}`,
                },
              ],
              isError: true,
            };
          }
          return {
            content: [
              {
                type: "text",
                text: `All tools in "${category}" are already active.`,
              },
            ],
          };
        }

        // Persist enabled categories to KV (fire & forget)
        void saveEnabledCategories(userId, registry.getEnabledCategories(), kv);

        let text = `**Activated ${enabled.length} tool(s) in "${category}":**\n\n`;
        for (const name of enabled) text += `- ${name}\n`;
        text += `\nThese tools are now available for use.`;
        return { content: [{ type: "text", text }] };
      }),
  );

  // get_balance
  registry.registerBuilt(
    t
      .tool("get_balance", "Get current AI credit balance. Returns balance in credits with USD approximation.", {})
      .meta({ category: "gateway-meta", tier: "free" })
      .handler(async () => {
        return {
          content: [
            {
              type: "text",
              text:
                `**AI Credit Balance**\n\n` +
                `**Amount:** N/A (edge mode)\n` +
                `**Currency:** credits\n` +
                `**Approximate USD:** N/A\n\n` +
                `Balance details are available at https://spike.land/settings?tab=billing\n` +
                `Use \`billing_status\` to check your subscription tier.`,
            },
          ],
        };
      }),
  );

  // get_status
  registry.registerBuilt(
    t
      .tool(
        "get_status",
        "START HERE. Get a guided overview of spike.land capabilities, active tools, and recommended next steps.",
        {},
      )
      .meta({ category: "gateway-meta", tier: "free" })
      .handler(async () => {
        const categories = registry.listCategories();
        const totalTools = registry.getToolCount();
        const enabledTools = registry.getEnabledCount();

        let text = `**spike.land Platform Status**\n\n`;
        text += `**Total Tools:** ${totalTools}\n`;
        text += `**Active Tools:** ${enabledTools}\n`;
        text += `**Categories:** ${categories.length}\n\n`;

        const activeCategories = categories.filter((c) => c.enabledCount > 0);
        const inactiveCategories = categories.filter(
          (c) => c.enabledCount === 0 && c.name !== "gateway-meta",
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

        text += `**Getting Started:**\n`;
        text += `1. Use \`search_tools\` to find tools by keyword (e.g., "create app", "image generation")\n`;
        text += `2. Use \`list_categories\` to browse all tool categories grouped by audience\n`;
        text += `3. Use \`enable_category\` to activate a whole category at once\n\n`;
        text += `**Quick Start Paths:**\n`;
        text += `- **Build an app →** \`apps_create\` (or \`bootstrap_create_app\` for first-time setup)\n`;
        text += `- **Generate images →** enable "image" category\n`;
        text += `- **AI chat →** enable "ai-gateway" category\n`;
        text += `- **Manage secrets →** enable "vault" category\n`;
        return { content: [{ type: "text", text }] };
      }),
  );

  // get_tool_help
  registry.registerBuilt(
    t
      .tool("get_tool_help", "Get detailed help for a specific tool, including descriptions, examples, and version information.", {
        tool_name: z.string().describe("The name of the tool to get help for")
      })
      .meta({ category: "gateway-meta", tier: "free" })
      .handler(async ({ input }) => {
        const { tool_name } = input;
        const definitions = registry.getToolDefinitions();
        const def = definitions.find((d) => d.name === tool_name);
        
        if (!def) {
          return { content: [{ type: "text", text: `Tool not found: ${tool_name}` }], isError: true };
        }
        
        let text = `**Tool:** ${def.name}\n`;
        text += `**Description:** ${def.description}\n`;
        text += `**Category:** ${def.category}\n`;
        text += `**Version:** ${def.version}\n`;
        text += `**Stability:** ${def.stability}\n\n`;
        
        if (def.inputSchema) {
          text += `**Input Schema:**\n`;
          for (const [key, field] of Object.entries(def.inputSchema)) {
            const zField = field as any;
            const desc = zField.description || "No description";
            const isOptional = zField.isOptional ? zField.isOptional() : false;
            text += `- \`${key}\`${isOptional ? " (optional)" : ""}: ${desc}\n`;
          }
          text += "\n";
        }
        
        if (def.examples && def.examples.length > 0) {
          text += `**Examples:**\n`;
          for (const ex of def.examples) {
            text += `- **${ex.name}**: ${ex.description}\n  \`\`\`json\n  ${JSON.stringify(ex.input, null, 2)}\n  \`\`\`\n`;
          }
        } else {
          text += `*No examples provided for this tool.*\n`;
        }
        
        return { content: [{ type: "text", text }] };
      })
  );

  // search_tools_by_stability
  registry.registerBuilt(
    t
      .tool("search_tools_by_stability", "Find and automatically enable tools matching a specific stability tag (e.g., beta, experimental).", {
        stability: z.enum(["stable", "beta", "experimental", "deprecated", "not-implemented"]).describe("The stability level to search for"),
        limit: z.number().optional().describe("Max results to show")
      })
      .meta({ category: "gateway-meta", tier: "free" })
      .handler(async ({ input }) => {
        const { stability, limit } = input;
        const matching = registry.filterByStability(stability as any);
        
        if (matching.length === 0) {
          return { content: [{ type: "text", text: `No tools found with stability: ${stability}` }] };
        }
        
        registry.enableByStability(stability as any);
        void saveEnabledCategories(userId, registry.getEnabledCategories(), kv);
        
        let text = `**Found and activated ${matching.length} tool(s) with stability: ${stability}**\n\n`;
        
        const displayLimit = limit || 20;
        const displayTools = matching.slice(0, displayLimit);
        
        for (const def of displayTools) {
          text += `- **${def.name}** (v${def.version ?? "1.0.0"})\n  ${def.description}\n`;
        }
        
        if (matching.length > displayLimit) {
          text += `\n... and ${matching.length - displayLimit} more.`;
        }
        
        return { content: [{ type: "text", text }] };
      })
  );

  // list_tool_versions
  registry.registerBuilt(
    t
      .tool("list_tool_versions", "List all registered versions of a specific tool.", {
        tool_name: z.string().describe("The name of the tool")
      })
      .meta({ category: "gateway-meta", tier: "free" })
      .handler(async ({ input }) => {
        const { tool_name } = input;
        const versions = registry.listVersions(tool_name);
        
        if (versions.length === 0) {
          return { content: [{ type: "text", text: `No versions found for tool: ${tool_name}` }], isError: true };
        }
        
        let text = `**Versions for ${tool_name}:**\n\n`;
        for (const v of versions) {
          text += `- v${v.version} (${v.stability})\n`;
        }
        
        return { content: [{ type: "text", text }] };
      })
  );
}
