/**
 * Capabilities MCP Tools
 *
 * Agent permission management: check capabilities, request permissions, track approvals.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures";

export function registerCapabilitiesTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("capabilities_request_permissions", "Request additional tool or category permissions. Creates an approval request for the user.", {
                tools: z.array(z.string()).optional().describe(
                    "Specific tool names to request access to.",
                ),
                categories: z.array(z.string()).optional().describe(
                    "Tool categories to request access to.",
                ),
                reason: z.string().min(1).describe("Why access is needed."),
            })
            .meta({ category: "capabilities", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { tools, categories, reason } = input;

                // Find the agent's active capability token
                const token = await ctx.prisma.agentCapabilityToken.findFirst({
                    where: { grantedByUserId: userId, status: "ACTIVE" },
                    select: { id: true, agentId: true },
                });

                if (!token) {
                    return textResult(
                        "**No Capability Token**\n\n"
                        + "No active capability token found. You are operating with full user permissions.\n"
                        + "Permission requests are only needed when using capability-restricted tokens.",
                    );
                }

                const request = await ctx.prisma.permissionRequest.create({
                    data: {
                        agentId: token.agentId,
                        userId,
                        requestType: "scope_expansion",
                        requestPayload: {
                            tools: tools ?? [],
                            categories: categories ?? [],
                            reason,
                        },
                        fallbackBehavior: "QUEUE",
                        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    },
                });

                return textResult(
                    `**Permission Request Created**\n\n`
                    + `**Request ID:** ${request.id}\n`
                    + `**Tools:** ${(tools ?? []).join(", ") || "(none)"}\n`
                    + `**Categories:** ${(categories ?? []).join(", ") || "(none)"}\n`
                    + `**Reason:** ${reason}\n`
                    + `**Status:** PENDING\n\n`
                    + `The user will be notified to approve or deny this request.`,
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("capabilities_check_permissions", "Check current capability token scope, budget remaining, and trust level.", {})
            .meta({ category: "capabilities", tier: "free" })
            .handler(async ({ input: _args, ctx }) => {

                const token = await ctx.prisma.agentCapabilityToken.findFirst({
                    where: { grantedByUserId: userId, status: "ACTIVE" },
                    select: {
                        id: true,
                        allowedTools: true,
                        allowedCategories: true,
                        deniedTools: true,
                        maxTokenBudget: true,
                        usedTokenBudget: true,
                        maxApiCalls: true,
                        usedApiCalls: true,
                        delegationDepth: true,
                        maxDelegationDepth: true,
                        expiresAt: true,
                        agent: { select: { displayName: true } },
                    },
                });

                if (!token) {
                    return textResult(
                        "**No Capability Token**\n\n"
                        + "No active capability token found. You are operating with full user permissions.",
                    );
                }

                const trustScore = await ctx.prisma.agentTrustScore.findFirst({
                    where: { userId },
                    select: {
                        trustLevel: true,
                        totalSuccessful: true,
                        totalFailed: true,
                    },
                });

                return textResult(
                    `**Current Capabilities**\n\n`
                    + `**Agent:** ${token.agent.displayName}\n`
                    + `**Allowed Tools:** ${token.allowedTools.length > 0
                        ? token.allowedTools.join(", ")
                        : "(by category)"
                    }\n`
                    + `**Allowed Categories:** ${token.allowedCategories.join(", ")}\n`
                    + `**Denied Tools:** ${token.deniedTools.length > 0
                        ? token.deniedTools.join(", ")
                        : "(none)"
                    }\n`
                    + `**API Calls:** ${token.usedApiCalls}/${token.maxApiCalls}\n`
                    + `**Token Budget:** ${token.usedTokenBudget}/${token.maxTokenBudget}\n`
                    + `**Delegation Depth:** ${token.delegationDepth}/${token.maxDelegationDepth}\n`
                    + `**Expires:** ${token.expiresAt?.toISOString() ?? "never"}\n`
                    + (trustScore
                        ? `**Trust Level:** ${trustScore.trustLevel} (${trustScore.totalSuccessful} ok / ${trustScore.totalFailed} failed)`
                        : `**Trust Level:** SANDBOX (new agent)`),
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("capabilities_list_queued_actions", "List pending permission requests and their status.", {
                status: z.string().optional().default("PENDING").describe(
                    "Filter by status: PENDING, APPROVED, DENIED, EXPIRED.",
                ),
            })
            .meta({ category: "capabilities", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const { status } = input;

                const requests = await ctx.prisma.permissionRequest.findMany({
                    where: {
                        userId,
                        status: status as "PENDING" | "APPROVED" | "DENIED" | "EXPIRED",
                    },
                    select: {
                        id: true,
                        requestType: true,
                        requestPayload: true,
                        status: true,
                        fallbackBehavior: true,
                        denialReason: true,
                        createdAt: true,
                        agent: { select: { displayName: true } },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 20,
                });

                if (requests.length === 0) {
                    return textResult(
                        `**No ${status} Requests**\n\nNo permission requests with status "${status}" found.`,
                    );
                }

                let text = `**Permission Requests (${status})**\n\n`;
                for (const req of requests) {
                    text += `---\n`;
                    text += `**ID:** ${req.id}\n`;
                    text += `**Agent:** ${req.agent.displayName}\n`;
                    text += `**Type:** ${req.requestType}\n`;
                    text += `**Status:** ${req.status}\n`;
                    if (req.denialReason) {
                        text += `**Denial Reason:** ${req.denialReason}\n`;
                    }
                    text += `**Created:** ${req.createdAt.toISOString()}\n`;
                }

                return textResult(text);
            })
    );
}
