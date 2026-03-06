import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, errorResult, jsonResult, tryCatch } from "@spike-land-ai/mcp-server-base";
import type { StripeClient } from "../core-logic/stripe-client.js";
import type { Subscription } from "../core-logic/types.js";

function normalizeToMonthly(unitAmount: number, interval: string, intervalCount: number): number {
  switch (interval) {
    case "year":
      return (unitAmount * intervalCount) / 12;
    case "month":
      return unitAmount * intervalCount;
    case "week":
      return unitAmount * intervalCount * (52 / 12);
    case "day":
      return unitAmount * intervalCount * (365 / 12);
    default:
      return unitAmount;
  }
}

export function registerSubscriptionTools(server: McpServer, client: StripeClient): void {
  createZodTool(server, {
    name: "stripe_mrr",
    description: "Calculate Monthly Recurring Revenue from active Stripe subscriptions",
    schema: {},
    async handler() {
      const result = await tryCatch(
        client.getAll<Subscription>("subscriptions", { status: "active" }),
      );

      if (!result.ok) {
        return errorResult("STRIPE_API_ERROR", result.error.message, true);
      }

      const subscriptions = result.data;
      let totalMrr = 0;
      const planBreakdown = new Map<string, { mrr: number; count: number }>();

      for (const sub of subscriptions) {
        for (const item of sub.items.data) {
          const unitAmount = item.price.unit_amount ?? 0;
          const quantity = item.quantity;
          const recurring = item.price.recurring;

          if (!recurring) continue;

          const monthlyAmount = normalizeToMonthly(
            unitAmount * quantity,
            recurring.interval,
            recurring.interval_count,
          );

          totalMrr += monthlyAmount;

          const planKey = item.price.nickname ?? item.price.id;
          const entry = planBreakdown.get(planKey) ?? { mrr: 0, count: 0 };
          entry.mrr += monthlyAmount;
          entry.count += 1;
          planBreakdown.set(planKey, entry);
        }
      }

      const breakdown: Record<string, { mrr: number; count: number }> = {};
      for (const [plan, data] of planBreakdown) {
        breakdown[plan] = data;
      }

      return jsonResult({
        mrr: totalMrr,
        active_subscriptions_count: subscriptions.length,
        breakdown_by_plan: breakdown,
      });
    },
  });

  createZodTool(server, {
    name: "stripe_churn_analysis",
    description: "Analyze churned (canceled) subscriptions over a period. Note: churn_rate = canceled_in_period / (canceled_in_period + all_active), not a true cohort-based churn rate.",
    schema: {
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("End date in YYYY-MM-DD format"),
    },
    async handler({ start_date, end_date }) {
      const startUnix = Math.floor(new Date(start_date).getTime() / 1000);
      const endUnix = Math.floor(new Date(end_date).getTime() / 1000);

      if (isNaN(startUnix) || isNaN(endUnix)) {
        return errorResult("INVALID_INPUT", "Invalid date format. Use YYYY-MM-DD.");
      }

      const [canceledResult, activeResult] = await Promise.all([
        tryCatch(
          client.getAll<Subscription>("subscriptions", {
            status: "canceled",
            "canceled_at[gte]": String(startUnix),
            "canceled_at[lte]": String(endUnix),
          }),
        ),
        tryCatch(
          client.getAll<Subscription>("subscriptions", { status: "active" }),
        ),
      ]);

      if (!canceledResult.ok) {
        return errorResult("STRIPE_API_ERROR", canceledResult.error.message, true);
      }
      if (!activeResult.ok) {
        return errorResult("STRIPE_API_ERROR", activeResult.error.message, true);
      }

      const canceled = canceledResult.data;
      const activeCount = activeResult.data.length;

      const reasonCounts = new Map<string, number>();
      for (const sub of canceled) {
        const reason = sub.cancellation_details?.reason ?? "unknown";
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }

      const topReasons: Array<{ reason: string; count: number }> = [];
      for (const [reason, count] of reasonCounts) {
        topReasons.push({ reason, count });
      }
      topReasons.sort((a, b) => b.count - a.count);

      const totalBase = canceled.length + activeCount;

      return jsonResult({
        period: { start_date, end_date },
        churn_count: canceled.length,
        churn_rate: totalBase > 0 ? canceled.length / totalBase : 0,
        active_count: activeCount,
        top_cancellation_reasons: topReasons,
      });
    },
  });
}
