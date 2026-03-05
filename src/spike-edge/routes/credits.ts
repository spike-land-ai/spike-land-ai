/**
 * Credit Endpoints
 *
 * GET  /api/credits/balance   — return current balance, daily limit, tier, usage today
 * POST /api/credits/purchase  — create Stripe checkout session for credit packs
 *
 * Credit packs:
 *   $5  → 500 credits   (price lookup key: credits_500)
 *   $20 → 2500 credits  (price lookup key: credits_2500)
 *   $50 → 7500 credits  (price lookup key: credits_7500)
 */

import { Hono } from "hono";
import type { Env } from "../env.js";
import { getBalance, getUsedToday } from "../lib/credit-service.js";
import { resolveEffectiveTier } from "../lib/tier-service.js";
import { createLogger } from "@spike-land-ai/shared";
import { stripePost, stripeGet } from "../lib/stripe-client.js";
import { CREDIT_PACKS } from "../lib/pricing.js";

const log = createLogger("spike-edge");

const credits = new Hono<{ Bindings: Env }>();

credits.get("/api/credits/balance", async (c) => {
  const userId = c.get("userId" as never) as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const [{ balance, dailyLimit }, tier, usedToday] = await Promise.all([
    getBalance(c.env.DB, userId),
    resolveEffectiveTier(c.env.DB, userId),
    getUsedToday(c.env.DB, userId),
  ]);

  return c.json({ balance, dailyLimit, tier, usedToday });
});

credits.post("/api/credits/purchase", async (c) => {
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return c.json({ error: "Stripe not configured" }, 503);
  }

  const userId = c.get("userId" as never) as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: { pack?: number };
  try {
    body = (await c.req.json()) as { pack?: number };
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const pack = CREDIT_PACKS.find((p) => p.credits === body.pack);
  if (!pack) {
    const validPacks = CREDIT_PACKS.map((p) => p.credits);
    return c.json(
      { error: `Invalid pack. Must be one of: ${validPacks.join(", ")}` },
      400,
    );
  }

  // Look up Stripe price by lookup key
  const priceRes = await stripeGet(stripeKey, "/v1/prices", {
    "lookup_keys[]": pack.lookupKey,
    active: "true",
    limit: "1",
  });

  if (!priceRes.ok) {
    log.error("Failed to look up price", { data: String(priceRes.data) });
    return c.json({ error: "Failed to look up price" }, 502);
  }

  const prices = priceRes.data.data as Array<{ id: string }> | undefined;
  if (!prices || prices.length === 0) {
    return c.json({ error: `No price found for ${pack.credits} credit pack` }, 404);
  }

  const priceId = prices[0]!.id;

  // Create one-time checkout session
  const sessionRes = await stripePost(stripeKey, "/v1/checkout/sessions", {
    mode: "payment",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: "https://spike.land/settings?tab=billing&credits_purchased=1",
    cancel_url: "https://spike.land/settings?tab=billing",
    client_reference_id: userId,
    "metadata[userId]": userId,
    "metadata[credits]": String(pack.credits),
    "metadata[type]": "credit_purchase",
  });

  if (!sessionRes.ok) {
    log.error("Failed to create credits checkout session", { data: String(sessionRes.data) });
    return c.json({ error: "Failed to create checkout session" }, 502);
  }

  const sessionUrl = sessionRes.data.url as string | undefined;
  if (!sessionUrl) {
    return c.json({ error: "No checkout URL returned" }, 502);
  }

  return c.json({ url: sessionUrl });
});

export { credits };
