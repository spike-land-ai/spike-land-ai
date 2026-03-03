/**
 * Store Search MCP Tools
 *
 * Search, browse, and inspect apps in the spike.land app store.
 * All tools use static STORE_APPS data — zero DB/Redis, no auth required.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import {
  getAppBySlug,
  getAppsByCategory,
  getFeaturedApps,
  getNewApps,
  STORE_APPS,
} from "@/app/store/data/store-apps";
import type { StoreApp } from "@/app/store/data/types";

const SearchSchema = z.object({
  query: z.string().min(1).describe(
    "Search query to match against app names, taglines, descriptions, and tags",
  ),
  category: z.string().optional().describe("Optional category filter"),
  limit: z.number().int().min(1).max(20).optional().default(10).describe(
    "Max results to return (default 10)",
  ),
});

const BrowseCategorySchema = z.object({
  category: z.string().min(1).describe(
    "Category to browse (e.g. developer, creative, productivity)",
  ),
});

const AppDetailSchema = z.object({
  slug: z.string().min(1).describe("The app slug to get details for"),
});

const EmptySchema = z.object({});

function formatAppList(apps: StoreApp[]): string {
  return apps.map(a => `- **${a.name}** — ${a.tagline} (\`${a.slug}\`)`).join(
    "\n",
  );
}

function scoreSearchResult(app: StoreApp, query: string): number {
  const q = query.toLowerCase();
  let score = 0;
  if (app.name.toLowerCase().includes(q)) score += 3;
  if (app.tags.some(t => t.toLowerCase().includes(q))) score += 2;
  if (app.tagline.toLowerCase().includes(q)) score += 1;
  if (app.description.toLowerCase().includes(q)) score += 1;
  return score;
}

export function registerStoreSearchTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "store_list_apps_with_tools",
    description: "List all store apps with their MCP tool names for CLI tool grouping",
    category: "store-search",
    tier: "free",
    inputSchema: EmptySchema.shape,
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("store_list_apps_with_tools", async () => {
        const apps = STORE_APPS.map(a => ({
          slug: a.slug,
          name: a.name,
          icon: a.icon,
          category: a.category,
          tagline: a.tagline,
          toolNames: a.mcpTools.map(t => t.name),
        }));
        return textResult(JSON.stringify(apps));
      }),
  });

  registry.register({
    name: "store_search",
    description: "Score-ranked search across app names, taglines, descriptions, and tags",
    category: "store-search",
    tier: "free",
    inputSchema: SearchSchema.shape,
    handler: async ({
      query,
      category,
      limit,
    }: z.infer<typeof SearchSchema>): Promise<CallToolResult> =>
      safeToolCall("store_search", async () => {
        const q = query.toLowerCase();
        let candidates = STORE_APPS.filter(app => {
          const nameMatch = app.name.toLowerCase().includes(q);
          const taglineMatch = app.tagline.toLowerCase().includes(q);
          const descMatch = app.description.toLowerCase().includes(q);
          const tagMatch = app.tags.some(t => t.toLowerCase().includes(q));
          return nameMatch || taglineMatch || descMatch || tagMatch;
        });

        if (category) {
          candidates = candidates.filter(app => app.category === category);
        }

        const results = candidates
          .map(app => ({ app, score: scoreSearchResult(app, query) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit ?? 10)
          .map(({ app }) => app);

        if (results.length === 0) {
          return textResult(`No apps found matching "${query}".`);
        }

        return textResult(
          `## Search Results for "${query}"\n\n${formatAppList(results)}`,
        );
      }),
  });

  registry.register({
    name: "store_browse_category",
    description: "Browse all apps in a given store category",
    category: "store-search",
    tier: "free",
    inputSchema: BrowseCategorySchema.shape,
    handler: async ({
      category,
    }: z.infer<typeof BrowseCategorySchema>): Promise<CallToolResult> =>
      safeToolCall("store_browse_category", async () => {
        const apps = getAppsByCategory(category);
        if (apps.length === 0) {
          return textResult(`No apps found in category "${category}".`);
        }
        return textResult(`## ${category} Apps\n\n${formatAppList(apps)}`);
      }),
  });

  registry.register({
    name: "store_featured_apps",
    description: "List all featured apps in the store",
    category: "store-search",
    tier: "free",
    inputSchema: EmptySchema.shape,
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("store_featured_apps", async () => {
        const apps = getFeaturedApps();
        if (apps.length === 0) {
          return textResult("No featured apps at the moment.");
        }
        return textResult(`## Featured Apps\n\n${formatAppList(apps)}`);
      }),
  });

  registry.register({
    name: "store_new_apps",
    description: "List all new apps in the store",
    category: "store-search",
    tier: "free",
    inputSchema: EmptySchema.shape,
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("store_new_apps", async () => {
        const apps = getNewApps();
        if (apps.length === 0) {
          return textResult("No new apps at the moment.");
        }
        return textResult(`## New Apps\n\n${formatAppList(apps)}`);
      }),
  });

  registry.register({
    name: "store_app_detail",
    description: "Get detailed information about a specific store app by slug",
    category: "store-search",
    tier: "free",
    inputSchema: AppDetailSchema.shape,
    handler: async ({
      slug,
    }: z.infer<typeof AppDetailSchema>): Promise<CallToolResult> =>
      safeToolCall("store_app_detail", async () => {
        const app = getAppBySlug(slug);
        if (!app) {
          return textResult(`App "${slug}" not found.`);
        }

        const tags = app.tags.length > 0
          ? app.tags.map(t => `\`${t}\``).join(", ")
          : "None";
        const pricing = app.pricing ?? "free";

        const card = [
          `## ${app.name}`,
          `*${app.tagline}*`,
          "",
          app.description,
          "",
          `| Field | Value |`,
          `| --- | --- |`,
          `| Category | ${app.category} |`,
          `| Tags | ${tags} |`,
          `| Pricing | ${pricing} |`,
          `| Tools | ${app.toolCount} |`,
          `| Featured | ${app.isFeatured ? "Yes" : "No"} |`,
          `| New | ${app.isNew ? "Yes" : "No"} |`,
        ].join("\n");

        return textResult(card);
      }),
  });
}
