/**
 * Billing Management MCP Tools
 *
 * Stripe checkout sessions, subscription status, and credit balance.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import type { ToolModuleExport } from "../tool-discovery";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures";

export function registerBillingTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("billing_create_checkout", "Create a Stripe checkout session for purchasing tokens, subscribing to a plan, or upgrading workspace tier.", {
                type: z.enum(["tokens", "subscription", "workspace_tier"]).describe(
                    "Checkout type: tokens (one-time), subscription (recurring), or workspace_tier (workspace upgrade).",
                ),
                workspace_id: z.string().min(1).describe(
                    "Workspace ID to associate the checkout with.",
                ),
                price_id: z.string().optional().describe(
                    "Stripe Price ID (e.g. price_xxx). Required for subscription and workspace_tier types.",
                ),
                success_url: z.string().url().optional().describe(
                    "URL to redirect to after successful checkout.",
                ),
                cancel_url: z.string().url().optional().describe(
                    "URL to redirect to if the user cancels checkout.",
                ),
            })
            .meta({ category: "billing", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;

                // Verify workspace membership
                const membership = await ctx.prisma.workspaceMember.findFirst({
                    where: { userId, workspaceId: args.workspace_id },
                    select: { role: true },
                });

                if (!membership) {
                    return textResult(
                        "**Error:** Workspace not found or you are not a member.",
                    );
                }

                // NOTE: Actual Stripe checkout session creation is handled by the
                // /api/stripe/checkout route. This tool documents the intent and
                // validates prerequisites. The agent should direct the user to the
                // checkout UI or call the API route directly.
                let text = `**Checkout Session Intent**\n\n`
                    + `**Type:** ${args.type}\n`
                    + `**Workspace:** ${args.workspace_id}\n`
                    + `**User Role:** ${membership.role}\n`;

                if (args.price_id) {
                    text += `**Price ID:** ${args.price_id}\n`;
                }
                if (args.success_url) {
                    text += `**Success URL:** ${args.success_url}\n`;
                }
                if (args.cancel_url) {
                    text += `**Cancel URL:** ${args.cancel_url}\n`;
                }

                text +=
                    `\nTo complete checkout, direct the user to the billing page or call POST /api/stripe/checkout with the appropriate price_id/success_url/cancel_url.`;

                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("billing_status", "Get current billing status: subscription tier, Stripe subscription info, and AI credit balance across all workspaces.", z.object({}).shape)
            .meta({ category: "billing", tier: "free" })
            .handler(async ({ input: _input, ctx }) => {

                // Find user's personal workspace with subscription info
                const personalWorkspace = await ctx.prisma.workspace.findFirst({
                    where: {
                        isPersonal: true,
                        members: { some: { userId } },
                        deletedAt: null,
                    },
                    select: {
                        id: true,
                        name: true,
                        subscriptionTier: true,
                        stripeSubscriptionId: true,
                        monthlyAiCredits: true,
                        usedAiCredits: true,
                    },
                });

                if (!personalWorkspace) {
                    return textResult(
                        "**Error:** No personal workspace found for the current user.",
                    );
                }

                const hasActiveSubscription = !!personalWorkspace.stripeSubscriptionId;
                const remaining = Math.max(
                    0,
                    personalWorkspace.monthlyAiCredits - personalWorkspace.usedAiCredits,
                );

                // Also fetch detailed credit balance via WorkspaceCreditManager
                let creditBalance: {
                    remaining: number;
                    limit: number;
                    used: number;
                    tier: string;
                    workspaceId: string;
                } | null = null;
                try {
                    const { WorkspaceCreditManager } = await import(
                        "@/lib/credits/workspace-credit-manager"
                    );
                    creditBalance = await WorkspaceCreditManager.getBalance(userId);
                } catch {
                    // Credit manager unavailable — continue with workspace data only
                }

                let text = `**Billing Status**\n\n`;
                text += `### Personal Subscription\n`;
                text += `**Workspace:** ${personalWorkspace.name}\n`;
                text += `**Workspace ID:** ${personalWorkspace.id}\n`;
                text += `**Tier:** ${personalWorkspace.subscriptionTier}\n`;
                text += `**Active Stripe Subscription:** ${hasActiveSubscription ? "Yes" : "No"}\n\n`;

                text += `### Credits\n`;
                text += `**Monthly AI Credits:** ${personalWorkspace.monthlyAiCredits}\n`;
                text += `**Used:** ${personalWorkspace.usedAiCredits}\n`;
                text += `**Remaining:** ${remaining}\n`;

                if (creditBalance) {
                    text += `\n### Credit Manager\n`;
                    text += `**Limit:** ${creditBalance.limit}\n`;
                    text += `**Used:** ${creditBalance.used}\n`;
                    text += `**Remaining:** ${creditBalance.remaining}\n`;
                    text += `**Tier:** ${creditBalance.tier}\n`;
                    text += `**Workspace ID:** ${creditBalance.workspaceId}\n`;
                }

                // Fetch team/org workspaces the user belongs to
                const teamWorkspaces = await ctx.prisma.workspace.findMany({
                    where: {
                        isPersonal: false,
                        members: { some: { userId } },
                        deletedAt: null,
                    },
                    select: {
                        id: true,
                        name: true,
                        subscriptionTier: true,
                        stripeSubscriptionId: true,
                        monthlyAiCredits: true,
                        usedAiCredits: true,
                    },
                });

                if (teamWorkspaces.length > 0) {
                    text += `\n### Team Workspaces (${teamWorkspaces.length})\n\n`;
                    for (const ws of teamWorkspaces) {
                        const wsRecord = ws as Record<string, unknown>;
                        const wsMonthly = wsRecord.monthlyAiCredits as number;
                        const wsUsed = wsRecord.usedAiCredits as number;
                        const wsRemaining = Math.max(0, wsMonthly - wsUsed);
                        const wsHasSub = !!wsRecord.stripeSubscriptionId;
                        text += `**${wsRecord.name}** (${wsRecord.id})\n`;
                        text += `- Tier: ${wsRecord.subscriptionTier}\n`;
                        text += `- Stripe Subscription: ${wsHasSub ? "Yes" : "No"}\n`;
                        text += `- Credits: ${wsUsed}/${wsMonthly} used, ${wsRemaining} remaining\n\n`;
                    }
                }

                return textResult(text);
            })
    );
}

/** Auto-discovery metadata for tool-manifest. */
export const toolModules: ToolModuleExport[] = [
  { register: registerBillingTools, categories: ["billing"] },
];
