import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, errorResult, jsonResult, tryCatch } from "@spike-land-ai/mcp-server-base";
import type { StripeClient } from "../core-logic/stripe-client.js";
import type { BalanceTransaction, Dispute, Payout, StripeListResponse } from "../core-logic/types.js";

export function registerRevenueTools(server: McpServer, client: StripeClient): void {
  createZodTool(server, {
    name: "stripe_revenue_summary",
    description: "Fetch balance transactions for a period and aggregate revenue by type (charge, refund, fee, payout)",
    schema: {
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("End date in YYYY-MM-DD format"),
      currency: z.string().default("usd").describe("Currency code (default: usd)"),
    },
    async handler({ start_date, end_date, currency }) {
      const startUnix = Math.floor(new Date(start_date).getTime() / 1000);
      const endUnix = Math.floor(new Date(end_date).getTime() / 1000);

      if (isNaN(startUnix) || isNaN(endUnix)) {
        return errorResult("INVALID_INPUT", "Invalid date format. Use YYYY-MM-DD.");
      }

      const result = await tryCatch(
        client.getAll<BalanceTransaction>("balance_transactions", {
          "created[gte]": String(startUnix),
          "created[lte]": String(endUnix),
          "currency": currency,
        }),
      );

      if (!result.ok) {
        return errorResult("STRIPE_API_ERROR", result.error.message, true);
      }

      const transactions = result.data;
      const byType = new Map<string, { count: number; amount: number; fee: number }>();

      let totalRevenue = 0;
      let totalFees = 0;
      let totalRefunds = 0;

      for (const txn of transactions) {
        const entry = byType.get(txn.type) ?? { count: 0, amount: 0, fee: 0 };
        entry.count += 1;
        entry.amount += txn.amount;
        entry.fee += txn.fee;
        byType.set(txn.type, entry);

        if (txn.type === "charge" || txn.type === "payment") {
          totalRevenue += txn.amount;
        } else if (txn.type === "refund") {
          totalRefunds += Math.abs(txn.amount);
        }
        totalFees += txn.fee;
      }

      const breakdown: Record<string, { count: number; amount: number; fee: number }> = {};
      for (const [type, data] of byType) {
        breakdown[type] = data;
      }

      return jsonResult({
        period: { start_date, end_date },
        currency,
        total_revenue: totalRevenue,
        total_fees: totalFees,
        total_refunds: totalRefunds,
        net_revenue: totalRevenue - totalFees - totalRefunds,
        transaction_count: transactions.length,
        by_type: breakdown,
      });
    },
  });

  createZodTool(server, {
    name: "stripe_payout_history",
    description: "Fetch payout history from Stripe",
    schema: {
      limit: z.number().int().min(1).max(100).default(10).describe("Number of payouts to fetch"),
      status: z.enum(["paid", "pending", "in_transit", "canceled", "failed"]).optional().describe("Filter by payout status"),
    },
    async handler({ limit = 10, status }) {
      const params: Record<string, string> = {
        limit: String(limit),
      };
      if (status) {
        params.status = status;
      }

      const result = await tryCatch(
        client.get("payouts", params) as Promise<StripeListResponse<Payout>>,
      );

      if (!result.ok) {
        return errorResult("STRIPE_API_ERROR", result.error.message, true);
      }

      const payouts = result.data.data;
      return jsonResult({
        count: payouts.length,
        payouts: payouts.map((p) => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          arrival_date: new Date(p.arrival_date * 1000).toISOString(),
          created: new Date(p.created * 1000).toISOString(),
          method: p.method,
          description: p.description,
        })),
      });
    },
  });

  createZodTool(server, {
    name: "stripe_dispute_summary",
    description: "Fetch and summarize disputes from Stripe",
    schema: {
      status: z.enum(["needs_response", "under_review", "won", "lost"]).optional().describe("Filter by dispute status"),
    },
    async handler({ status }) {
      const params: Record<string, string> = {};
      if (status) {
        params.status = status;
      }

      const result = await tryCatch(
        client.getAll<Dispute>("disputes", params),
      );

      if (!result.ok) {
        return errorResult("STRIPE_API_ERROR", result.error.message, true);
      }

      const disputes = result.data;
      const byStatus = new Map<string, { count: number; amount: number }>();
      let wonCount = 0;
      let resolvedCount = 0;

      for (const d of disputes) {
        const entry = byStatus.get(d.status) ?? { count: 0, amount: 0 };
        entry.count += 1;
        entry.amount += d.amount;
        byStatus.set(d.status, entry);

        if (d.status === "won" || d.status === "lost") {
          resolvedCount += 1;
          if (d.status === "won") wonCount += 1;
        }
      }

      const statusBreakdown: Record<string, { count: number; amount: number }> = {};
      for (const [status, data] of byStatus) {
        statusBreakdown[status] = data;
      }

      const totalAmountAtRisk = disputes
        .filter((d) => d.status === "needs_response" || d.status === "under_review")
        .reduce((sum, d) => sum + d.amount, 0);

      return jsonResult({
        total_disputes: disputes.length,
        amount_at_risk: totalAmountAtRisk,
        win_rate: resolvedCount > 0 ? wonCount / resolvedCount : null,
        by_status: statusBreakdown,
      });
    },
  });
}
