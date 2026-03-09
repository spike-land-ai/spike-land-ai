/**
 * Store Apps MCP Tools (CF Workers)
 *
 * Rate apps, read reviews, manage wishlists, and get recommendations.
 * All backed by local D1 tables — no proxy to spike.land API.
 */

import { z } from "zod";
import { and, avg, count, desc, eq, ne, sql } from "drizzle-orm";
import type { ToolRegistryAdapter } from "../../../lazy-imports/types";
import { freeTool } from "../../../lazy-imports/procedures-index.ts";
import { McpError, McpErrorCode, safeToolCall, textResult } from "../../lib/tool-helpers";
import type { DrizzleDB } from "../../../db/db/db-index.ts";
import {
  appInstalls,
  appRatings,
  appWishlists,
  mcpApps,
  registeredTools,
} from "../../../db/db/schema";

function generateId(): string {
  return crypto.randomUUID();
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function parseTags(tagsJson: string): string[] {
  try {
    const parsed: unknown = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

async function requireApp(db: DrizzleDB, slug: string) {
  const rows = await db
    .select({ slug: mcpApps.slug, name: mcpApps.name })
    .from(mcpApps)
    .where(eq(mcpApps.slug, slug))
    .limit(1);
  if (rows.length === 0) {
    throw new McpError(`App "${slug}" not found.`, McpErrorCode.APP_NOT_FOUND, false);
  }
  return rows[0]!;
}

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
          const app = await requireApp(db, input.appSlug);
          const now = nowSeconds();
          const bodyText = input.body ?? "";

          // Check for existing rating
          const existing = await db
            .select({ id: appRatings.id })
            .from(appRatings)
            .where(and(eq(appRatings.userId, userId), eq(appRatings.appSlug, input.appSlug)))
            .limit(1);

          if (existing.length > 0) {
            await db
              .update(appRatings)
              .set({ rating: input.rating, body: bodyText, updatedAt: now })
              .where(eq(appRatings.id, existing[0]!.id));
          } else {
            await db.insert(appRatings).values({
              id: generateId(),
              userId,
              appSlug: input.appSlug,
              rating: input.rating,
              body: bodyText,
              createdAt: now,
              updatedAt: now,
            });
          }

          // Compute avg + count
          const stats = await db
            .select({
              avgRating: avg(appRatings.rating),
              ratingCount: count(appRatings.id),
            })
            .from(appRatings)
            .where(eq(appRatings.appSlug, input.appSlug));

          const avgVal = Number(stats[0]?.avgRating ?? 0);
          const countVal = stats[0]?.ratingCount ?? 0;

          return textResult(
            `Rated "${app.name}" ${input.rating}/5 stars. New average: ${avgVal.toFixed(1)} (${countVal} ratings).`,
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
          const app = await requireApp(db, input.appSlug);

          const reviews = await db
            .select({
              rating: appRatings.rating,
              body: appRatings.body,
              createdAt: appRatings.createdAt,
            })
            .from(appRatings)
            .where(eq(appRatings.appSlug, input.appSlug))
            .orderBy(desc(appRatings.createdAt))
            .limit(input.limit);

          if (reviews.length === 0) {
            return textResult(`No reviews yet for "${app.name}".`);
          }

          const md = reviews
            .map(
              (r) =>
                `**${r.rating}/5** — ${r.body}\n*${new Date(r.createdAt * 1000).toLocaleDateString()}*`,
            )
            .join("\n\n---\n\n");
          return textResult(`## Reviews for ${app.name}\n\n${md}`);
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
          const app = await requireApp(db, input.appSlug);

          // Check if already wishlisted
          const existing = await db
            .select({ id: appWishlists.id })
            .from(appWishlists)
            .where(and(eq(appWishlists.userId, userId), eq(appWishlists.appSlug, input.appSlug)))
            .limit(1);

          if (existing.length === 0) {
            await db.insert(appWishlists).values({
              id: generateId(),
              userId,
              appSlug: input.appSlug,
              createdAt: nowSeconds(),
            });
          }

          return textResult(`Added "${app.name}" to your wishlist.`);
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
          await db
            .delete(appWishlists)
            .where(and(eq(appWishlists.userId, userId), eq(appWishlists.appSlug, input.appSlug)));

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
          const rows = await db
            .select({
              name: mcpApps.name,
              slug: mcpApps.slug,
            })
            .from(appWishlists)
            .innerJoin(mcpApps, eq(appWishlists.appSlug, mcpApps.slug))
            .where(eq(appWishlists.userId, userId));

          if (rows.length === 0) return textResult("Your wishlist is empty.");
          const list = rows.map((a) => `- **${a.name}** (/apps/store/${a.slug})`).join("\n");
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
          // Load source app
          const sourceRows = await db
            .select({
              slug: mcpApps.slug,
              tags: mcpApps.tags,
              category: mcpApps.category,
            })
            .from(mcpApps)
            .where(eq(mcpApps.slug, input.appSlug))
            .limit(1);

          if (sourceRows.length === 0) {
            throw new McpError(
              `App "${input.appSlug}" not found.`,
              McpErrorCode.APP_NOT_FOUND,
              false,
            );
          }

          const source = sourceRows[0]!;
          const sourceTags = new Set(parseTags(source.tags));

          // Load all live apps except the source
          const candidates = await db
            .select({
              slug: mcpApps.slug,
              name: mcpApps.name,
              tagline: mcpApps.tagline,
              tags: mcpApps.tags,
              category: mcpApps.category,
            })
            .from(mcpApps)
            .where(and(eq(mcpApps.status, "live"), ne(mcpApps.slug, input.appSlug)));

          // Score by tag overlap + category bonus
          const scored = candidates
            .map((c) => {
              const cTags = parseTags(c.tags);
              const overlap = cTags.filter((tag) => sourceTags.has(tag)).length;
              const categoryBonus = c.category === source.category && c.category !== "" ? 0.5 : 0;
              return { ...c, score: overlap + categoryBonus };
            })
            .filter((c) => c.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, input.limit);

          if (scored.length === 0) {
            return textResult(`No recommendations found for "${input.appSlug}".`);
          }

          const list = scored.map((a) => `- **${a.name}** — ${a.tagline}`).join("\n");
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
          // Load user's installed app slugs
          const installed = await db
            .select({ appSlug: appInstalls.appSlug })
            .from(appInstalls)
            .where(eq(appInstalls.userId, userId));

          const installedSlugs = new Set(installed.map((i) => i.appSlug));

          // Build tag frequency map from installed apps
          const tagFreq = new Map<string, number>();
          if (installedSlugs.size > 0) {
            const installedApps = await db
              .select({ tags: mcpApps.tags })
              .from(mcpApps)
              .where(
                sql`${mcpApps.slug} IN (${sql.join(
                  [...installedSlugs].map((s) => sql`${s}`),
                  sql`, `,
                )})`,
              );

            for (const app of installedApps) {
              for (const tag of parseTags(app.tags)) {
                tagFreq.set(tag, (tagFreq.get(tag) ?? 0) + 1);
              }
            }
          }

          // Load all live apps not yet installed
          const candidates = await db
            .select({
              slug: mcpApps.slug,
              name: mcpApps.name,
              tagline: mcpApps.tagline,
              tags: mcpApps.tags,
              isFeatured: mcpApps.isFeatured,
            })
            .from(mcpApps)
            .where(eq(mcpApps.status, "live"));

          const uninstalled = candidates.filter((c) => !installedSlugs.has(c.slug));

          // Score by weighted tag overlap + featured bonus
          const scored = uninstalled
            .map((c) => {
              const cTags = parseTags(c.tags);
              let score = 0;
              for (const tag of cTags) {
                score += tagFreq.get(tag) ?? 0;
              }
              if (c.isFeatured) score += 0.5;
              return { ...c, score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, input.limit);

          if (scored.length === 0) {
            return textResult("No personalized recommendations available.");
          }

          const list = scored.map((a) => `- **${a.name}** — ${a.tagline}`).join("\n");
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
          // Count live apps and sum tool_count
          const appStats = await db
            .select({
              appCount: count(mcpApps.slug),
              toolCount: sql<number>`COALESCE(SUM(${mcpApps.toolCount}), 0)`,
            })
            .from(mcpApps)
            .where(eq(mcpApps.status, "live"));

          // Count distinct categories
          const catStats = await db
            .select({
              categoryCount: sql<number>`COUNT(DISTINCT ${mcpApps.category})`,
            })
            .from(mcpApps)
            .where(and(eq(mcpApps.status, "live"), ne(mcpApps.category, "")));

          // Count distinct developers from registeredTools
          const devStats = await db
            .select({
              developerCount: sql<number>`COUNT(DISTINCT ${registeredTools.userId})`,
            })
            .from(registeredTools);

          // Count total installs
          const installStats = await db
            .select({ totalInstalls: count(appInstalls.id) })
            .from(appInstalls);

          return textResult(
            `## Store Stats\n\n` +
              `- **Apps**: ${appStats[0]?.appCount ?? 0}\n` +
              `- **Tools**: ${appStats[0]?.toolCount ?? 0}\n` +
              `- **Categories**: ${catStats[0]?.categoryCount ?? 0}\n` +
              `- **Developers**: ${devStats[0]?.developerCount ?? 0}\n` +
              `- **Installs**: ${installStats[0]?.totalInstalls ?? 0}`,
          );
        });
      }),
  );
}
