/**
 * Stripe Webhook Handler
 *
 * Verifies Stripe webhook signatures and handles subscription lifecycle events.
 * Uses raw D1 SQL (spike-edge pattern, not Drizzle).
 */

import { Hono } from "hono";
import type { Env } from "../env.js";

const stripeWebhook = new Hono<{ Bindings: Env }>();

// ─── Stripe Signature Verification ──────────────────────────────────────────

async function verifyStripeSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts.t;
  const v1Signature = parts.v1;
  if (!timestamp || !v1Signature) return false;

  // Reject timestamps older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (age > 300) return false;

  const payload = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expected === v1Signature;
}

// ─── Event Types ────────────────────────────────────────────────────────────

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

interface StripeSession {
  customer_email?: string;
  customer?: string;
  subscription?: string;
  metadata?: Record<string, string>;
}

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  items?: {
    data?: Array<{ price?: { lookup_key?: string; product?: string } }>;
  };
  current_period_end?: number;
  metadata?: Record<string, string>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapStripePlanToTier(subscription: StripeSubscription): string {
  const lookupKey = subscription.items?.data?.[0]?.price?.lookup_key;
  if (lookupKey?.includes("elite")) return "elite";
  if (lookupKey?.includes("pro")) return "pro";
  // Check metadata fallback
  const metaTier = subscription.metadata?.tier;
  if (metaTier === "elite" || metaTier === "pro") return metaTier;
  return "pro"; // default paid tier
}

// ─── Webhook Route ──────────────────────────────────────────────────────────

stripeWebhook.post("/stripe/webhook", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
    return c.json({ error: "Webhook not configured" }, 503);
  }

  const rawBody = await c.req.text();
  const valid = await verifyStripeSignature(rawBody, signature, webhookSecret);
  if (!valid) {
    return c.json({ error: "Invalid signature" }, 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const db = c.env.DB;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as unknown as StripeSession;
        const userId = session.metadata?.userId;
        if (!userId) {
          console.warn("[stripe-webhook] checkout.session.completed without userId in metadata");
          break;
        }

        const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
        const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : null;
        const now = Date.now();

        // Check if user already has a subscription
        const existing = await db.prepare(
          "SELECT id FROM subscriptions WHERE user_id = ? LIMIT 1",
        ).bind(userId).first<{ id: string }>();

        if (existing) {
          await db.prepare(
            `UPDATE subscriptions SET stripe_customer_id = ?, stripe_subscription_id = ?, status = 'active', plan = 'pro', updated_at = ?
             WHERE id = ?`,
          ).bind(stripeCustomerId, stripeSubscriptionId, now, existing.id).run();
        } else {
          await db.prepare(
            `INSERT INTO subscriptions (id, user_id, stripe_customer_id, stripe_subscription_id, status, plan, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'active', 'pro', ?, ?)`,
          ).bind(crypto.randomUUID(), userId, stripeCustomerId, stripeSubscriptionId, now, now).run();
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as unknown as StripeSubscription;
        const tier = mapStripePlanToTier(sub);
        const status = sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : sub.status;
        const periodEnd = sub.current_period_end ? sub.current_period_end * 1000 : null;
        const now = Date.now();

        await db.prepare(
          `UPDATE subscriptions SET status = ?, plan = ?, current_period_end = ?, updated_at = ?
           WHERE stripe_subscription_id = ?`,
        ).bind(status, tier, periodEnd, now, sub.id).run();
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as StripeSubscription;
        const now = Date.now();
        await db.prepare(
          `UPDATE subscriptions SET status = 'canceled', plan = 'free', updated_at = ?
           WHERE stripe_subscription_id = ?`,
        ).bind(now, sub.id).run();
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Record<string, unknown>;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
        if (subId) {
          const now = Date.now();
          await db.prepare(
            `UPDATE subscriptions SET status = 'past_due', updated_at = ?
             WHERE stripe_subscription_id = ?`,
          ).bind(now, subId).run();
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[stripe-webhook] Error handling ${event.type}:`, msg);
    // Still return 200 to prevent Stripe retries for processing errors
  }

  return c.json({ received: true });
});

export { stripeWebhook };
