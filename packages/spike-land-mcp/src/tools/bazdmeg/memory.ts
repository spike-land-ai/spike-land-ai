/**
 * BAZDMEG Memory MCP Tools (CF Workers)
 *
 * Search and list extracted insights from BAZDMEG chat conversations.
 * Ported from spike.land Prisma to Drizzle ORM + D1.
 *
 * Note: bazdmegMemory table is not yet in the D1 schema.
 * These tools proxy to spike.land API.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../types";
import { freeTool } from "../../procedures/index";
import { textResult, safeToolCall, apiRequest } from "../tool-helpers";
import type { DrizzleDB } from "../../db/index";

export function registerBazdmegMemoryTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // bazdmeg_memory_search
  registry.registerBuilt(
    t
      .tool(
        "bazdmeg_memory_search",
        "Search BAZDMEG knowledge base insights by keyword. Searches insight text and tags, returns matches sorted by confidence.",
        {
          query: z.string().describe("Keyword to search in insights and tags"),
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .optional()
            .describe("Max results to return (default 10)"),
        },
      )
      .meta({ category: "bazdmeg", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("bazdmeg_memory_search", async () => {
          const params = new URLSearchParams({ query: input.query });
          if (input.limit !== undefined) params.set("limit", String(input.limit));

          const memories = await apiRequest<
            Array<{
              insight: string;
              tags: string[];
              sourceQuestion: string;
              confidence: number;
            }>
          >(`/api/bazdmeg/memory/search?${params.toString()}`);

          if (memories.length === 0) {
            return textResult(`No BAZDMEG insights found for "${input.query}".`);
          }

          let text = `**BAZDMEG Insights** (${memories.length} result${
            memories.length === 1 ? "" : "s"
          } for "${input.query}")\n\n`;

          for (const m of memories) {
            const tags = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : "";
            text += `- **${m.insight}**${tags}\n`;
            text += `  _Source: "${m.sourceQuestion.slice(0, 100)}"_ | Confidence: ${m.confidence.toFixed(
              2,
            )}\n\n`;
          }

          return textResult(text);
        });
      }),
  );

  // bazdmeg_memory_list
  registry.registerBuilt(
    t
      .tool(
        "bazdmeg_memory_list",
        "List recent BAZDMEG knowledge base insights, sorted by most recent first.",
        {
          limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe("Max results to return (default 20)"),
        },
      )
      .meta({ category: "bazdmeg", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("bazdmeg_memory_list", async () => {
          const params = new URLSearchParams();
          if (input.limit !== undefined) params.set("limit", String(input.limit));

          const memories = await apiRequest<
            Array<{
              insight: string;
              tags: string[];
              confidence: number;
              createdAt: string;
            }>
          >(`/api/bazdmeg/memory?${params.toString()}`);

          if (memories.length === 0) {
            return textResult("No BAZDMEG insights saved yet.");
          }

          let text = `**BAZDMEG Insights** (${memories.length} most recent)\n\n`;

          for (const m of memories) {
            const tags = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : "";
            const date = m.createdAt.slice(0, 10);
            text += `- **${m.insight}**${tags}\n`;
            text += `  _${date}_ | Confidence: ${m.confidence.toFixed(2)}\n\n`;
          }

          return textResult(text);
        });
      }),
  );
}
