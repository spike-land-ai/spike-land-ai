/**
 * Stripe Checkout Session Endpoint
 *
 * POST /api/checkout — creates a Stripe Checkout session for subscription.
 * Requires auth. Uses Stripe REST API directly (no SDK).
 */

import { Hono } from "hono";
import type { Env } from "../env.js";
import { createLogger } from "@spike-land-ai/shared";

const log = createLogger("spike-edge");

const checkout = new Hono<{ Bindings: Env }>();

const LOOKUP_KEYS: Record<string, string> = {
  pro: "pro_monthly",
  business: "business_monthly",
};

async function stripePost(
  key: string,
  path: string,
  body: Record<string, string>,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, data };
}

async function stripeGet(
  key: string,
  path: string,
  params: Record<string, string>,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stripe.com${path}?${qs}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, data };
}

checkout.post("/api/checkout", async (c) => {
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return c.json({ error: "Stripe not configured" }, 503);
  }

  // userId is set by auth middleware via c.set("userId", ...)
  const userId = c.get("userId" as never) as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: { tier?: string };
  try {
    body = (await c.req.json()) as { tier?: string };
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const tier = body.tier;
  if (tier !== "pro" && tier !== "business") {
    return c.json({ error: "Invalid tier. Must be 'pro' or 'business'." }, 400);
  }

  const lookupKey = LOOKUP_KEYS[tier] as string;

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
  const sessionRes = await stripePost(stripeKey, "/v1/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: "https://spike.land/settings?tab=billing&success=1",
    cancel_url: "https://spike.land/pricing",
    client_reference_id: userId,
    "metadata[userId]": userId,
    "metadata[tier]": tier,
  });

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

export { checkout };
