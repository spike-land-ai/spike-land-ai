/**
 * Stripe Webhook Handler — thin HTTP adapter.
 *
 * Parses request, verifies signature, dispatches to service functions.
 */

import { Hono } from "hono";
import type { Env } from "../env.js";
import { createLogger } from "@spike-land-ai/shared";
import { verifyStripeSignature } from "../lib/stripe-signature.js";
import {
  checkIdempotency,
  logWebhookError,
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  type StripeEvent,
  type StripeSession,
} from "../lib/subscription-service.js";
import { handleBlogDonation } from "../lib/donation-service.js";

const log = createLogger("spike-edge");

const stripeWebhook = new Hono<{ Bindings: Env }>();

stripeWebhook.post("/stripe/webhook", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    log.error("STRIPE_WEBHOOK_SECRET not configured");
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

  // Idempotency check
  const { duplicate } = await checkIdempotency(db, event.id);
  if (duplicate) {
    return c.json({ received: true, duplicate: true });
  }

  // Dispatch to service handlers
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as unknown as StripeSession;
        if (session.metadata?.type === "blog_support") {
          await handleBlogDonation(db, event);
        } else {
          await handleCheckoutCompleted(db, event);
        }
        break;
      }
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(db, event);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(db, event);
        break;
      case "invoice.paid":
        await handleInvoicePaid(db, event);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(db, event);
        break;
      default:
        break;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    log.error(`Error handling ${event.type}`, { error: msg });
    logWebhookError(db, c.executionCtx, event.type, msg, error instanceof Error ? error.stack ?? null : null);
  }

  return c.json({ received: true });
});

export { stripeWebhook };
