/**
 * Reactive Tool Graphs — Event-driven tool composition (CF Workers)
 *
 * Tools emit events on success/error, other tools auto-trigger via
 * configurable reaction rules. CRUD for reactions + log viewer.
 */

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DrizzleDB } from "../../db/db/db-index.ts";
import { reactionLogs, toolReactions } from "../../db/db/schema";
import { freeTool } from "../../lazy-imports/procedures-index.ts";
import type { ToolRegistryAdapter } from "../../lazy-imports/types";
import { safeToolCall, textResult } from "../lib/tool-helpers";

export function registerReactionsTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

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
      .handler(async ({ input, ctx }) => {
        return safeToolCall("create_reaction", async () => {
          const id = crypto.randomUUID();
          const now = Date.now();

          await ctx.db.insert(toolReactions).values({
            id,
            userId: ctx.userId,
            sourceTool: input.sourceTool,
            sourceEvent: input.sourceEvent,
            targetTool: input.targetTool,
            targetInput: JSON.stringify(input.targetInput),
            description: input.description ?? null,
            enabled: true,
            createdAt: now,
            updatedAt: now,
          });

          return textResult(
            `Reaction created (id: ${id}):\n` +
              `  ${input.sourceTool}:${input.sourceEvent} → ${input.targetTool}\n` +
              (input.description ? `  Description: ${input.description}\n` : "") +
              `  Enabled: true`,
          );
        });
      }),
  );

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
      .handler(async ({ input, ctx }) => {
        return safeToolCall("list_reactions", async () => {
          const conditions = [eq(toolReactions.userId, ctx.userId)];
          if (input.sourceTool) {
            conditions.push(eq(toolReactions.sourceTool, input.sourceTool));
          }
          if (input.enabled !== undefined) {
            conditions.push(eq(toolReactions.enabled, input.enabled));
          }

          const reactions = await ctx.db
            .select({
              id: toolReactions.id,
              sourceTool: toolReactions.sourceTool,
              sourceEvent: toolReactions.sourceEvent,
              targetTool: toolReactions.targetTool,
              enabled: toolReactions.enabled,
              description: toolReactions.description,
            })
            .from(toolReactions)
            .where(and(...conditions))
            .orderBy(desc(toolReactions.createdAt))
            .limit(input.limit);

          if (reactions.length === 0) {
            return textResult("No reactions found.");
          }

          const lines = reactions.map(
            (reaction) =>
              `- ${reaction.id}: ${reaction.sourceTool}:${reaction.sourceEvent} → ${
                reaction.targetTool
              } [${reaction.enabled ? "ON" : "OFF"}]` +
              (reaction.description ? ` — ${reaction.description}` : ""),
          );

          return textResult(`**Reactions (${reactions.length})**\n${lines.join("\n")}`);
        });
      }),
  );

  registry.registerBuilt(
    t
      .tool("delete_reaction", "Delete a tool reaction rule by ID.", {
        reactionId: z.string().describe("ID of the reaction to delete"),
      })
      .meta({ category: "reactions", tier: "free" })
      .handler(async ({ input, ctx }) => {
        return safeToolCall("delete_reaction", async () => {
          const existing = await ctx.db
            .select({ id: toolReactions.id })
            .from(toolReactions)
            .where(and(eq(toolReactions.id, input.reactionId), eq(toolReactions.userId, ctx.userId)))
            .limit(1);

          if (existing.length === 0) {
            return textResult(
              "**Error: NOT_FOUND**\nReaction not found or not owned by you.\n**Retryable:** false",
            );
          }

          await ctx.db
            .delete(toolReactions)
            .where(and(eq(toolReactions.id, input.reactionId), eq(toolReactions.userId, ctx.userId)));

          return textResult(`Reaction '${input.reactionId}' deleted.`);
        });
      }),
  );

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
      .handler(async ({ input, ctx }) => {
        return safeToolCall("reaction_log", async () => {
          const conditions = [eq(reactionLogs.userId, ctx.userId)];
          if (input.reactionId) {
            conditions.push(eq(reactionLogs.reactionId, input.reactionId));
          }
          if (input.sourceTool) {
            conditions.push(eq(reactionLogs.sourceTool, input.sourceTool));
          }
          if (input.isError !== undefined) {
            conditions.push(eq(reactionLogs.isError, input.isError));
          }

          const logs = await ctx.db
            .select({
              id: reactionLogs.id,
              sourceTool: reactionLogs.sourceTool,
              sourceEvent: reactionLogs.sourceEvent,
              targetTool: reactionLogs.targetTool,
              isError: reactionLogs.isError,
              durationMs: reactionLogs.durationMs,
              error: reactionLogs.error,
              createdAt: reactionLogs.createdAt,
            })
            .from(reactionLogs)
            .where(and(...conditions))
            .orderBy(desc(reactionLogs.createdAt))
            .limit(input.limit);

          if (logs.length === 0) {
            return textResult("No reaction logs found.");
          }

          const lines = logs.map(
            (log) =>
              `- ${log.id} [${new Date(log.createdAt).toISOString()}]: ${log.sourceTool}:${log.sourceEvent} → ${log.targetTool} ` +
              `(${log.isError ? "FAIL" : "OK"}${log.durationMs != null ? `, ${log.durationMs}ms` : ""})` +
              (log.error ? `\n  Error: ${log.error}` : ""),
          );

          return textResult(`**Reaction Log (${logs.length})**\n${lines.join("\n")}`);
        });
      }),
  );
}
