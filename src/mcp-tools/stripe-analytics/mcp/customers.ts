import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, errorResult, jsonResult, tryCatch } from "@spike-land-ai/mcp-server-base";
import type { StripeClient } from "../core-logic/stripe-client.js";
import type { Charge, Invoice, Subscription } from "../core-logic/types.js";

export function registerCustomerTools(server: McpServer, client: StripeClient): void {
  createZodTool(server, {
    name: "stripe_customer_ltv",
    description: "Calculate customer lifetime value. Provide customer_id for a single customer, or omit for top customers by spend.",
    schema: {
      customer_id: z.string().optional().describe("Specific customer ID (optional)"),
      limit: z.number().int().min(1).max(100).default(20).describe("Number of top customers to return"),
    },
    async handler({ customer_id, limit = 20 }) {
      if (customer_id) {
        const result = await tryCatch(
          client.getAll<Charge>("charges", { customer: customer_id }),
        );

        if (!result.ok) {
          return errorResult("STRIPE_API_ERROR", result.error.message, true);
        }

        const charges = result.data.filter((c) => c.status === "succeeded");
        const totalSpend = charges.reduce((sum, c) => sum + c.amount, 0);

        const earliestCharge = charges[charges.length - 1];
        const latestCharge = charges[0];

        return jsonResult({
          customer_id,
          total_spend: totalSpend,
          charge_count: charges.length,
          average_charge: charges.length > 0 ? totalSpend / charges.length : 0,
          first_charge: earliestCharge
            ? new Date(earliestCharge.created * 1000).toISOString()
            : null,
          last_charge: latestCharge
            ? new Date(latestCharge.created * 1000).toISOString()
            : null,
        });
      }

      // Top customers by spend
      const result = await tryCatch(
        client.getAll<Charge>("charges", {}),
      );

      if (!result.ok) {
        return errorResult("STRIPE_API_ERROR", result.error.message, true);
      }

      const charges = result.data.filter((c) => c.status === "succeeded" && c.customer);
      const customerSpend = new Map<string, number>();

      for (const charge of charges) {
        if (charge.customer) {
          customerSpend.set(
            charge.customer,
            (customerSpend.get(charge.customer) ?? 0) + charge.amount,
          );
        }
      }

      const sorted = [...customerSpend.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      const totalLtv = sorted.reduce((sum, [, spend]) => sum + spend, 0);

      return jsonResult({
        average_ltv: sorted.length > 0 ? totalLtv / sorted.length : 0,
        top_customers: sorted.map(([id, spend]) => ({ customer_id: id, total_spend: spend })),
      });
    },
  });

  createZodTool(server, {
    name: "stripe_upcoming_invoices",
    description: "Revenue forecast from upcoming invoices for active subscriptions",
    schema: {},
    async handler() {
      const subsResult = await tryCatch(
        client.getAll<Subscription>("subscriptions", { status: "active" }),
      );

      if (!subsResult.ok) {
        return errorResult("STRIPE_API_ERROR", subsResult.error.message, true);
      }

      const subscriptions = subsResult.data;
      const invoiceResults: Array<{ customer: string; amount_due: number; currency: string }> = [];
      const errors: string[] = [];

      // Fetch upcoming invoices per subscription (Stripe requires a customer param)
      const customerIds = [...new Set(subscriptions.map((s) => s.customer))];

      for (const customerId of customerIds) {
        const result = await tryCatch(
          client.get("invoices/upcoming", { customer: customerId }) as Promise<Invoice>,
        );

        if (result.ok) {
          invoiceResults.push({
            customer: customerId,
            amount_due: result.data.amount_due,
            currency: result.data.currency,
          });
        } else {
          // Some customers may not have upcoming invoices (Stripe returns 404)
          if (!result.error.message.includes("404") && !result.error.message.includes("invoice_upcoming_none")) {
            errors.push(`${customerId}: ${result.error.message}`);
          }
        }
      }

      const totalUpcoming = invoiceResults.reduce((sum, inv) => sum + inv.amount_due, 0);

      return jsonResult({
        total_upcoming_amount: totalUpcoming,
        invoice_count: invoiceResults.length,
        next_30_days_forecast: totalUpcoming,
        invoices: invoiceResults,
        ...(errors.length > 0 ? { errors } : {}),
      });
    },
  });
}
