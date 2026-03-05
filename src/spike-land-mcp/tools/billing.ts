/**
 * Billing Management MCP Tools (CF Workers)
 *
 * Thin adapter layer — delegates to lib/billing-service for data + formatting.
 * Note: Actual Stripe checkout is handled by spike.land API routes.
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool } from "../procedures/index";
import { textResult } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";
import { subscriptions } from "../db/schema";
import {
  getBillingStatus,
  getActiveSubscription,
  formatBillingStatus,
  formatPlanList,
  formatCancellationPreview,
  formatCancellationConfirm,
} from "../lib/billing-service";

export function registerBillingTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "billing_create_checkout",
        "Create a Stripe checkout session URL for subscribing to a paid plan.",
        {
          tier: z.enum(["pro", "business"]).describe("Subscription tier to purchase: pro or business."),
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

        const ALLOWED_URL_PATTERN = /^https:\/\/(spike\.land|edge\.spike\.land|testing\.spike\.land)(\/|$)/;
        if (input.success_url && !ALLOWED_URL_PATTERN.test(input.success_url)) {
          return textResult("**Error:** success_url must be a spike.land URL (https://spike.land/... or https://edge.spike.land/...).");
        }
        if (input.cancel_url && !ALLOWED_URL_PATTERN.test(input.cancel_url)) {
          return textResult("**Error:** cancel_url must be a spike.land URL (https://spike.land/... or https://edge.spike.land/...).");
        }

        return textResult(
          `**Checkout Ready**\n\n` +
            `**Tier:** ${input.tier}\n` +
            `**User:** ${ctx.userId}\n\n` +
            `To complete checkout, visit:\n` +
            `https://edge.spike.land/api/checkout?tier=${input.tier}&success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`,
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
        const data = await getBillingStatus(ctx.db, ctx.userId);
        return textResult(formatBillingStatus(data));
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "billing_cancel_subscription",
        "Cancel your active subscription. Your access continues until the end of the current billing period.",
        {
          confirm: z.boolean().default(false).describe("Set to true to execute cancellation. When false (default), returns a preview of what will happen."),
        },
      )
      .meta({ category: "billing", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const sub = await getActiveSubscription(ctx.db, ctx.userId);

        if (!sub) {
          return textResult("**No Active Subscription**\n\nYou don't have an active subscription to cancel.");
        }

        if (!input.confirm) {
          return textResult(formatCancellationPreview(sub));
        }

        if (!sub.stripeSubscriptionId) {
          return textResult(
            "**Cannot Cancel**\n\nYour subscription has no associated Stripe subscription. Contact support.",
          );
        }

        const now = Date.now();
        await ctx.db
          .update(subscriptions)
          .set({ status: "canceled", updatedAt: now })
          .where(eq(subscriptions.id, sub.id));

        return textResult(formatCancellationConfirm(sub));
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "billing_list_plans",
        "List available subscription plans with pricing and feature details. Call this before billing_create_checkout to understand what each tier includes.",
        {},
      )
      .meta({ category: "billing", tier: "free" })
      .handler(async () => {
        return textResult(formatPlanList());
      }),
  );
}
