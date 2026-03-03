/**
 * BAZDMEG Memory MCP Tools
 *
 * Search and list extracted insights from BAZDMEG chat conversations.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

export function registerBazdmegMemoryTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  // bazdmeg_memory_search
  const SearchSchema = z.object({
    query: z.string().describe("Keyword to search in insights and tags"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max results to return (default 10)"),
  });

  registry.register({
    name: "bazdmeg_memory_search",
    description:
      "Search BAZDMEG knowledge base insights by keyword. Searches insight text and tags, returns matches sorted by confidence.",
    category: "bazdmeg",
    tier: "free",
    inputSchema: SearchSchema.shape,
    handler: async ({
      query,
      limit,
    }: z.infer<typeof SearchSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_memory_search", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const take = limit ?? 10;

        const memories = await prisma.bazdmegMemory.findMany({
          where: {
            OR: [
              { insight: { contains: query, mode: "insensitive" } },
              { tags: { hasSome: [query.toLowerCase()] } },
            ],
          },
          orderBy: { confidence: "desc" },
          take,
        });

        if (memories.length === 0) {
          return textResult(`No BAZDMEG insights found for "${query}".`);
        }

        let text = `**BAZDMEG Insights** (${memories.length} result${
          memories.length === 1 ? "" : "s"
        } for "${query}")\n\n`;

        for (const m of memories) {
          const tags = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : "";
          text += `- **${m.insight}**${tags}\n`;
          text += `  _Source: "${m.sourceQuestion.slice(0, 100)}"_ | Confidence: ${
            m.confidence.toFixed(2)
          }\n\n`;
        }

        return textResult(text);
      }),
  });

  // bazdmeg_memory_list
  const ListSchema = z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max results to return (default 20)"),
  });

  registry.register({
    name: "bazdmeg_memory_list",
    description: "List recent BAZDMEG knowledge base insights, sorted by most recent first.",
    category: "bazdmeg",
    tier: "free",
    inputSchema: ListSchema.shape,
    handler: async ({
      limit,
    }: z.infer<typeof ListSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_memory_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const take = limit ?? 20;

        const memories = await prisma.bazdmegMemory.findMany({
          orderBy: { createdAt: "desc" },
          take,
        });

        if (memories.length === 0) {
          return textResult("No BAZDMEG insights saved yet.");
        }

        let text = `**BAZDMEG Insights** (${memories.length} most recent)\n\n`;

        for (const m of memories) {
          const tags = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : "";
          const date = m.createdAt.toISOString().slice(0, 10);
          text += `- **${m.insight}**${tags}\n`;
          text += `  _${date}_ | Confidence: ${m.confidence.toFixed(2)}\n\n`;
        }

        return textResult(text);
      }),
  });
}
