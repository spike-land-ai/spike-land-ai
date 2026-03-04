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

  // HIGH-01: Use constant-time comparison to prevent timing attacks.
  // crypto.subtle.timingSafeEqual is Node-only; implement manually for CF Workers.
  const expectedHex = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expectedHex.length !== v1Signature.length) return false;

  // XOR each character code and accumulate — never short-circuit
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ v1Signature.charCodeAt(i);
  }
  return diff === 0;
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

interface StripeInvoice {
  customer?: string;
  subscription?: string;
  period_end?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapStripePlanToTier(subscription: StripeSubscription): string {
  const lookupKey = subscription.items?.data?.[0]?.price?.lookup_key;
  if (lookupKey?.includes("business")) return "business";
  if (lookupKey?.includes("pro")) return "pro";
  // Check metadata fallback
  const metaTier = subscription.metadata?.tier;
  if (metaTier === "business" || metaTier === "pro") return metaTier;
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

  // ── Idempotency: skip events already processed ───────────────────────────
  try {
    const already = await db.prepare(
      "SELECT id FROM webhook_events WHERE id = ? LIMIT 1",
    ).bind(event.id).first<{ id: string }>();

    if (already) {
      return c.json({ received: true, duplicate: true });
    }

    await db.prepare(
      "INSERT INTO webhook_events (id, processed_at) VALUES (?, ?)",
    ).bind(event.id, Date.now()).run();
  } catch (idempotencyError) {
    const msg = idempotencyError instanceof Error ? idempotencyError.message : "Unknown error";
    console.error("[stripe-webhook] Idempotency check failed:", msg);
    // Continue processing — the webhook_events table may not exist yet in dev
  }

  // ── Event handlers ───────────────────────────────────────────────────────

  switch (event.type) {
    case "checkout.session.completed": {
      try {
        const session = event.data.object as unknown as StripeSession;

        // Handle blog support donations (no userId required)
        if (session.metadata?.type === "blog_support") {
          const slug = session.metadata.slug;
          const amountStr = session.metadata.amount;
          const sessionId = (event.data.object as Record<string, unknown>).id as string | undefined;
          if (slug && sessionId) {
            // Update pending donation to completed
            const updated = await db.prepare(
              "UPDATE support_donations SET status = 'completed' WHERE stripe_session_id = ?",
            ).bind(sessionId).run();
            // If no pending record found, insert one
            if (!updated.meta.changes || updated.meta.changes === 0) {
              await db.prepare(
                "INSERT INTO support_donations (id, slug, amount_cents, stripe_session_id, status, created_at) VALUES (?, ?, ?, ?, 'completed', ?)",
              ).bind(
                crypto.randomUUID(),
                slug,
                amountStr ? Math.round(parseFloat(amountStr) * 100) : 0,
                sessionId,
                Date.now(),
              ).run();
            }
          }
          break;
        }

        const userId = session.metadata?.userId;
        if (!userId) {
          console.warn("[stripe-webhook] checkout.session.completed without userId in metadata");
          break;
        }

        const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
        const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : null;
        const now = Date.now();

        // Derive tier from session metadata (set by checkout endpoint)
        const rawTier = session.metadata?.tier;
        const plan = rawTier === "business" || rawTier === "pro" ? rawTier : "pro";

        // Check if user already has a subscription
        const existing = await db.prepare(
          "SELECT id FROM subscriptions WHERE user_id = ? LIMIT 1",
        ).bind(userId).first<{ id: string }>();

        if (existing) {
          await db.prepare(
            `UPDATE subscriptions SET stripe_customer_id = ?, stripe_subscription_id = ?, status = 'active', plan = ?, updated_at = ?
             WHERE id = ?`,
          ).bind(stripeCustomerId, stripeSubscriptionId, plan, now, existing.id).run();
        } else {
          await db.prepare(
            `INSERT INTO subscriptions (id, user_id, stripe_customer_id, stripe_subscription_id, status, plan, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
          ).bind(crypto.randomUUID(), userId, stripeCustomerId, stripeSubscriptionId, plan, now, now).run();
        }

        // Sync customer email if present in session
        const customerEmail = session.customer_email;
        if (customerEmail && customerEmail.length > 0) {
          await db.prepare(
            "UPDATE users SET email = ?, updated_at = ? WHERE id = ? AND email != ?",
          ).bind(customerEmail, now, userId, customerEmail).run();
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("[stripe-webhook] Error handling checkout.session.completed:", msg);
      }
      break;
    }

    case "customer.subscription.updated": {
      try {
        const sub = event.data.object as unknown as StripeSubscription;
        const tier = mapStripePlanToTier(sub);
        const status = sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : sub.status;
        const periodEnd = sub.current_period_end ? sub.current_period_end * 1000 : null;
        const now = Date.now();

        await db.prepare(
          `UPDATE subscriptions SET status = ?, plan = ?, current_period_end = ?, updated_at = ?
           WHERE stripe_subscription_id = ?`,
        ).bind(status, tier, periodEnd, now, sub.id).run();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("[stripe-webhook] Error handling customer.subscription.updated:", msg);
      }
      break;
    }

    case "customer.subscription.deleted": {
      try {
        const sub = event.data.object as unknown as StripeSubscription;
        const now = Date.now();
        await db.prepare(
          `UPDATE subscriptions SET status = 'canceled', plan = 'free', updated_at = ?
           WHERE stripe_subscription_id = ?`,
        ).bind(now, sub.id).run();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("[stripe-webhook] Error handling customer.subscription.deleted:", msg);
      }
      break;
    }

    case "invoice.paid": {
      try {
        const invoice = event.data.object as unknown as StripeInvoice;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
        if (subId) {
          const periodEnd = typeof invoice.period_end === "number" ? invoice.period_end * 1000 : null;
          const now = Date.now();
          await db.prepare(
            `UPDATE subscriptions SET current_period_end = ?, status = 'active', updated_at = ?
             WHERE stripe_subscription_id = ?`,
          ).bind(periodEnd, now, subId).run();
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("[stripe-webhook] Error handling invoice.paid:", msg);
      }
      break;
    }

    case "invoice.payment_failed": {
      try {
        const invoice = event.data.object as Record<string, unknown>;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
        if (subId) {
          const now = Date.now();
          await db.prepare(
            `UPDATE subscriptions SET status = 'past_due', updated_at = ?
             WHERE stripe_subscription_id = ?`,
          ).bind(now, subId).run();
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("[stripe-webhook] Error handling invoice.payment_failed:", msg);
      }
      break;
    }

    default:
      // Unhandled event type — acknowledge receipt
      break;
  }

  return c.json({ received: true });
});

export { stripeWebhook };
