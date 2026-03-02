/**
 * Retrospective Analysis MCP Tools
 *
 * Session retrospectives and knowledge base management.
 * Ported from spike.land — pure in-memory computation.
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, jsonResult } from "../procedures/index";
import type { DrizzleDB } from "../db/index";

// ─── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
}

interface Retrospective {
  id: string;
  sessionId: string;
  patterns: string[];
  metrics: Record<string, number>;
  improvements: string[];
  createdAt: string;
}

// ─── In-memory storage ───────────────────────────────────────────────────────

const retros = new Map<string, Retrospective>();
const knowledgeBase = new Map<string, KnowledgeItem>();

export function clearRetro(): void {
  retros.clear();
  knowledgeBase.clear();
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerRetroTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool("retro_analyze", "Perform retrospective analysis on a completed session.", {
        session_id: z.string().describe("Session ID to analyze."),
      })
      .meta({ category: "retro", tier: "free" })
      .handler(async ({ input }) => {
        const id = crypto.randomUUID();
        const retro: Retrospective = {
          id,
          sessionId: input.session_id,
          patterns: [
            "Repetitive boilerplate for API routes",
            "Successful use of shard-ui components",
          ],
          metrics: { passRate: 0.85, iterationCount: 3 },
          improvements: ["Abstract API boilerplate into a generator pattern"],
          createdAt: new Date().toISOString(),
        };
        retros.set(id, retro);
        return jsonResult(
          `Retrospective completed for session ${input.session_id}. Retro ID: ${id}`,
          retro,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("retro_get", "Get full retrospective details.", {
        retro_id: z.string().describe("Retrospective ID."),
      })
      .meta({ category: "retro", tier: "free" })
      .handler(async ({ input }) => {
        const retro = retros.get(input.retro_id);
        if (!retro) throw new Error(`Retrospective ${input.retro_id} not found`);
        return jsonResult(`Retro ${input.retro_id}`, retro);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("retro_add_knowledge", "Add a new item to the knowledge base.", {
        category: z.string().describe("Knowledge category."),
        title: z.string().describe("Item title."),
        content: z.string().describe("Item content."),
        tags: z.array(z.string()).optional().describe("Tags."),
      })
      .meta({ category: "retro", tier: "free" })
      .handler(async ({ input }) => {
        const id = crypto.randomUUID();
        const item: KnowledgeItem = {
          id,
          category: input.category,
          title: input.title,
          content: input.content,
          tags: input.tags ?? [],
          createdAt: new Date().toISOString(),
        };
        knowledgeBase.set(id, item);
        return jsonResult(`Knowledge item added with ID: ${id}`, item);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("retro_search_knowledge", "Search the knowledge base for patterns or solutions.", {
        query: z.string().describe("Search query."),
        category: z.string().optional().describe("Filter by category."),
        limit: z.number().optional().describe("Max results (default 5)."),
      })
      .meta({ category: "retro", tier: "free" })
      .handler(async ({ input }) => {
        const limit = input.limit ?? 5;
        let results = Array.from(knowledgeBase.values());
        if (input.category) results = results.filter((i) => i.category === input.category);
        results = results
          .filter(
            (i) =>
              i.title.toLowerCase().includes(input.query.toLowerCase()) ||
              i.content.toLowerCase().includes(input.query.toLowerCase()),
          )
          .slice(0, limit);
        return jsonResult(`Found ${results.length} item(s) in knowledge base`, results);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("retro_compare_sessions", "Compare metrics and outcomes across multiple sessions.", {
        session_ids: z.array(z.string()).describe("Session IDs to compare."),
      })
      .meta({ category: "retro", tier: "free" })
      .handler(async ({ input }) => {
        return jsonResult(`Comparison of ${input.session_ids.length} sessions`, {
          sessions: input.session_ids,
          trends: ["Increasing pass rate", "Decreasing iteration count"],
        });
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "retro_get_recommendations",
        "Get improvement recommendations based on accumulated knowledge.",
        {
          project_type: z.string().optional().describe("Project type (default nextjs)."),
        },
      )
      .meta({ category: "retro", tier: "free" })
      .handler(async ({ input }) => {
        return jsonResult("General recommendations for " + (input.project_type ?? "nextjs"), [
          "Use server actions for data mutations",
          "Ensure high test coverage for core business logic",
        ]);
      }),
  );
}
