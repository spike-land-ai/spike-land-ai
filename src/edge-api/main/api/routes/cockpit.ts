/**
 * Cockpit Metrics Endpoint
 *
 * GET /api/cockpit/metrics — admin-only metrics dashboard.
 * Access restricted to admin emails.
 * Requires auth.
 */

import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";

const cockpit = new Hono<{ Bindings: Env; Variables: Variables }>();

const ADMIN_EMAILS = new Set(["zoltan.erdos@spike.land", "zolika84@gmail.com"]);

interface CountRow {
  count: number;
}

interface ActiveSubsRow {
  count: number;
}

interface MrrRow {
  mrr: number | null;
}

interface RecentSignupRow {
  id: string;
  email: string;
  created_at: string;
}

interface ServiceRevenueRow {
  total: number | null;
}

interface ServicePurchaseRow {
  service: string;
  email: string | null;
  status: string;
  created_at: number;
}

cockpit.get("/api/cockpit/metrics", async (c) => {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Resolve userId → email and verify admin access
  const userRow = await c.env.DB.prepare(`SELECT email FROM users WHERE id = ? LIMIT 1`)
    .bind(userId)
    .first<{ email: string }>();

  if (!userRow || !ADMIN_EMAILS.has(userRow.email)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Wrap service_purchases queries in try/catch since table may not exist yet
  let serviceRevenueTotal = 0;
  let servicePurchases: ServicePurchaseRow[] = [];
  const serviceRevenueQuery = c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM service_purchases WHERE status = 'completed'`,
  )
    .first<ServiceRevenueRow>()
    .catch((): ServiceRevenueRow | null => null);

  const servicePurchasesQuery = c.env.DB.prepare(
    `SELECT service, email, status, created_at FROM service_purchases ORDER BY created_at DESC LIMIT 20`,
  )
    .all<ServicePurchaseRow>()
    .catch((): { results: ServicePurchaseRow[] } => ({ results: [] }));

  const [
    userCountRow,
    activeSubsRow,
    toolCountRow,
    mrrRow,
    recentSignupsResult,
    serviceRevenueRow,
    servicePurchasesResult,
  ] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM users`).first<CountRow>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'`,
    ).first<ActiveSubsRow>(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM registeredTools`).first<CountRow>(),
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(
          CASE plan
            WHEN 'pro'      THEN 29
            WHEN 'business' THEN 99
            ELSE 0
          END
        ), 0) as mrr
         FROM subscriptions WHERE status = 'active'`,
    ).first<MrrRow>(),
    c.env.DB.prepare(
      `SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 10`,
    ).all<RecentSignupRow>(),
    serviceRevenueQuery,
    servicePurchasesQuery,
  ]);

  serviceRevenueTotal = serviceRevenueRow?.total ?? 0;
  servicePurchases = servicePurchasesResult.results ?? [];

  return c.json({
    userCount: userCountRow?.count ?? 0,
    activeSubscriptions: activeSubsRow?.count ?? 0,
    toolCount: toolCountRow?.count ?? 0,
    mrr: mrrRow?.mrr ?? 0,
    recentSignups: recentSignupsResult.results,
    servicePurchases: serviceRevenueTotal,
    recentServicePurchases: servicePurchases,
  });
});

export { cockpit };
