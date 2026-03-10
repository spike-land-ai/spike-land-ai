/**
 * Stripe Checkout Session Endpoint
 *
 * POST /api/checkout — creates a Stripe Checkout session for subscription.
 * Requires auth. Uses Stripe REST API directly (no SDK).
 */

import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import { createLogger } from "@spike-land-ai/shared";
import { stripePost, stripeGet } from "../../core-logic/stripe-client.js";
import { VALID_LOOKUP_KEYS, SERVICE_PRODUCTS } from "../../core-logic/pricing.js";

const log = createLogger("spike-edge");

const checkout = new Hono<{ Bindings: Env; Variables: Variables }>();

checkout.post("/api/checkout", async (c) => {
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return c.json({ error: "Stripe not configured" }, 503);
  }

  // userId is set by auth middleware via c.set("userId", ...)
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: { tier?: string; lookup_key?: string };
  try {
    body = (await c.req.json()) as { tier?: string; lookup_key?: string };
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const tier = body.tier;
  if (tier !== "pro" && tier !== "business") {
    return c.json({ error: "Invalid tier. Must be 'pro' or 'business'." }, 400);
  }

  // Use the provided lookup_key if valid, otherwise fall back to monthly
  const requestedKey = body.lookup_key;
  const lookupKey =
    requestedKey && VALID_LOOKUP_KEYS.has(requestedKey) && requestedKey.startsWith(tier)
      ? requestedKey
      : `${tier}_monthly`;

  // Look up price by lookup_key
  const priceRes = await stripeGet(stripeKey, "/v1/prices", {
    "lookup_keys[]": lookupKey,
    active: "true",
    limit: "1",
  });

  if (!priceRes.ok) {
    log.error("Failed to look up price", { data: String(priceRes.data) });
    return c.json({ error: "Failed to look up price" }, 502);
  }

  const prices = priceRes.data.data as Array<{ id: string }> | undefined;
  if (!prices || prices.length === 0) {
    return c.json({ error: `No price found for tier '${tier}'` }, 404);
  }

  const priceId = prices[0]!.id;

  // Create checkout session
  const idempotencyKey = `${userId}-checkout-${tier}-${Math.floor(Date.now() / 60000)}`;
  const sessionRes = await stripePost(
    stripeKey,
    "/v1/checkout/sessions",
    {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      allow_promotion_codes: "true",
      "subscription_data[trial_period_days]": "14",
      success_url: "https://spike.land/settings?tab=billing&success=1",
      cancel_url: "https://spike.land/pricing",
      client_reference_id: userId,
      "metadata[userId]": userId,
      "metadata[tier]": tier,
    },
    idempotencyKey,
  );

  if (!sessionRes.ok) {
    log.error("Failed to create checkout session", { data: String(sessionRes.data) });
    return c.json({ error: "Failed to create checkout session" }, 502);
  }

  const sessionUrl = sessionRes.data.url as string | undefined;
  if (!sessionUrl) {
    return c.json({ error: "No checkout URL returned" }, 502);
  }

  return c.json({ url: sessionUrl });
});

// ─── One-time Service Payments ──────────────────────────────────────────────

checkout.post("/api/checkout/service", async (c) => {
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return c.json({ error: "Stripe not configured" }, 503);
  }

  let body: { service?: string; email?: string };
  try {
    body = (await c.req.json()) as { service?: string; email?: string };
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const service = body.service;
  if (!service || !SERVICE_PRODUCTS[service]) {
    const validServices = Object.keys(SERVICE_PRODUCTS);
    return c.json({ error: `Invalid service. Must be one of: ${validServices.join(", ")}` }, 400);
  }

  const product = SERVICE_PRODUCTS[service]!;

  // Look up price by lookup key
  const priceRes = await stripeGet(stripeKey, "/v1/prices", {
    "lookup_keys[]": product.lookupKey,
    active: "true",
    limit: "1",
  });

  if (!priceRes.ok) {
    log.error("Failed to look up service price", { data: String(priceRes.data) });
    return c.json({ error: "Failed to look up price" }, 502);
  }

  const prices = priceRes.data.data as Array<{ id: string }> | undefined;
  if (!prices || prices.length === 0) {
    return c.json({ error: `No price found for service '${service}'` }, 404);
  }

  const priceId = prices[0]!.id;

  // Build checkout session params
  const sessionParams: Record<string, string> = {
    mode: "payment",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `https://spike.land${product.successPath}`,
    cancel_url: `https://spike.land${product.successPath.split("?")[0]!}`,
    "metadata[type]": "service_purchase",
    "metadata[service]": service,
  };

  // Attach userId if authenticated, otherwise allow guest checkout
  const userId = c.get("userId") as string | undefined;
  if (userId) {
    sessionParams.client_reference_id = userId;
    sessionParams["metadata[userId]"] = userId;
  }

  // Allow pre-filling email for guest checkout.
  // Basic validation: must be a non-empty string containing exactly one '@'
  // and a dot after it. Stripe validates fully server-side; this prevents
  // excessively long or malformed strings reaching the Stripe API (OWASP A03).
  const EMAIL_RE = /^[^\s@]{1,254}@[^\s@]+\.[^\s@]{2,}$/;
  if (body.email && typeof body.email === "string" && EMAIL_RE.test(body.email)) {
    sessionParams.customer_email = body.email.slice(0, 254);
  }

  const sessionRes = await stripePost(stripeKey, "/v1/checkout/sessions", sessionParams);

  if (!sessionRes.ok) {
    log.error("Failed to create service checkout session", { data: String(sessionRes.data) });
    return c.json({ error: "Failed to create checkout session" }, 502);
  }

  const sessionUrl = sessionRes.data.url as string | undefined;
  if (!sessionUrl) {
    return c.json({ error: "No checkout URL returned" }, 502);
  }

  return c.json({ url: sessionUrl });
});

export { checkout };
