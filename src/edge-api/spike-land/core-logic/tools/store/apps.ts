/**
 * Store Apps MCP Tools (CF Workers)
 *
 * Rate apps, read reviews, manage wishlists, and get recommendations.
 * Proxies to spike.land API for store operations.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../../lazy-imports/types";
import { freeTool } from "../../../lazy-imports/procedures-index.ts";
import { apiRequest, safeToolCall, textResult } from "../../lib/tool-helpers";
import type { DrizzleDB } from "../../../db/db/db-index.ts";

export function registerStoreAppsTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // store_app_rate
  registry.registerBuilt(
    t
      .tool("store_app_rate", "Rate a store app (1-5 stars) and optionally write a review body.", {
        appSlug: z.string().min(1).describe("The app slug to rate"),
        rating: z.number().int().min(1).max(5).describe("Rating from 1 to 5"),
        body: z
          .string()
          .optional()
          .nullable()
          .describe("Optional review text. Pass null or omit to clear."),
      })
      .meta({ category: "store", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_rate", async () => {
          const result = await apiRequest<{
            appName: string;
            avg: number;
            count: number;
          }>("/api/store/rate", {
            method: "POST",
            body: JSON.stringify({
              appSlug: input.appSlug,
              rating: input.rating,
              body: input.body ?? "",
            }),
          });

          return textResult(
            `Rated "${result.appName}" ${input.rating}/5 stars. New average: ${result.avg.toFixed(
              1,
            )} (${result.count} ratings).`,
          );
        });
      }),
  );

  // store_app_reviews
  registry.registerBuilt(
    t
      .tool("store_app_reviews", "List reviews for a store app as markdown.", {
        appSlug: z.string().min(1).describe("The app slug"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Max reviews to return (default 10)"),
      })
      .meta({ category: "store", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_reviews", async () => {
          const params = new URLSearchParams({ appSlug: input.appSlug });
          if (input.limit !== undefined) {
            params.set("limit", String(input.limit));
          }

          const result = await apiRequest<{
            appName: string;
            reviews: Array<{ rating: number; body: string; createdAt: string }>;
          }>(`/api/store/reviews?${params.toString()}`);

          if (result.reviews.length === 0) {
            return textResult(`No reviews yet for "${result.appName}".`);
          }

          const md = result.reviews
            .map(
              (r) =>
                `**${r.rating}/5** — ${r.body}\n*${new Date(r.createdAt).toLocaleDateString()}*`,
            )
            .join("\n\n---\n\n");
          return textResult(`## Reviews for ${result.appName}\n\n${md}`);
        });
      }),
  );

  // store_wishlist_add
  registry.registerBuilt(
    t
      .tool("store_wishlist_add", "Add a store app to the user wishlist.", {
        appSlug: z.string().min(1).describe("The app slug"),
      })
      .meta({ category: "store", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_wishlist_add", async () => {
          const result = await apiRequest<{ appName: string }>("/api/store/wishlist", {
            method: "POST",
            body: JSON.stringify({ appSlug: input.appSlug }),
          });
          return textResult(`Added "${result.appName}" to your wishlist.`);
        });
      }),
  );

  // store_wishlist_remove
  registry.registerBuilt(
    t
      .tool("store_wishlist_remove", "Remove a store app from the user wishlist.", {
        appSlug: z.string().min(1).describe("The app slug"),
      })
      .meta({ category: "store", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_wishlist_remove", async () => {
          await apiRequest(`/api/store/wishlist/${input.appSlug}`, {
            method: "DELETE",
          });
          return textResult(`Removed "${input.appSlug}" from your wishlist.`);
        });
      }),
  );

  // store_wishlist_get
  registry.registerBuilt(
    t
      .tool("store_wishlist_get", "Get the user's wishlisted apps.", {})
      .meta({ category: "store", tier: "free" })
      .handler(async () => {
        return safeToolCall("store_wishlist_get", async () => {
          const apps =
            await apiRequest<Array<{ name: string; slug: string }>>("/api/store/wishlist");

          if (apps.length === 0) return textResult("Your wishlist is empty.");
          const list = apps.map((a) => `- **${a.name}** (/apps/store/${a.slug})`).join("\n");
          return textResult(`## Your Wishlist\n\n${list}`);
        });
      }),
  );

  // store_recommendations_get
  registry.registerBuilt(
    t
      .tool(
        "store_recommendations_get",
        "Get app recommendations based on a given app slug using tag overlap scoring.",
        {
          appSlug: z.string().min(1).describe("The app to get recommendations for"),
          limit: z
            .number()
            .int()
            .min(1)
            .max(8)
            .optional()
            .default(4)
            .describe("Number of recommendations (default 4, max 8)"),
        },
      )
      .meta({ category: "store", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_recommendations_get", async () => {
          const params = new URLSearchParams({ appSlug: input.appSlug });
          if (input.limit !== undefined) {
            params.set("limit", String(input.limit));
          }

          const recs = await apiRequest<Array<{ name: string; tagline: string }>>(
            `/api/store/recommendations?${params.toString()}`,
          );

          if (recs.length === 0) {
            return textResult(`No recommendations found for "${input.appSlug}".`);
          }

          const list = recs.map((a) => `- **${a.name}** — ${a.tagline}`).join("\n");
          return textResult(`## Recommended for "${input.appSlug}"\n\n${list}`);
        });
      }),
  );

  // store_app_personalized
  registry.registerBuilt(
    t
      .tool(
        "store_app_personalized",
        "Get personalized app recommendations for the current user based on install history.",
        {
          limit: z
            .number()
            .int()
            .min(1)
            .max(20)
            .optional()
            .default(8)
            .describe("Max apps to return (default 8, max 20)"),
        },
      )
      .meta({ category: "store", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_personalized", async () => {
          const params = new URLSearchParams();
          if (input.limit !== undefined) {
            params.set("limit", String(input.limit));
          }

          const apps = await apiRequest<Array<{ name: string; tagline: string }>>(
            `/api/store/personalized?${params.toString()}`,
          );

          if (apps.length === 0) {
            return textResult("No personalized recommendations available.");
          }

          const list = apps.map((a) => `- **${a.name}** — ${a.tagline}`).join("\n");
          return textResult(`## Personalized Recommendations\n\n${list}`);
        });
      }),
  );

  // store_stats
  registry.registerBuilt(
    t
      .tool(
        "store_stats",
        "Get store statistics: total apps, tools, categories, and platform install counts.",
        {},
      )
      .meta({ category: "store", tier: "free" })
      .handler(async () => {
        return safeToolCall("store_stats", async () => {
          const stats = await apiRequest<{
            appCount: number;
            toolCount: number;
            categoryCount: number;
            developerCount: number;
            totalInstalls: number;
          }>("/api/store/stats");

          return textResult(
            `## Store Stats\n\n` +
              `- **Apps**: ${stats.appCount}\n` +
              `- **Tools**: ${stats.toolCount}\n` +
              `- **Categories**: ${stats.categoryCount}\n` +
              `- **Developers**: ${stats.developerCount}\n` +
              `- **Installs**: ${stats.totalInstalls}`,
          );
        });
      }),
  );
}
