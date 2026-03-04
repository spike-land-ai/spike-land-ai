/**
 * Billing Management MCP Tools (CF Workers)
 *
 * Subscription status and checkout intent.
 * Ported from spike.land — uses Drizzle D1 instead of Prisma.
 * Note: Actual Stripe checkout is handled by spike.land API routes.
 */

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool } from "../procedures/index";
import { textResult } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";
import { subscriptions, workspaceMembers, workspaces } from "../db/schema";

export function registerBillingTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "billing_create_checkout",
        "Create a Stripe checkout session URL for subscribing to a paid plan.",
        {
          tier: z.enum(["pro", "elite"]).describe("Subscription tier to purchase: pro or elite."),
          success_url: z
            .string()
            .url()
            .optional()
            .describe("URL to redirect to after successful checkout. Defaults to spike.land settings."),
          cancel_url: z
            .string()
            .url()
            .optional()
            .describe("URL to redirect to if the user cancels checkout. Defaults to spike.land pricing."),
        },
      )
      .meta({ category: "billing", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const successUrl = input.success_url ?? "https://spike.land/settings?tab=billing&success=1";
        const cancelUrl = input.cancel_url ?? "https://spike.land/pricing";

        // Return a checkout intent — actual Stripe session creation is handled
        // by the edge proxy to keep the Stripe secret key out of MCP tools.
        return textResult(
          `**Checkout Ready**\n\n` +
            `**Tier:** ${input.tier}\n` +
            `**User:** ${ctx.userId}\n\n` +
            `To complete checkout, visit:\n` +
            `https://spike.land/api/checkout?tier=${input.tier}&success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`,
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

  registry.registerBuilt(
    t
      .tool(
        "billing_cancel_subscription",
        "Cancel your active subscription. Your access continues until the end of the current billing period.",
        {},
      )
      .meta({ category: "billing", tier: "free" })
      .handler(async ({ ctx }) => {
        const sub = await ctx.db
          .select({
            id: subscriptions.id,
            status: subscriptions.status,
            stripeSubscriptionId: subscriptions.stripeSubscriptionId,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
          })
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.userId, ctx.userId),
              eq(subscriptions.status, "active"),
            ),
          )
          .limit(1);

        if (sub.length === 0 || !sub[0]) {
          return textResult("**No Active Subscription**\n\nYou don't have an active subscription to cancel.");
        }

        const s = sub[0];

        if (!s.stripeSubscriptionId) {
          return textResult(
            "**Cannot Cancel**\n\nYour subscription has no associated Stripe subscription. Contact support.",
          );
        }

        // Mark as canceled locally — Stripe webhook will confirm
        const now = Date.now();
        await ctx.db
          .update(subscriptions)
          .set({ status: "canceled", updatedAt: now })
          .where(eq(subscriptions.id, s.id));

        const endDate = s.currentPeriodEnd
          ? new Date(s.currentPeriodEnd).toISOString().split("T")[0]
          : "end of current period";

        return textResult(
          `**Subscription Canceled**\n\n` +
            `Your subscription has been canceled. You'll retain access until **${endDate}**.\n\n` +
            `To resubscribe, use \`billing_create_checkout\`.`,
        );
      }),
  );
}
