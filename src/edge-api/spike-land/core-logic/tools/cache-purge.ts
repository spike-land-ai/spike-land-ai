/**
 * Cloudflare Cache Purge MCP Tool
 *
 * Purges Cloudflare CDN cache for spike.land via the spike-edge service binding.
 * Supports purging specific files or everything.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../lazy-imports/types";
import { freeTool } from "../../lazy-imports/procedures-index.ts";
import { textResult } from "../lib/tool-helpers";
import type { DrizzleDB } from "../../db/db/db-index.ts";

export function registerCachePurgeTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
  spikeEdge?: Fetcher,
  mcpInternalSecret?: string,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "cache_purge",
        "Purge Cloudflare CDN cache for spike.land. Use after deploying new assets " +
          "to ensure users get the latest version. Provide specific file URLs or purge everything.",
        {
          files: z
            .array(z.string().url())
            .max(30)
            .optional()
            .describe(
              "Array of full URLs to purge (max 30). Example: ['https://spike.land/assets/app.js']",
            ),
          purge_everything: z
            .boolean()
            .optional()
            .describe("Set to true to purge the entire cache. Use with caution."),
          blog: z
            .boolean()
            .optional()
            .describe("Set to true to purge all blog cache entries (index, RSS)."),
          blog_slugs: z
            .array(z.string())
            .optional()
            .describe(
              "Array of blog slugs to purge. Also purges blog index and RSS. " +
                "Example: ['think-slowly-ship-fast']",
            ),
        },
      )
      .meta({ category: "infra", tier: "free" })
      .examples([
        {
          name: "purge_specific_files",
          input: { files: ["https://spike.land/assets/app.js"] },
          description: "Purge specific cached assets",
        },
        {
          name: "purge_everything",
          input: { purge_everything: true },
          description: "Purge the entire CDN cache",
        },
        {
          name: "purge_blog_post",
          input: { blog_slugs: ["think-slowly-ship-fast"] },
          description: "Purge a specific blog post's cache (API + CDN + Workers Cache)",
        },
      ])
      .handler(async ({ input }) => {
        if (!input.files && !input.purge_everything && !input.blog && !input.blog_slugs) {
          return textResult(
            "Provide 'files' array, 'purge_everything: true', 'blog: true', or 'blog_slugs'",
          );
        }

        if (!spikeEdge) {
          return textResult("Cache purge unavailable: no spike-edge service binding");
        }

        const resp = await spikeEdge.fetch(
          new Request("https://spike-edge.internal/api/cache/purge", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(mcpInternalSecret
                ? { "X-Internal-Secret": mcpInternalSecret, "X-User-Id": userId }
                : {}),
            },
            body: JSON.stringify({
              ...(input.purge_everything ? { purge_everything: true } : {}),
              ...(input.files ? { files: input.files } : {}),
              ...(input.blog ? { blog: true } : {}),
              ...(input.blog_slugs ? { blog_slugs: input.blog_slugs } : {}),
            }),
          }),
        );

        const result = await resp.json<{ success?: boolean; errors?: unknown[] }>();

        const workersPurged = (result as Record<string, unknown>).workers_cache_purged;
        const workersInfo = Array.isArray(workersPurged) && workersPurged.length
          ? ` + ${workersPurged.length} Workers Cache API entries`
          : "";

        if (resp.ok && result.success) {
          const parts: string[] = [];
          if (input.purge_everything) parts.push("entire cache");
          if (input.files?.length) parts.push(`${input.files.length} file(s)`);
          if (input.blog_slugs?.length) parts.push(`blog slugs: ${input.blog_slugs.join(", ")}`);
          else if (input.blog) parts.push("all blog cache");
          const target = parts.join(", ") || "cache";
          return textResult(`Cache purge successful: ${target} purged${workersInfo}`);
        }

        return textResult(`Cache purge failed: ${JSON.stringify(result)}`);
      }),
  );
}
