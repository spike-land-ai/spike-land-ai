/**
 * Blog Support Routes
 *
 * POST /api/support/fistbump       — Record a fist bump (no auth, 1/slug/client)
 * GET  /api/support/engagement/:slug — Get engagement stats (cached 60s)
 * POST /api/support/donate          — Create Stripe checkout for one-time donation
 */

import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";
import {
  createLogger,
  formatSupportAmount,
  snapSupportAmount,
  SUPPORT_AMOUNT_MAX,
  SUPPORT_AMOUNT_MIN,
  SUPPORT_CURRENCY_CODE,
  SUPPORT_CURRENCY_SYMBOL,
} from "@spike-land-ai/shared";

const log = createLogger("spike-edge");

const support = new Hono<{ Bindings: Env }>();

// ─── Fist Bump ──────────────────────────────────────────────────────────────

support.post("/api/support/fistbump", async (c) => {
  let body: { slug?: string; clientId?: string };
  try {
    body = (await c.req.json()) as { slug?: string; clientId?: string };
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const slug = body.slug;
  const clientId = body.clientId;
  if (!slug || typeof slug !== "string" || !clientId || typeof clientId !== "string") {
    return c.json({ error: "slug and clientId are required" }, 400);
  }

  // Sanitize inputs
  if (slug.length > 200 || clientId.length > 100) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const db = c.env.DB;
  const id = crypto.randomUUID();
  const now = Date.now();

  try {
    await db
      .prepare(
        "INSERT INTO blog_engagement (id, slug, client_id, type, created_at) VALUES (?, ?, ?, 'fistbump', ?)",
      )
      .bind(id, slug, clientId, now)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    // UNIQUE constraint = already bumped
    if (msg.includes("UNIQUE")) {
      const count = await db
        .prepare("SELECT COUNT(*) as cnt FROM blog_engagement WHERE slug = ? AND type = 'fistbump'")
        .bind(slug)
        .first<{ cnt: number }>();
      return c.json({ count: count?.cnt ?? 0, alreadyBumped: true });
    }
    log.error("fistbump error", { error: msg });
    return c.json({ error: "Failed to record fist bump" }, 500);
  }

  const count = await db
    .prepare("SELECT COUNT(*) as cnt FROM blog_engagement WHERE slug = ? AND type = 'fistbump'")
    .bind(slug)
    .first<{ cnt: number }>();

  return c.json({ count: count?.cnt ?? 1 });
});

// ─── Engagement Stats ───────────────────────────────────────────────────────

support.get("/api/support/engagement/:slug", async (c) => {
  const slug = c.req.param("slug");
  if (!slug || slug.length > 200) {
    return c.json({ error: "Invalid slug" }, 400);
  }

  const db = c.env.DB;

  try {
    const [fistBumps, donations] = await Promise.all([
      db
        .prepare("SELECT COUNT(*) as cnt FROM blog_engagement WHERE slug = ? AND type = 'fistbump'")
        .bind(slug)
        .first<{ cnt: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) as cnt FROM support_donations WHERE slug = ? AND status = 'completed'",
        )
        .bind(slug)
        .first<{ cnt: number }>(),
    ]);

    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return c.json({
      fistBumps: fistBumps?.cnt ?? 0,
      supporters: donations?.cnt ?? 0,
    });
  } catch (error) {
    console.error("Support engagement error:", error);
    return c.json({ fistBumps: 0, supporters: 0 });
  }
});

// ─── Donate (Stripe Checkout) ───────────────────────────────────────────────

