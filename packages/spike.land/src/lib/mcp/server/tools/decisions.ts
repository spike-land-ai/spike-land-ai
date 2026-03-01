/**
 * Decisions ADR Tools (Server-Side)
 *
 * MCP tools for Architecture Decision Records — record, list, get, and query
 * decisions made during development for audit trail and knowledge sharing.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { randomUUID } from "node:crypto";
import { freeTool } from "../tool-builder/procedures";

interface Decision {
    id: string;
    userId: string;
    title: string;
    context: string;
    decision: string;
    consequences: string;
    status: "proposed" | "accepted" | "deprecated" | "superseded";
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

const decisions = new Map<string, Decision>();

function formatAdr(d: Decision): string {
    const dateStr = d.createdAt.toISOString().split("T")[0];
    const tagsStr = d.tags.length > 0 ? d.tags.join(", ") : "none";

    return (
        `# ADR-${d.id}: ${d.title}\n`
        + `**Status:** ${d.status}\n`
        + `**Date:** ${dateStr}\n`
        + `**Tags:** ${tagsStr}\n\n`
        + `## Context\n${d.context}\n\n`
        + `## Decision\n${d.decision}\n\n`
        + `## Consequences\n${d.consequences}`
    );
}

export function registerDecisionsTools(
    registry: ToolRegistry,
    userId: string,
): void {
    // decision_record
    registry.registerBuilt(
        freeTool(userId)
            .tool("decision_record", "Record an Architecture Decision Record (ADR) for tracking decisions made during development.", {
                title: z.string().min(3).max(200).describe("Decision title"),
                context: z
                    .string()
                    .min(10)
                    .describe("Why this decision was needed"),
                decision: z.string().min(10).describe("What was decided"),
                consequences: z
                    .string()
                    .min(10)
                    .describe("Positive and negative outcomes"),
                status: z
                    .enum(["proposed", "accepted", "deprecated", "superseded"])
                    .optional()
                    .default("proposed")
                    .describe("Decision status"),
                tags: z
                    .array(z.string())
                    .optional()
                    .default([])
                    .describe("Tags for categorization"),
            })
            .meta({ category: "orchestration", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    title,
                    context,
                    decision,
                    consequences,
                    status,
                    tags,
                } = input;

                const id = randomUUID();
                const now = new Date();

                const record: Decision = {
                    id,
                    userId,
                    title,
                    context,
                    decision,
                    consequences,
                    status,
                    tags,
                    createdAt: now,
                    updatedAt: now,
                };

                decisions.set(id, record);

                const dateStr = now.toISOString().split("T")[0];
                const tagsStr = tags.length > 0 ? tags.join(", ") : "none";

                return textResult(
                    `**Decision recorded:** \`${id}\`\n\n`
                    + `## ${title}\n`
                    + `**Status:** ${status} | **Date:** ${dateStr} | **Tags:** ${tagsStr}\n\n`
                    + `**Context:** ${context.slice(0, 200)}${context.length > 200 ? "..." : ""}\n\n`
                    + `**Decision:** ${decision.slice(0, 200)}${decision.length > 200 ? "..." : ""}`,
                );
            })
    );

    // decision_list
    registry.registerBuilt(
        freeTool(userId)
            .tool("decision_list", "List all Architecture Decision Records with optional filtering by status or tag.", {
                status: z
                    .enum(["proposed", "accepted", "deprecated", "superseded"])
                    .optional()
                    .describe("Filter by decision status"),
                tag: z.string().optional().describe("Filter by tag"),
                limit: z
                    .number()
                    .min(1)
                    .max(100)
                    .optional()
                    .default(20)
                    .describe("Maximum results"),
            })
            .meta({ category: "orchestration", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    status,
                    tag,
                    limit,
                } = input;

                let filtered = Array.from(decisions.values()).filter(
                    d => d.userId === userId,
                );

                if (status) {
                    filtered = filtered.filter(d => d.status === status);
                }

                if (tag) {
                    filtered = filtered.filter(d => d.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
                }

                // Sort by creation date descending
                filtered.sort(
                    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
                );

                filtered = filtered.slice(0, limit);

                if (filtered.length === 0) {
                    const filters: string[] = [];
                    if (status) filters.push(`status="${status}"`);
                    if (tag) filters.push(`tag="${tag}"`);
                    const filterStr = filters.length > 0
                        ? ` matching ${filters.join(", ")}`
                        : "";
                    return textResult(`**No decisions found${filterStr}.**`);
                }

                let text = `**${filtered.length} Decision(s):**\n\n`;
                for (const d of filtered) {
                    const dateStr = d.createdAt.toISOString().split("T")[0];
                    const tagsStr = d.tags.length > 0 ? d.tags.join(", ") : "none";
                    text += `- **\`${d.id}\`** — ${d.title}\n`;
                    text += `  Status: ${d.status} | Date: ${dateStr} | Tags: ${tagsStr}\n`;
                }

                return textResult(text);
            })
    );

    // decision_get
    registry.registerBuilt(
        freeTool(userId)
            .tool("decision_get", "Get full details of a specific Architecture Decision Record in markdown format.", {
                decision_id: z.string().min(1).describe("The decision ID"),
            })
            .meta({ category: "orchestration", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    decision_id,
                } = input;

                const d = decisions.get(decision_id);

                if (!d) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `**Error:** Decision \`${decision_id}\` not found.`,
                            },
                        ],
                        isError: true,
                    };
                }

                if (d.userId !== userId) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `**Error:** Decision \`${decision_id}\` not found.`,
                            },
                        ],
                        isError: true,
                    };
                }

                return textResult(formatAdr(d));
            })
    );

    // decision_query
    registry.registerBuilt(
        freeTool(userId)
            .tool("decision_query", "Search Architecture Decision Records by keyword across title, context, and decision fields.", {
                query: z.string().min(1).describe("Search keyword(s)"),
                limit: z
                    .number()
                    .min(1)
                    .max(50)
                    .optional()
                    .default(10)
                    .describe("Maximum results"),
            })
            .meta({ category: "orchestration", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    query,
                    limit,
                } = input;

                const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

                if (terms.length === 0) {
                    return textResult("**No search terms provided.**");
                }

                const scored: Array<{ decision: Decision; score: number; }> = [];

                for (const d of decisions.values()) {
                    if (d.userId !== userId) continue;

                    const titleLower = d.title.toLowerCase();
                    const contextLower = d.context.toLowerCase();
                    const decisionLower = d.decision.toLowerCase();

                    let score = 0;
                    for (const term of terms) {
                        if (titleLower.includes(term)) score += 3;
                        if (contextLower.includes(term)) score += 2;
                        if (decisionLower.includes(term)) score += 1;
                    }

                    if (score > 0) {
                        scored.push({ decision: d, score });
                    }
                }

                scored.sort((a, b) => b.score - a.score);
                const results = scored.slice(0, limit);

                if (results.length === 0) {
                    return textResult(
                        `**No decisions found matching "${query}".**`,
                    );
                }

                let text = `**${results.length} result(s) for "${query}":**\n\n`;
                for (const { decision: d, score } of results) {
                    const excerpt = d.decision.slice(0, 120);
                    text += `- **\`${d.id}\`** — ${d.title} (score: ${score})\n`;
                    text += `  ${excerpt}${d.decision.length > 120 ? "..." : ""}\n`;
                }

                return textResult(text);
            })
    );
}

/** Exported for testing: clear all in-memory decisions. */
export function _clearDecisions(): void {
    decisions.clear();
}
