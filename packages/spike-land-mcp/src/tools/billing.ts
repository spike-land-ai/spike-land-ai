/**
 * Billing Management MCP Tools (CF Workers)
 *
 * Subscription status and checkout intent.
 * Ported from spike.land — uses Drizzle D1 instead of Prisma.
 * Note: Actual Stripe checkout is handled by spike.land API routes.
 */

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool } from "../procedures/index";
import { textResult } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";
import { workspaces, workspaceMembers, subscriptions } from "../db/schema";

export function registerBillingTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "billing_create_checkout",
        "Create a Stripe checkout session for purchasing tokens, subscribing to a plan, or upgrading workspace tier.",
        {
          type: z
            .enum(["tokens", "subscription", "workspace_tier"])
            .describe(
              "Checkout type: tokens (one-time), subscription (recurring), or workspace_tier (workspace upgrade).",
            ),
          workspace_id: z.string().min(1).describe("Workspace ID to associate the checkout with."),
          price_id: z
            .string()
            .optional()
            .describe(
              "Stripe Price ID (e.g. price_xxx). Required for subscription and workspace_tier types.",
            ),
          success_url: z
            .string()
            .url()
            .optional()
            .describe("URL to redirect to after successful checkout."),
          cancel_url: z
            .string()
            .url()
            .optional()
            .describe("URL to redirect to if the user cancels checkout."),
        },
      )
      .meta({ category: "billing", tier: "free" })
      .handler(async () => {
        return textResult(
          `Billing managed at spike.land — visit https://spike.land/settings?tab=billing to create a checkout session.`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "billing_status",
        "Get current billing status: subscription tier and plan info across all workspaces.",
        {},
      )
      .meta({ category: "billing", tier: "free" })
      .handler(async ({ ctx }) => {
        // Get user's subscription
        const sub = await ctx.db
          .select({
            plan: subscriptions.plan,
            status: subscriptions.status,
            stripeSubscriptionId: subscriptions.stripeSubscriptionId,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
          })
          .from(subscriptions)
          .where(eq(subscriptions.userId, ctx.userId))
          .limit(1);

        let text = `**Billing Status**\n\n`;

        if (sub.length > 0 && sub[0]) {
          const s = sub[0];
          text += `### Subscription\n`;
          text += `**Plan:** ${s.plan}\n`;
          text += `**Status:** ${s.status}\n`;
          text += `**Active Stripe Subscription:** ${s.stripeSubscriptionId ? "Yes" : "No"}\n`;
          if (s.currentPeriodEnd) {
            text += `**Current Period End:** ${new Date(s.currentPeriodEnd).toISOString()}\n`;
          }
        } else {
          text += `### Subscription\n`;
          text += `**Plan:** free\n`;
          text += `**Status:** No active subscription\n`;
        }

        // Fetch workspaces the user belongs to
        const userWorkspaces = await ctx.db
          .select({
            id: workspaces.id,
            name: workspaces.name,
            plan: workspaces.plan,
          })
          .from(workspaces)
          .innerJoin(
            workspaceMembers,
            and(
              eq(workspaceMembers.workspaceId, workspaces.id),
              eq(workspaceMembers.userId, ctx.userId),
            ),
          );

        if (userWorkspaces.length > 0) {
          text += `\n### Workspaces (${userWorkspaces.length})\n\n`;
          for (const ws of userWorkspaces) {
            text += `**${ws.name}** (${ws.id})\n`;
            text += `- Plan: ${ws.plan}\n\n`;
          }
        }

        return textResult(text);
      }),
  );
}
