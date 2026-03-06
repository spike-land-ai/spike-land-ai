/**
 * Reactive Tool Graphs — Event-driven tool composition (CF Workers)
 *
 * Tools emit events on success/error, other tools auto-trigger via
 * configurable reaction rules. CRUD for reactions + log viewer.
 *
 * Note: toolReaction and reactionLog tables are not in the D1 schema.
 * These tools proxy to spike.land API.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../lazy-imports/types";
import { freeTool } from "../../lazy-imports/procedures-index.ts";
import { apiRequest, safeToolCall, textResult } from "../lib/tool-helpers";
import type { DrizzleDB } from "../../db/db/db-index.ts";

export function registerReactionsTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // create_reaction
  registry.registerBuilt(
    t
      .tool(
        "create_reaction",
        "Create a tool reaction rule. When sourceTool emits sourceEvent (success|error), the targetTool is logged for invocation with targetInput.",
        {
          sourceTool: z
            .string()
            .describe("Tool name that triggers the reaction (e.g. 'arena_submit')"),
          sourceEvent: z.enum(["success", "error"]).describe("Event type to react to"),
          targetTool: z.string().describe("Tool name to invoke when reaction fires"),
          targetInput: z
            .record(z.string(), z.unknown())
            .describe(
              "The input arguments to pass to the target tool. You can use template variables like {{input.originalArg}} or {{output.resultValue}} to map data from the source event.",
            ),
          description: z
            .string()
            .optional()
            .describe("Human-readable description of this reaction"),
        },
      )
      .meta({ category: "reactions", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("create_reaction", async () => {
          const reaction = await apiRequest<{ id: string }>("/api/reactions", {
            method: "POST",
            body: JSON.stringify({
              sourceTool: input.sourceTool,
              sourceEvent: input.sourceEvent,
              targetTool: input.targetTool,
              targetInput: input.targetInput,
              description: input.description,
            }),
          });

          return textResult(
            `Reaction created (id: ${reaction.id}):\n` +
              `  ${input.sourceTool}:${input.sourceEvent} → ${input.targetTool}\n` +
              (input.description ? `  Description: ${input.description}\n` : "") +
              `  Enabled: true`,
          );
        });
      }),
  );

  // list_reactions
  registry.registerBuilt(
    t
      .tool(
        "list_reactions",
        "List your tool reaction rules. Optionally filter by sourceTool or enabled status.",
        {
          sourceTool: z.string().optional().describe("Filter by source tool name"),
          enabled: z.boolean().optional().describe("Filter by enabled status"),
          limit: z.number().min(1).max(100).optional().default(20).describe("Maximum results"),
        },
      )
      .meta({ category: "reactions", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("list_reactions", async () => {
          const params = new URLSearchParams();
          if (input.sourceTool) params.set("sourceTool", input.sourceTool);
          if (input.enabled !== undefined) {
            params.set("enabled", String(input.enabled));
          }
          if (input.limit !== undefined) {
            params.set("limit", String(input.limit));
          }

          const reactions = await apiRequest<
            Array<{
              id: string;
              sourceTool: string;
              sourceEvent: string;
              targetTool: string;
              enabled: boolean;
              description: string | null;
            }>
          >(`/api/reactions?${params.toString()}`);

          if (reactions.length === 0) {
            return textResult("No reactions found.");
          }

          const lines = reactions.map(
            (r) =>
              `- ${r.id}: ${r.sourceTool}:${r.sourceEvent} → ${r.targetTool} [${
                r.enabled ? "ON" : "OFF"
              }]` + (r.description ? ` — ${r.description}` : ""),
          );

          return textResult(`**Reactions (${reactions.length})**\n${lines.join("\n")}`);
        });
      }),
  );

  // delete_reaction
  registry.registerBuilt(
    t
      .tool("delete_reaction", "Delete a tool reaction rule by ID.", {
        reactionId: z.string().describe("ID of the reaction to delete"),
      })
      .meta({ category: "reactions", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("delete_reaction", async () => {
          await apiRequest(`/api/reactions/${input.reactionId}`, {
            method: "DELETE",
          });

          return textResult(`Reaction '${input.reactionId}' deleted.`);
        });
      }),
  );

  // reaction_log
  registry.registerBuilt(
    t
      .tool(
        "reaction_log",
        "View the execution log of tool reactions. Shows which reactions fired, when, and whether they succeeded.",
        {
          reactionId: z.string().optional().describe("Filter by specific reaction ID"),
          sourceTool: z.string().optional().describe("Filter by source tool name"),
          isError: z.boolean().optional().describe("Filter by error status"),
          limit: z.number().min(1).max(100).optional().default(20).describe("Maximum results"),
        },
      )
      .meta({ category: "reactions", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("reaction_log", async () => {
          const params = new URLSearchParams();
          if (input.reactionId) params.set("reactionId", input.reactionId);
          if (input.sourceTool) params.set("sourceTool", input.sourceTool);
          if (input.isError !== undefined) {
            params.set("isError", String(input.isError));
          }
          if (input.limit !== undefined) {
            params.set("limit", String(input.limit));
          }

          const logs = await apiRequest<
            Array<{
              id: string;
              sourceTool: string;
              sourceEvent: string;
              targetTool: string;
              isError: boolean;
              durationMs: number | null;
              error: string | null;
              createdAt: string;
            }>
          >(`/api/reactions/log?${params.toString()}`);

          if (logs.length === 0) {
            return textResult("No reaction logs found.");
          }

          const lines = logs.map(
            (l) =>
              `- ${l.id} [${l.createdAt}]: ${l.sourceTool}:${l.sourceEvent} → ${l.targetTool} ` +
              `(${l.isError ? "FAIL" : "OK"}${l.durationMs != null ? `, ${l.durationMs}ms` : ""})` +
              (l.error ? `\n  Error: ${l.error}` : ""),
          );

          return textResult(`**Reaction Log (${logs.length})**\n${lines.join("\n")}`);
        });
      }),
  );
}
