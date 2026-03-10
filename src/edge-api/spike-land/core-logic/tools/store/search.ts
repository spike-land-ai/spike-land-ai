/**
 * Store Search MCP Tools (CF Workers)
 *
 * Search, browse, and inspect apps in the spike.land app store.
 * Proxies to spike.land API for store app data.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../../lazy-imports/types";
import { freeTool } from "../../../lazy-imports/procedures-index.ts";
import { apiRequest, safeToolCall, textResult } from "../../lib/tool-helpers";
import type { DrizzleDB } from "../../../db/db/db-index.ts";

export function registerStoreSearchTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "store_list_apps_with_tools",
        "List all store apps with their MCP tool names for CLI tool grouping.",
        {
          limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe("Max apps to return (default 50)"),
          cursor: z.string().optional().describe("Pagination cursor for next page"),
        },
      )
      .meta({ category: "store-search", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_list_apps_with_tools", async () => {
          const params = new URLSearchParams();
          if (input.limit !== undefined) params.set("limit", String(input.limit));
          if (input.cursor) params.set("cursor", input.cursor);

          const apps = await apiRequest<
            Array<{
              slug: string;
              name: string;
              icon: string;
              category: string;
              tagline: string;
              toolNames: string[];
            }>
          >(`/api/store/apps/with-tools?${params.toString()}`);

          return textResult(JSON.stringify(apps));
        });
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "store_search",
        "Score-ranked search across app names, taglines, descriptions, and tags.",
        {
          query: z
            .string()
            .min(1)
            .describe("Search query to match against app names, taglines, descriptions, and tags"),
          category: z.string().optional().describe("Optional category filter"),
          limit: z
            .number()
            .int()
            .min(1)
            .max(20)
            .optional()
            .default(10)
            .describe("Max results to return (default 10)"),
        },
      )
      .meta({ category: "store-search", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_search", async () => {
          const params = new URLSearchParams({ query: input.query });
          if (input.category) params.set("category", input.category);
          if (input.limit !== undefined) {
            params.set("limit", String(input.limit));
          }

          const results = await apiRequest<
            Array<{
              name: string;
              tagline: string;
              slug: string;
            }>
          >(`/api/store/search?${params.toString()}`);

          if (results.length === 0) {
            return textResult(`No apps found matching "${input.query}".`);
          }

          const list = results
            .map((a) => `- **${a.name}** — ${a.tagline} (\`${a.slug}\`)`)
            .join("\n");
          return textResult(`## Search Results for "${input.query}"\n\n${list}`);
        });
      }),
  );

  registry.registerBuilt(
    t
      .tool("store_browse_category", "Browse all apps in a given store category.", {
        category: z
          .string()
          .min(1)
          .describe("Category to browse (e.g. developer, creative, productivity)"),
      })
      .meta({ category: "store-search", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_browse_category", async () => {
          const apps = await apiRequest<
            Array<{
              name: string;
              tagline: string;
              slug: string;
            }>
          >(`/api/store/category/${encodeURIComponent(input.category)}`);

          if (apps.length === 0) {
            return textResult(`No apps found in category "${input.category}".`);
          }

          const list = apps.map((a) => `- **${a.name}** — ${a.tagline} (\`${a.slug}\`)`).join("\n");
          return textResult(`## ${input.category} Apps\n\n${list}`);
        });
      }),
  );

  registry.registerBuilt(
    t
      .tool("store_featured_apps", "List all featured apps in the store.", {})
      .meta({ category: "store-search", tier: "free" })
      .handler(async () => {
        return safeToolCall("store_featured_apps", async () => {
          const apps =
            await apiRequest<
              Array<{
                name: string;
                tagline: string;
                slug: string;
              }>
            >("/api/store/featured");

          if (apps.length === 0) {
            return textResult("No featured apps at the moment.");
          }

          const list = apps.map((a) => `- **${a.name}** — ${a.tagline} (\`${a.slug}\`)`).join("\n");
          return textResult(`## Featured Apps\n\n${list}`);
        });
      }),
  );

  registry.registerBuilt(
    t
      .tool("store_new_apps", "List all new apps in the store.", {})
      .meta({ category: "store-search", tier: "free" })
      .handler(async () => {
        return safeToolCall("store_new_apps", async () => {
          const apps =
            await apiRequest<
              Array<{
                name: string;
                tagline: string;
                slug: string;
              }>
            >("/api/store/new");

          if (apps.length === 0) {
            return textResult("No new apps at the moment.");
          }

          const list = apps.map((a) => `- **${a.name}** — ${a.tagline} (\`${a.slug}\`)`).join("\n");
          return textResult(`## New Apps\n\n${list}`);
        });
      }),
  );

  registry.registerBuilt(
    t
      .tool("store_app_detail", "Get detailed information about a specific store app by slug.", {
        slug: z.string().min(1).describe("The app slug to get details for"),
      })
      .meta({ category: "store-search", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_detail", async () => {
          const app = await apiRequest<{
            name: string;
            tagline: string;
            description: string;
            category: string;
            tags: string[];
            pricing: string;
            toolCount: number;
            isFeatured: boolean;
            isNew: boolean;
          } | null>(`/api/store/apps/${input.slug}`);

          if (!app) {
            return textResult(`App "${input.slug}" not found.`);
          }

          const tags = app.tags.length > 0 ? app.tags.map((t) => `\`${t}\``).join(", ") : "None";

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
            `| Pricing | ${app.pricing} |`,
            `| Tools | ${app.toolCount} |`,
            `| Featured | ${app.isFeatured ? "Yes" : "No"} |`,
            `| New | ${app.isNew ? "Yes" : "No"} |`,
          ].join("\n");

          return textResult(card);
        });
      }),
  );
}
