import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { jsonResult, safeToolCall } from "./tool-helpers";

export interface MCPTool {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (args: unknown) => Promise<CallToolResult>;
}

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

const retros = new Map<string, Retrospective>();
const knowledgeBase = new Map<string, KnowledgeItem>();

export const retroTools: MCPTool[] = [
  {
    name: "retro_analyze",
    description: "Perform retrospective analysis on a completed session",
    schema: z.object({
      session_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { session_id: string; };
      return safeToolCall("retro_analyze", async () => {
        const id = Math.random().toString(36).substring(2, 11);
        const retro: Retrospective = {
          id,
          sessionId: a.session_id,
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
          `Retrospective completed for session ${a.session_id}. Retro ID: ${id}`,
          retro,
        );
      });
    },
  },
  {
    name: "retro_get",
    description: "Get full retrospective details",
    schema: z.object({
      retro_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { retro_id: string; };
      return safeToolCall("retro_get", async () => {
        const retro = retros.get(a.retro_id);
        if (!retro) throw new Error(`Retrospective ${a.retro_id} not found`);
        return jsonResult(`Retro ${a.retro_id}`, retro);
      });
    },
  },
  {
    name: "retro_add_knowledge",
    description: "Add a new item to the knowledge base",
    schema: z.object({
      category: z.string(),
      title: z.string(),
      content: z.string(),
      tags: z.array(z.string()).optional(),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        category: string;
        title: string;
        content: string;
        tags?: string[];
      };
      return safeToolCall("retro_add_knowledge", async () => {
        const id = Math.random().toString(36).substring(2, 11);
        const item: KnowledgeItem = {
          id,
          category: a.category,
          title: a.title,
          content: a.content,
          tags: a.tags ?? [],
          createdAt: new Date().toISOString(),
        };
        knowledgeBase.set(id, item);
        return jsonResult(`Knowledge item added with ID: ${id}`, item);
      });
    },
  },
  {
    name: "retro_search_knowledge",
    description: "Search the knowledge base for patterns or solutions",
    schema: z.object({
      query: z.string(),
      category: z.string().optional(),
      limit: z.number().optional().default(5),
    }),
    handler: async (args: unknown) => {
      const a = args as { query: string; category?: string; limit: number; };
      return safeToolCall("retro_search_knowledge", async () => {
        let results = Array.from(knowledgeBase.values());
        if (a.category) {
          results = results.filter(i => i.category === a.category);
        }
        results = results.filter(i =>
          i.title.toLowerCase().includes(a.query.toLowerCase())
          || i.content.toLowerCase().includes(a.query.toLowerCase())
        ).slice(0, a.limit);
        return jsonResult(
          `Found ${results.length} item(s) in knowledge base`,
          results,
        );
      });
    },
  },
  {
    name: "retro_compare_sessions",
    description: "Compare metrics and outcomes across multiple sessions",
    schema: z.object({
      session_ids: z.array(z.string()),
    }),
    handler: async (args: unknown) => {
      const a = args as { session_ids: string[]; };
      return safeToolCall("retro_compare_sessions", async () => {
        return jsonResult(
          `Comparison of ${a.session_ids.length} sessions (Placeholder)`,
          {
            sessions: a.session_ids,
            trends: ["Increasing pass rate", "Decreasing iteration count"],
          },
        );
      });
    },
  },
  {
    name: "retro_get_recommendations",
    description: "Get improvement recommendations based on accumulated knowledge",
    schema: z.object({
      project_type: z.string().optional().default("nextjs"),
    }),
    handler: async (args: unknown) => {
      const a = args as { project_type?: string; };
      return safeToolCall("retro_get_recommendations", async () => {
        return jsonResult(
          "General recommendations for " + (a.project_type || "nextjs"),
          [
            "Use server actions for data mutations",
            "Ensure high test coverage for core business logic",
          ],
        );
      });
    },
  },
];
