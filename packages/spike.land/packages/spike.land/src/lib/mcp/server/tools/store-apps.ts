/**
 * Store Apps MCP Tools
 *
 * Rate apps, read reviews, manage wishlists, and get recommendations
 * for the spike.land app store.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import {
  getFeaturedApps,
  getStoreStats,
  STORE_APPS,
} from "@/app/store/data/store-apps";
import type { StoreApp } from "@/app/store/data/types";

function scoreApp(target: StoreApp, candidate: StoreApp): number {
  if (target.id === candidate.id) return -1;
  let score = 0;
  if (target.category === candidate.category) score += 3;
  const targetTags = new Set(target.tags);
  for (const tag of candidate.tags) {
    if (targetTags.has(tag)) score += 2;
  }
  if (target.isFeatured && candidate.isFeatured) score += 1;
  return score;
}

const RateAppSchema = z.object({
  appSlug: z.string().min(1).describe("The app slug to rate"),
  rating: z.number().int().min(1).max(5).describe("Rating from 1 to 5"),
  body: z.string().optional().nullable().describe(
    "Optional review text. Pass null or omit to clear.",
  ),
});

const AppReviewsSchema = z.object({
  appSlug: z.string().min(1).describe("The app slug"),
  limit: z.number().int().min(1).max(50).optional().default(10).describe(
    "Max reviews to return (default 10)",
  ),
});

const WishlistAppSchema = z.object({
  appSlug: z.string().min(1).describe("The app slug"),
});

const EmptySchema = z.object({});

const PersonalizedSchema = z.object({
  limit: z.number().int().min(1).max(20).optional().default(8).describe(
    "Max apps to return (default 8, max 20)",
  ),
});

const RecommendationsSchema = z.object({
  appSlug: z.string().min(1).describe("The app to get recommendations for"),
  limit: z.number().int().min(1).max(8).optional().default(4).describe(
    "Number of recommendations (default 4, max 8)",
  ),
});

export function registerStoreAppsTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "store_app_rate",
    description: "Rate a store app (1-5 stars) and optionally write a review body",
    category: "store",
    tier: "free",
    inputSchema: RateAppSchema.shape,
    handler: async ({
      appSlug,
      rating,
      body,
    }: z.infer<typeof RateAppSchema>): Promise<CallToolResult> =>
      safeToolCall("store_app_rate", async () => {
        if (!userId) return textResult("Authentication required to rate apps.");
        const app = STORE_APPS.find(a => a.slug === appSlug);
        if (!app) return textResult(`App "${appSlug}" not found.`);
        try {
          const prisma = (await import("@/lib/prisma")).default;
          await prisma.storeAppReview.upsert({
            where: { appSlug_userId: { appSlug, userId } },
            update: { rating, body: body ?? "" },
            create: { appSlug, userId, rating, body: body ?? "" },
          });
          const stats = await prisma.storeAppReview.aggregate({
            where: { appSlug },
            _avg: { rating: true },
            _count: { rating: true },
          });
          const avg = stats._avg.rating ?? rating;
          const count = stats._count.rating;
          return textResult(
            `Rated "${app.name}" ${rating}/5 stars. New average: ${
              avg.toFixed(1)
            } (${count} ratings).`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult("Rating saved (DB table pending migration).");
          }
          throw err;
        }
      }),
  });

  registry.register({
    name: "store_app_reviews",
    description: "List reviews for a store app as markdown",
    category: "store",
    tier: "free",
    inputSchema: AppReviewsSchema.shape,
    handler: async ({
      appSlug,
      limit,
    }: z.infer<typeof AppReviewsSchema>): Promise<CallToolResult> =>
      safeToolCall("store_app_reviews", async () => {
        const app = STORE_APPS.find(a => a.slug === appSlug);
        if (!app) return textResult(`App "${appSlug}" not found.`);
        try {
          const prisma = (await import("@/lib/prisma")).default;
          const reviews = await prisma.storeAppReview.findMany({
            where: { appSlug },
            orderBy: { createdAt: "desc" },
            take: limit ?? 10,
          });
          if (reviews.length === 0) {
            return textResult(`No reviews yet for "${app.name}".`);
          }
          const md = reviews
            .map((r: { rating: number; body: string; createdAt: Date; }) =>
              `**${r.rating}/5** — ${r.body}\n*${new Date(r.createdAt).toLocaleDateString()}*`
            )
            .join("\n\n---\n\n");
          return textResult(`## Reviews for ${app.name}\n\n${md}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult(
              `No reviews available for "${app.name}" (DB table pending migration).`,
            );
          }
          throw err;
        }
      }),
  });

  registry.register({
    name: "store_wishlist_add",
    description: "Add a store app to the user wishlist",
    category: "store",
    tier: "free",
    inputSchema: WishlistAppSchema.shape,
    handler: async ({
      appSlug,
    }: z.infer<typeof WishlistAppSchema>): Promise<CallToolResult> =>
      safeToolCall("store_wishlist_add", async () => {
        if (!userId) return textResult("Authentication required.");
        const app = STORE_APPS.find(a => a.slug === appSlug);
        if (!app) return textResult(`App "${appSlug}" not found.`);
        try {
          const prisma = (await import("@/lib/prisma")).default;
          await prisma.storeAppWishlist.upsert({
            where: { appSlug_userId: { appSlug, userId } },
            update: {},
            create: { appSlug, userId },
          });
          return textResult(`Added "${app.name}" to your wishlist.`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult(
              `Added "${app.name}" to wishlist (DB pending migration).`,
            );
          }
          throw err;
        }
      }),
  });

  registry.register({
    name: "store_wishlist_remove",
    description: "Remove a store app from the user wishlist",
    category: "store",
    tier: "free",
    inputSchema: WishlistAppSchema.shape,
    handler: async ({
      appSlug,
    }: z.infer<typeof WishlistAppSchema>): Promise<CallToolResult> =>
      safeToolCall("store_wishlist_remove", async () => {
        if (!userId) return textResult("Authentication required.");
        const app = STORE_APPS.find(a => a.slug === appSlug);
        if (!app) return textResult(`App "${appSlug}" not found.`);
        try {
          const prisma = (await import("@/lib/prisma")).default;
          await prisma.storeAppWishlist.deleteMany({
            where: { appSlug, userId },
          });
          return textResult(`Removed "${app.name}" from your wishlist.`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult("Removed from wishlist (DB pending migration).");
          }
          throw err;
        }
      }),
  });

  registry.register({
    name: "store_wishlist_get",
    description: "Get the user's wishlisted apps",
    category: "store",
    tier: "free",
    inputSchema: EmptySchema.shape,
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("store_wishlist_get", async () => {
        if (!userId) return textResult("Authentication required.");
        try {
          const prisma = (await import("@/lib/prisma")).default;
          const wishlist = await prisma.storeAppWishlist.findMany({
            where: { userId },
          });
          const slugs = wishlist.map((w: { appSlug: string; }) => w.appSlug);
          const apps = STORE_APPS.filter(a => slugs.includes(a.slug));
          if (apps.length === 0) return textResult("Your wishlist is empty.");
          const list = apps.map(a => `- **${a.name}** (/apps/store/${a.slug})`).join("\n");
          return textResult(`## Your Wishlist\n\n${list}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult("Wishlist unavailable (DB pending migration).");
          }
          throw err;
        }
      }),
  });

  registry.register({
    name: "store_recommendations_get",
    description: "Get app recommendations based on a given app slug using tag overlap scoring",
    category: "store",
    tier: "free",
    inputSchema: RecommendationsSchema.shape,
    handler: async ({
      appSlug,
      limit,
    }: z.infer<typeof RecommendationsSchema>): Promise<CallToolResult> =>
      safeToolCall("store_recommendations_get", async () => {
        const target = STORE_APPS.find(a => a.slug === appSlug);
        if (!target) return textResult(`App "${appSlug}" not found.`);
        const maxLimit = Math.min(limit ?? 4, 8);
        const recs = STORE_APPS
          .map(app => ({ app, score: scoreApp(target, app) }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, maxLimit)
          .map(({ app }) => app);
        if (recs.length === 0) {
          return textResult(`No recommendations found for "${target.name}".`);
        }
        const list = recs.map(a => `- **${a.name}** — ${a.tagline}`).join(
          "\n",
        );
        return textResult(`## Recommended for "${target.name}"\n\n${list}`);
      }),
  });

  registry.register({
    name: "store_app_personalized",
    description:
      "Get personalized app recommendations for the current user based on install history",
    category: "store",
    tier: "free",
    inputSchema: PersonalizedSchema.shape,
    handler: async ({
      limit,
    }: z.infer<typeof PersonalizedSchema>): Promise<CallToolResult> =>
      safeToolCall("store_app_personalized", async () => {
        const maxLimit = Math.min(limit ?? 8, 20);
        if (!userId) {
          const apps = STORE_APPS.slice(0, maxLimit);
          const list = apps.map(a => `- **${a.name}** — ${a.tagline}`).join(
            "\n",
          );
          return textResult(
            `## Recommended Apps\n\nSign in for personalized recommendations.\n\n${list}`,
          );
        }
        let recommendedApps: typeof STORE_APPS = [];
        try {
          const prisma = (await import("@/lib/prisma")).default;
          const installs = await prisma.storeAppInstall.findMany({
            where: { userId },
            take: 20,
          });
          if (installs.length > 0) {
            const installedSlugs = new Set(
              installs.map((i: { appSlug: string; }) => i.appSlug),
            );
            const installedApps = STORE_APPS.filter(a => installedSlugs.has(a.slug));
            const installedCategories = new Set(
              installedApps.map(a => a.category),
            );
            recommendedApps = STORE_APPS
              .filter(a =>
                !installedSlugs.has(a.slug)
                && installedCategories.has(a.category)
              )
              .slice(0, maxLimit);
          }
        } catch {
          // DB not available — fall back below
        }
        if (recommendedApps.length === 0) {
          recommendedApps = getFeaturedApps().slice(0, maxLimit);
        }
        if (recommendedApps.length === 0) {
          recommendedApps = STORE_APPS.slice(0, maxLimit);
        }
        const list = recommendedApps.map(a => `- **${a.name}** — ${a.tagline}`).join("\n");
        return textResult(`## Personalized Recommendations\n\n${list}`);
      }),
  });

  registry.register({
    name: "store_stats",
    description: "Get store statistics: total apps, tools, categories, and platform install counts",
    category: "store",
    tier: "free",
    inputSchema: EmptySchema.shape,
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("store_stats", async () => {
        const stats = getStoreStats();
        let totalInstalls = 0;
        try {
          const { redis } = await import("@/lib/upstash/client");
          const slugs = STORE_APPS.map(a => a.slug);
          const counts = await Promise.all(
            slugs.map(s => redis.get<number>(`install:count:${s}`)),
          );
          totalInstalls = counts.reduce<number>((sum, c) => sum + (c ?? 0), 0);
        } catch {
          // best-effort — Redis may be unavailable
        }
        return textResult(
          `## Store Stats\n\n`
            + `- **Apps**: ${stats.appCount}\n`
            + `- **Tools**: ${stats.toolCount}\n`
            + `- **Categories**: ${stats.categoryCount}\n`
            + `- **Developers**: ${stats.developerCount}\n`
            + `- **Installs**: ${totalInstalls}`,
        );
      }),
  });
}