support.post("/api/support/donate", async (c) => {
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return c.json({ error: "Stripe not configured" }, 503);
  }

  let body: { slug?: string; amount?: number; clientId?: string };
  try {
    body = (await c.req.json()) as { slug?: string; amount?: number; clientId?: string };
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const slug = body.slug;
  const rawAmount = body.amount;
  const clientId = typeof body.clientId === "string" ? body.clientId.slice(0, 100) : "";
  const amount = typeof rawAmount === "number" ? snapSupportAmount(rawAmount) : null;

  if (!slug || typeof slug !== "string" || slug.length > 200) {
    return c.json({ error: "Invalid slug" }, 400);
  }
  if (amount === null || amount < SUPPORT_AMOUNT_MIN || amount > SUPPORT_AMOUNT_MAX) {
    return c.json(
      {
        error: `Amount must be between ${SUPPORT_CURRENCY_SYMBOL}${SUPPORT_AMOUNT_MIN} and ${SUPPORT_CURRENCY_SYMBOL}${SUPPORT_AMOUNT_MAX}`,
      },
      400,
    );
  }

  const amountCents = Math.round(amount * 100);

  // Create one-time Stripe checkout session using REST API
  const params = new URLSearchParams({
    mode: "payment",
    submit_type: "donate",
    "line_items[0][price_data][currency]": SUPPORT_CURRENCY_CODE,
    "line_items[0][price_data][unit_amount]": amountCents.toString(),
    "line_items[0][price_data][product_data][name]": `Support spike.land — ${SUPPORT_CURRENCY_SYMBOL}${formatSupportAmount(amount)}`,
    "line_items[0][price_data][product_data][description]":
      "One-time support for independent open-source development",
    "line_items[0][quantity]": "1",
    success_url: `https://spike.land/blog/${encodeURIComponent(slug)}?supported=1`,
    cancel_url: `https://spike.land/blog/${encodeURIComponent(slug)}`,
    "metadata[type]": "blog_support",
    "metadata[slug]": slug,
    "metadata[amount]": amount.toString(),
    "metadata[client_id]": clientId,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: params.toString(),
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    log.error("Stripe checkout error", { error: String(data) });
    return c.json({ error: "Failed to create checkout session" }, 502);
  }

  // Record pending donation
  const db = c.env.DB;
  const donationId = crypto.randomUUID();
  const sessionId = data.id as string;
  try {
    await db
      .prepare(
        "INSERT INTO support_donations (id, slug, amount_cents, stripe_session_id, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
      )
      .bind(donationId, slug, amountCents, sessionId, Date.now())
      .run();
  } catch (err) {
    log.error("donation record error", { error: err instanceof Error ? err.message : String(err) });
  }

  return c.json({ url: data.url as string });
});

// ─── Migration Checkout (Stripe) ────────────────────────────────────────────

const MIGRATION_TIERS = {
  blog: {
    amountCents: 42000,
    currency: "usd",
    label: "Blog Post",
    description: "Detailed migration blog post covering 8 Next.js projects",
  },
  script: {
    amountCents: 100000,
    currency: "gbp",
    label: "CLI Script",
    description: "Open-source CLI migration script (Next.js → TanStack Start)",
  },
  mcp: {
    amountCents: 1000000,
    currency: "usd",
    label: "MCP Server",
    description: "Production MCP server for automated Next.js migration PRs",
  },
} as const;

type MigrationTier = keyof typeof MIGRATION_TIERS;

support.post("/api/support/migration-checkout", async (c) => {
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return c.json({ error: "Stripe not configured" }, 503);
  }

  let body: { tier?: string; clientId?: string };
  try {
    body = (await c.req.json()) as { tier?: string; clientId?: string };
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const { tier, clientId } = body;

  if (!tier || !Object.hasOwn(MIGRATION_TIERS, tier)) {
    return c.json({ error: "tier must be one of: blog, script, mcp" }, 400);
  }

  const safeClientId = typeof clientId === "string" ? clientId.slice(0, 100) : "";
  const config = MIGRATION_TIERS[tier as MigrationTier];
  const slug = `migration-${tier}`;

  const params = new URLSearchParams({
    mode: "payment",
    submit_type: "pay",
    "line_items[0][price_data][currency]": config.currency,
    "line_items[0][price_data][unit_amount]": config.amountCents.toString(),
    "line_items[0][price_data][product_data][name]": `Next.js Migration Service — ${config.label}`,
    "line_items[0][price_data][product_data][description]": config.description,
    "line_items[0][quantity]": "1",
    success_url: `https://spike.land/migrate?success=${encodeURIComponent(tier)}`,
    cancel_url: "https://spike.land/migrate",
    "metadata[type]": "migration_service",
    "metadata[tier]": tier,
    "metadata[client_id]": safeClientId,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: params.toString(),
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    log.error("Stripe migration checkout error", { error: String(data) });
    return c.json({ error: "Failed to create checkout session" }, 502);
  }

  // Record pending migration purchase
  const db = c.env.DB;
  const donationId = crypto.randomUUID();
  const sessionId = data.id as string;
  try {
    await db
      .prepare(
        "INSERT INTO support_donations (id, slug, amount_cents, stripe_session_id, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
      )
      .bind(donationId, slug, config.amountCents, sessionId, Date.now())
      .run();
  } catch (err) {
    log.error("migration donation record error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return c.json({ url: data.url as string });
});

export { support };
