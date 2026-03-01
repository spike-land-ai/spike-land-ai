/**
 * Reactive Tool Graphs — Event-driven tool composition
 *
 * Tools emit events on success/error, other tools auto-trigger via
 * configurable reaction rules. CRUD for reactions + log viewer.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { freeTool } from "../tool-builder/procedures";

export function registerReactionsTools(
    registry: ToolRegistry,
    userId: string,
): void {
    // create_reaction
    registry.registerBuilt(
        freeTool(userId)
            .tool("create_reaction", "Create a tool reaction rule. When sourceTool emits sourceEvent (success|error), the targetTool is logged for invocation with targetInput.", {
                sourceTool: z.string().describe(
                    "Tool name that triggers the reaction (e.g. 'arena_submit')",
                ),
                sourceEvent: z
                    .enum(["success", "error"])
                    .describe("Event type to react to"),
                targetTool: z.string().describe(
                    "Tool name to invoke when reaction fires",
                ),
                targetInput: z.record(z.string(), z.unknown()).describe(
                    "The input arguments to pass to the target tool. You can use template variables like {{input.originalArg}} or {{output.resultValue}} to map data from the source event.",
                ),
                description: z
                    .string()
                    .optional()
                    .describe("Human-readable description of this reaction"),
            })
            .meta({ category: "reactions", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const {
                    sourceTool,
                    sourceEvent,
                    targetTool,
                    targetInput,
                    description,
                } = input;

                const reaction = await ctx.prisma.toolReaction.create({
                    data: {
                        userId,
                        sourceTool,
                        sourceEvent,
                        targetTool,
                        targetInput: targetInput as import("@/generated/prisma").Prisma.InputJsonValue,
                        description: description ?? null,
                        enabled: true,
                    },
                });

                return {
                    content: [
                        {
                            type: "text",
                            text: `Reaction created (id: ${reaction.id}):\n`
                                + `  ${sourceTool}:${sourceEvent} → ${targetTool}\n`
                                + (description ? `  Description: ${description}\n` : "")
                                + `  Enabled: true`,
                        },
                    ],
                };
            })
    );

    // list_reactions
    registry.registerBuilt(
        freeTool(userId)
            .tool("list_reactions", "List your tool reaction rules. Optionally filter by sourceTool or enabled status.", {
                sourceTool: z.string().optional().describe("Filter by source tool name"),
                enabled: z
                    .boolean()
                    .optional()
                    .describe("Filter by enabled status"),
                limit: z
                    .number()
                    .min(1)
                    .max(100)
                    .optional()
                    .default(20)
                    .describe("Maximum results"),
            })
            .meta({ category: "reactions", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const {
                    sourceTool,
                    enabled,
                    limit,
                } = input;

                const where: Record<string, unknown> = { userId };
                if (sourceTool !== undefined) where.sourceTool = sourceTool;
                if (enabled !== undefined) where.enabled = enabled;

                const reactions = await ctx.prisma.toolReaction.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    take: limit,
                });

                if (reactions.length === 0) {
                    return {
                        content: [{ type: "text", text: "No reactions found." }],
                    };
                }

                const lines = reactions.map(
                    (
                        r: {
                            id: string;
                            sourceTool: string;
                            sourceEvent: string;
                            targetTool: string;
                            enabled: boolean;
                            description: string | null;
                        },
                    ) =>
                        `- ${r.id}: ${r.sourceTool}:${r.sourceEvent} → ${r.targetTool} [${r.enabled ? "ON" : "OFF"
                        }]`
                        + (r.description ? ` — ${r.description}` : ""),
                );

                return {
                    content: [
                        {
                            type: "text",
                            text: `**Reactions (${reactions.length})**\n${lines.join("\n")}`,
                        },
                    ],
                };
            })
    );

    // delete_reaction
    registry.registerBuilt(
        freeTool(userId)
            .tool("delete_reaction", "Delete a tool reaction rule by ID.", {
                reactionId: z.string().describe("ID of the reaction to delete"),
            })
            .meta({ category: "reactions", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const {
                    reactionId,
                } = input;

                const existing = await ctx.prisma.toolReaction.findFirst({
                    where: { id: reactionId, userId },
                });

                if (!existing) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Reaction '${reactionId}' not found or you don't own it.`,
                            },
                        ],
                        isError: true,
                    };
                }

                await ctx.prisma.toolReaction.delete({ where: { id: reactionId } });

                return {
                    content: [
                        {
                            type: "text",
                            text: `Reaction '${reactionId}' deleted.`,
                        },
                    ],
                };
            })
    );

    // reaction_log
    registry.registerBuilt(
        freeTool(userId)
            .tool("reaction_log", "View the execution log of tool reactions. Shows which reactions fired, when, and whether they succeeded.", {
                reactionId: z
                    .string()
                    .optional()
                    .describe("Filter by specific reaction ID"),
                sourceTool: z
                    .string()
                    .optional()
                    .describe("Filter by source tool name"),
                isError: z
                    .boolean()
                    .optional()
                    .describe("Filter by error status"),
                limit: z
                    .number()
                    .min(1)
                    .max(100)
                    .optional()
                    .default(20)
                    .describe("Maximum results"),
            })
            .meta({ category: "reactions", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const {
                    reactionId,
                    sourceTool,
                    isError,
                    limit,
                } = input;

                const where: Record<string, unknown> = { userId };
                if (reactionId !== undefined) where.reactionId = reactionId;
                if (sourceTool !== undefined) where.sourceTool = sourceTool;
                if (isError !== undefined) where.isError = isError;

                const logs = await ctx.prisma.reactionLog.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    take: limit,
                });

                if (logs.length === 0) {
                    return {
                        content: [{ type: "text", text: "No reaction logs found." }],
                    };
                }

                const lines = logs.map(
                    (
                        l: {
                            id: string;
                            sourceTool: string;
                            sourceEvent: string;
                            targetTool: string;
                            isError: boolean;
                            durationMs: number | null;
                            error: string | null;
                            createdAt: Date;
                        },
                    ) =>
                        `- ${l.id} [${l.createdAt.toISOString()}]: ${l.sourceTool}:${l.sourceEvent} → ${l.targetTool} `
                        + `(${l.isError ? "FAIL" : "OK"}${l.durationMs != null ? `, ${l.durationMs}ms` : ""})`
                        + (l.error ? `\n  Error: ${l.error}` : ""),
                );

                return {
                    content: [
                        {
                            type: "text",
                            text: `**Reaction Log (${logs.length})**\n${lines.join("\n")}`,
                        },
                    ],
                };
            })
    );
}
