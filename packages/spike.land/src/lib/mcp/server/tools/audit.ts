/**
 * Audit MCP Tools
 *
 * Query audit logs, export records, and inspect AI decision and agent trails.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { resolveWorkspace, safeToolCall, textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";

export function registerAuditTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("audit_query_logs", "Query workspace audit logs with optional filters for action and target type.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                action: z.string().optional().describe("Filter by action type."),
                target_type: z.string().optional().describe("Filter by target type."),
                days: z.number().optional().default(7).describe(
                    "Number of days to look back (default 7).",
                ),
                limit: z.number().optional().default(50).describe(
                    "Max records to return (default 50).",
                ),
            })
            .meta({ category: "audit", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;
                return safeToolCall("audit_query_logs", async () => {
                    const prisma = (await import("@/lib/prisma")).default;
                    const ws = await resolveWorkspace(userId, args.workspace_slug);
                    const since = new Date();
                    since.setDate(since.getDate() - args.days);
                    const where: Record<string, unknown> = {
                        workspaceId: ws.id,
                        createdAt: { gte: since },
                    };
                    if (args.action) where.action = args.action;
                    if (args.target_type) where.targetType = args.target_type;
                    const logs = await prisma.workspaceAuditLog.findMany({
                        where,
                        orderBy: { createdAt: "desc" },
                        take: args.limit,
                    });
                    if (logs.length === 0) {
                        return textResult(
                            "**No audit logs found** matching the given filters.",
                        );
                    }
                    const lines = logs.map(log =>
                        `- [${log.createdAt.toISOString()}] **${log.action}** on ${log.targetType ?? "unknown"
                        } by ${log.userId ?? "system"}`
                    );
                    return textResult(
                        `**Audit Logs (${logs.length})**\n\n${lines.join("\n")}`,
                    );
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("audit_export", "Export audit logs for a date range as a JSON summary.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                from_date: z.string().min(1).describe("Start date (ISO string)."),
                to_date: z.string().min(1).describe("End date (ISO string)."),
                format: z.string().optional().default("json").describe(
                    "Export format (default json).",
                ),
            })
            .meta({ category: "audit", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;
                return safeToolCall("audit_export", async () => {
                    const prisma = (await import("@/lib/prisma")).default;
                    const ws = await resolveWorkspace(userId, args.workspace_slug);
                    const fromDate = new Date(args.from_date);
                    const toDate = new Date(args.to_date);
                    const logs = await prisma.workspaceAuditLog.findMany({
                        where: {
                            workspaceId: ws.id,
                            createdAt: { gte: fromDate, lte: toDate },
                        },
                        orderBy: { createdAt: "desc" },
                    });
                    return textResult(
                        `**Audit Export Summary**\n\n`
                        + `**Format:** ${args.format}\n`
                        + `**Date Range:** ${args.from_date} to ${args.to_date}\n`
                        + `**Records:** ${logs.length}\n`
                        + `**Workspace:** ${ws.name}`,
                    );
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("audit_get_ai_decisions", "Retrieve AI decision logs for the workspace.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                days: z.number().optional().default(7).describe(
                    "Number of days to look back (default 7).",
                ),
                limit: z.number().optional().default(20).describe(
                    "Max records to return (default 20).",
                ),
            })
            .meta({ category: "audit", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;
                return safeToolCall("audit_get_ai_decisions", async () => {
                    const prisma = (await import("@/lib/prisma")).default;
                    const ws = await resolveWorkspace(userId, args.workspace_slug);
                    const since = new Date();
                    since.setDate(since.getDate() - args.days);
                    const decisions = await prisma.aIDecisionLog.findMany({
                        where: {
                            workspaceId: ws.id,
                            createdAt: { gte: since },
                        },
                        orderBy: { createdAt: "desc" },
                        take: args.limit,
                    });
                    if (decisions.length === 0) {
                        return textResult(
                            "**No AI decisions found** in the given time range.",
                        );
                    }
                    const lines = decisions.map(d =>
                        `- [${d.createdAt.toISOString()}] **${d.requestType}** — input: ${d.inputPrompt ?? "n/a"
                        } — output: ${d.outputResult ?? "n/a"}`
                    );
                    return textResult(
                        `**AI Decisions (${decisions.length})**\n\n${lines.join("\n")}`,
                    );
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("audit_get_agent_trail", "Retrieve agent activity audit trail.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                agent_id: z.string().optional().describe("Filter by agent ID."),
                limit: z.number().optional().default(20).describe(
                    "Max records to return (default 20).",
                ),
            })
            .meta({ category: "audit", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;
                return safeToolCall("audit_get_agent_trail", async () => {
                    const prisma = (await import("@/lib/prisma")).default;
                    const ws = await resolveWorkspace(userId, args.workspace_slug);
                    const where: Record<string, unknown> = { workspaceId: ws.id };
                    if (args.agent_id) where.agentId = args.agent_id;
                    const trail = await prisma.agentAuditLog.findMany({
                        where,
                        orderBy: { createdAt: "desc" },
                        take: args.limit,
                    });
                    if (trail.length === 0) {
                        return textResult(
                            "**No agent activity found** matching the given filters.",
                        );
                    }
                    const lines = trail.map(t =>
                        `- [${t.createdAt.toISOString()}] **${t.action}** — ${t.durationMs}ms`
                    );
                    return textResult(
                        `**Agent Trail (${trail.length})**\n\n${lines.join("\n")}`,
                    );
                }, { timeoutMs: 30_000 });
            })
    );
}
