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
            .describe("Array of full URLs to purge (max 30). Example: ['https://spike.land/assets/app.js']"),
          purge_everything: z
            .boolean()
            .optional()
            .describe("Set to true to purge the entire cache. Use with caution."),
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
      ])
      .handler(async ({ input }) => {
        if (!input.files && !input.purge_everything) {
          return textResult("Provide 'files' array or 'purge_everything: true'");
        }

        if (!spikeEdge) {
          return textResult("Cache purge unavailable: no spike-edge service binding");
        }

        const resp = await spikeEdge.fetch(
          new Request("https://spike-edge.internal/api/cache/purge", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(mcpInternalSecret ? { "X-Internal-Secret": mcpInternalSecret, "X-User-Id": userId } : {}),
            },
            body: JSON.stringify(
              input.purge_everything
                ? { purge_everything: true }
                : { files: input.files },
            ),
          }),
        );

        const result = await resp.json<{ success?: boolean; errors?: unknown[] }>();

        if (resp.ok && result.success) {
          const target = input.purge_everything
            ? "entire cache"
            : `${input.files?.length ?? 0} file(s)`;
          return textResult(`Cache purge successful: ${target} purged for spike.land`);
        }

        return textResult(`Cache purge failed: ${JSON.stringify(result)}`);
      }),
  );
}
