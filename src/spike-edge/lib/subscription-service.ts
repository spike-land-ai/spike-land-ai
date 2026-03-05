/**
 * Subscription lifecycle service.
 * Handles Stripe subscription events with D1 persistence.
 */

import { createLogger } from "@spike-land-ai/shared";
import { mapStripePlanToTier } from "./tier-service.js";

const log = createLogger("spike-edge");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

export interface StripeSession {
  customer_email?: string;
  customer?: string;
  subscription?: string;
  metadata?: Record<string, string>;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  items?: {
    data?: Array<{ price?: { lookup_key?: string; product?: string } }>;
  };
  current_period_end?: number;
  metadata?: Record<string, string>;
}

export interface StripeInvoice {
  customer?: string;
  subscription?: string;
  period_end?: number;
}

// ─── Idempotency ────────────────────────────────────────────────────────────

export async function checkIdempotency(
  db: D1Database,
  eventId: string,
): Promise<{ duplicate: boolean }> {
  try {
    const already = await db.prepare(
      "SELECT id FROM webhook_events WHERE id = ? LIMIT 1",
    ).bind(eventId).first<{ id: string }>();

    if (already) return { duplicate: true };

    await db.prepare(
      "INSERT INTO webhook_events (id, processed_at) VALUES (?, ?)",
    ).bind(eventId, Date.now()).run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log.error("Idempotency check failed", { error: msg });
  }
  return { duplicate: false };
}

// ─── Error Logging ──────────────────────────────────────────────────────────

export function logWebhookError(
  db: D1Database,
  ctx: ExecutionContext | undefined,
  eventType: string,
  message: string,
  stack: string | null,
) {
  try {
    const work = db.prepare(
      "INSERT INTO error_logs (service_name, error_code, message, stack_trace, metadata, client_id, severity) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind("stripe-webhook", eventType, message, stack, null, null, "error").run().catch(() => {});
    try { ctx?.waitUntil(work); } catch { /* no ctx in tests */ }
  } catch { /* DB unavailable */ }
}

// ─── Checkout Completed (Subscription) ──────────────────────────────────────

export async function handleCheckoutCompleted(
  db: D1Database,
  event: StripeEvent,
): Promise<void> {
  const session = event.data.object as unknown as StripeSession;

  // Service purchases are handled separately
  if (session.metadata?.type === "service_purchase") {
    await handleServicePurchase(db, session, event);
    return;
  }

  // Blog donations are handled by donation-service
  if (session.metadata?.type === "blog_support") {
    return; // Caller should route to donation-service
  }

  const userId = session.metadata?.userId;
  if (!userId) {
    log.warn("checkout.session.completed without userId in metadata");
    return;
  }

  const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  const now = Date.now();

  const rawTier = session.metadata?.tier;
  const plan = rawTier === "business" || rawTier === "pro" ? rawTier : "pro";

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

  const customerEmail = session.customer_email;
  if (customerEmail && customerEmail.length > 0) {
    await db.prepare(
      "UPDATE users SET email = ?, updated_at = ? WHERE id = ? AND email != ?",
    ).bind(customerEmail, now, userId, customerEmail).run();
  }
}

// ─── Service Purchase ───────────────────────────────────────────────────────

async function handleServicePurchase(
  db: D1Database,
  session: StripeSession,
  event: StripeEvent,
): Promise<void> {
  const serviceName = session.metadata?.service;
  const sessionId = (event.data.object as Record<string, unknown>).id as string | undefined;
  const customerEmail = session.customer_email ?? (session.metadata?.email || null);
  const metaUserId = session.metadata?.userId ?? null;

  if (serviceName && sessionId) {
    await db.prepare(
      `INSERT INTO service_purchases (id, service, stripe_session_id, user_id, email, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'completed', ?)`,
    ).bind(crypto.randomUUID(), serviceName, sessionId, metaUserId, customerEmail, Date.now()).run();
  }
}

// ─── Subscription Updated ───────────────────────────────────────────────────

export async function handleSubscriptionUpdated(
  db: D1Database,
  event: StripeEvent,
): Promise<void> {
  const sub = event.data.object as unknown as StripeSubscription;
  const tier = mapStripePlanToTier(sub);
  const status = sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : sub.status;
  const periodEnd = sub.current_period_end ? sub.current_period_end * 1000 : null;
  const now = Date.now();

  await db.prepare(
    `UPDATE subscriptions SET status = ?, plan = ?, current_period_end = ?, updated_at = ?
     WHERE stripe_subscription_id = ?`,
  ).bind(status, tier, periodEnd, now, sub.id).run();
}

// ─── Subscription Deleted ───────────────────────────────────────────────────

export async function handleSubscriptionDeleted(
  db: D1Database,
  event: StripeEvent,
): Promise<void> {
  const sub = event.data.object as unknown as StripeSubscription;
  const now = Date.now();
  await db.prepare(
    `UPDATE subscriptions SET status = 'canceled', plan = 'free', updated_at = ?
     WHERE stripe_subscription_id = ?`,
  ).bind(now, sub.id).run();
}

// ─── Invoice Paid ───────────────────────────────────────────────────────────

export async function handleInvoicePaid(
  db: D1Database,
  event: StripeEvent,
): Promise<void> {
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
}

// ─── Invoice Payment Failed ─────────────────────────────────────────────────

export async function handleInvoicePaymentFailed(
  db: D1Database,
  event: StripeEvent,
): Promise<void> {
  const invoice = event.data.object as Record<string, unknown>;
  const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (subId) {
    const now = Date.now();
    await db.prepare(
      `UPDATE subscriptions SET status = 'past_due', updated_at = ?
       WHERE stripe_subscription_id = ?`,
    ).bind(now, subId).run();
  }
}
