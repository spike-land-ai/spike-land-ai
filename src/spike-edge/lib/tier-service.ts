/**
 * Tier Resolution service.
 * Determines effective user tier from multiple sources (raw D1 SQL, no ORM).
 *
 * Priority:
 * 1. Active Stripe subscription → plan tier
 * 2. Active access_grants (expires_at > now) → highest grant tier
 * 3. BYOK key stored → "pro"
 * 4. ELO-based tier via eloToTier()
 */

import { eloToTier } from "./elo.js";

// ─── Stripe Plan Mapping ───────────────────────────────────────────────────

interface StripeSubscriptionForTier {
  items?: {
    data?: Array<{ price?: { lookup_key?: string; product?: string } }>;
  };
  metadata?: Record<string, string>;
}

export function mapStripePlanToTier(subscription: StripeSubscriptionForTier): string {
  const lookupKey = subscription.items?.data?.[0]?.price?.lookup_key;
  if (lookupKey?.includes("business")) return "business";
  if (lookupKey?.includes("pro")) return "pro";
  const metaTier = subscription.metadata?.tier;
  if (metaTier === "business" || metaTier === "pro") return metaTier;
  return "pro"; // default paid tier
}

type Tier = "free" | "pro" | "business";

export async function resolveEffectiveTier(
  db: D1Database,
  userId: string,
): Promise<Tier> {
  const now = Date.now();

  // 1. Check active Stripe subscription
  const sub = await db
    .prepare(
      "SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active' AND (current_period_end IS NULL OR current_period_end > ?) LIMIT 1",
    )
    .bind(userId, now)
    .first<{ plan: string }>();

  if (sub) {
    const plan = sub.plan as Tier;
    if (plan === "pro" || plan === "business") return plan;
  }

  // 2. Check active access grants (highest tier wins)
  const grant = await db
    .prepare(
      "SELECT tier FROM access_grants WHERE user_id = ? AND expires_at > ? ORDER BY CASE tier WHEN 'business' THEN 2 WHEN 'pro' THEN 1 ELSE 0 END DESC LIMIT 1",
    )
    .bind(userId, now)
    .first<{ tier: string }>();

  if (grant) {
    const grantTier = grant.tier as Tier;
    if (grantTier === "pro" || grantTier === "business") return grantTier;
  }

  // 3. Check BYOK key stored
  const byok = await db
    .prepare(
      "SELECT 1 FROM user_api_key_vault WHERE user_id = ? LIMIT 1",
    )
    .bind(userId)
    .first();

  if (byok) return "pro";

  // 4. Fall back to ELO-based tier
  const elo = await db
    .prepare("SELECT elo FROM user_elo WHERE user_id = ?")
    .bind(userId)
    .first<{ elo: number }>();

  return elo ? eloToTier(elo.elo) : "free";
}
