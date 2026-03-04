/**
 * A/B Experiment Routes
 *
 * POST /api/experiments/assign    — Hash-based variant assignment
 * POST /api/experiments/track     — Batch widget events (rate limited)
 * GET  /api/experiments/active    — Active experiments + configs (cached)
 * GET  /api/experiments/:id/metrics — Per-variant conversion rates
 * POST /api/experiments/:id/evaluate — Bayesian auto-graduate
 * GET  /api/experiments/dashboard — All experiments overview
 */

import { Hono } from "hono";
import type { Env } from "../env.js";

const experiments = new Hono<{ Bindings: Env }>();

// ─── FNV-1a hash ────────────────────────────────────────────────────────────

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

function assignVariant(
  clientId: string,
  experimentId: string,
  variants: Array<{ id: string; weight: number }>,
): string {
  const bucket = fnv1a(clientId + experimentId) % 10000;
  let cumulative = 0;
  for (const v of variants) {
    cumulative += v.weight * 100; // weight 25 → 2500 out of 10000
    if (bucket < cumulative) return v.id;
  }
  return variants[variants.length - 1]?.id ?? "control";
}

// ─── Rate limiting (in-memory, same pattern as analytics.ts) ────────────────

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExperimentRow {
  id: string;
  name: string;
  dimension: string;
  variants: string;
  status: string;
  winner_variant_id: string | null;
  traffic_pct: number;
  created_at: number;
  updated_at: number;
}

interface VariantDef {
  id: string;
  config: Record<string, unknown>;
  weight: number;
}

const VALID_EVENT_TYPES = new Set([
  "widget_impression",
  "slider_start",
  "slider_change",
  "slider_final",
  "fistbump_click",
  "donate_click",
  "custom_toggle",
  "custom_value",
  "share_click",
  "visibility_time",
  "checkout_started",
  "checkout_completed",
  "thankyou_viewed",
]);

// ─── POST /api/experiments/assign ───────────────────────────────────────────

experiments.post("/api/experiments/assign", async (c) => {
  const body = await c.req.json<{ clientId?: string }>().catch(() => ({ clientId: undefined }));
  const clientId = body.clientId;

  if (!clientId || typeof clientId !== "string" || clientId.length > 100) {
    return c.json({ error: "clientId is required" }, 400);
  }

  const db = c.env.DB;
  const rows = await db
    .prepare("SELECT * FROM experiments WHERE status = 'active'")
    .all<ExperimentRow>();

  const activeExperiments = rows.results ?? [];
  const assignments: Record<string, { variantId: string; config: Record<string, unknown> }> = {};

  for (const exp of activeExperiments) {
    const variants: VariantDef[] = JSON.parse(exp.variants);

    // Check existing assignment
    const existing = await db
      .prepare(
        "SELECT variant_id FROM experiment_assignments WHERE experiment_id = ? AND client_id = ?",
      )
      .bind(exp.id, clientId)
      .first<{ variant_id: string }>();

    let variantId: string;
    if (existing) {
      variantId = existing.variant_id;
    } else {
      variantId = assignVariant(clientId, exp.id, variants);
      const id = crypto.randomUUID();
      const now = Date.now();
      await db
        .prepare(
          "INSERT INTO experiment_assignments (id, experiment_id, client_id, variant_id, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(id, exp.id, clientId, variantId, now)
        .run();
    }

    const variant = variants.find((v) => v.id === variantId);
    assignments[exp.id] = {
      variantId,
      config: variant?.config ?? {},
    };
  }

  return c.json({ assignments });
});

// ─── POST /api/experiments/track ────────────────────────────────────────────

experiments.post("/api/experiments/track", async (c) => {
  const clientIp = c.req.header("cf-connecting-ip") ?? "unknown";

  if (isRateLimited(clientIp)) {
    return c.json({ error: "Rate limited", retryAfter: 60 }, 429);
  }

  const body = await c.req
    .json<{
      events?: Array<{
        clientId?: string;
        slug?: string;
        eventType?: string;
        eventData?: Record<string, unknown>;
        experimentId?: string;
        variantId?: string;
      }>;
    }>()
    .catch(() => ({ events: undefined }));

  const events = body.events;
  if (!Array.isArray(events) || events.length === 0) {
    return c.json({ error: "events array required" }, 400);
  }

  // Cap batch size
  const batch = events.slice(0, 50);
  const db = c.env.DB;
  const now = Date.now();

  const insertStmt = db.prepare(
    "INSERT INTO widget_events (id, client_id, slug, event_type, event_data, experiment_id, variant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const stmts: D1PreparedStatement[] = [];
  const metricsUpdates: Array<{
    experimentId: string;
    variantId: string;
    metricName: string;
    value: number;
  }> = [];

  for (const event of batch) {
    if (
      !event.clientId ||
      !event.slug ||
      !event.eventType ||
      !VALID_EVENT_TYPES.has(event.eventType)
    ) {
      continue;
    }

    stmts.push(
      insertStmt.bind(
        crypto.randomUUID(),
        event.clientId,
        event.slug,
        event.eventType,
        event.eventData ? JSON.stringify(event.eventData) : null,
        event.experimentId ?? null,
        event.variantId ?? null,
        now,
      ),
    );

    // Increment materialized metrics
    if (event.experimentId && event.variantId) {
      if (event.eventType === "widget_impression") {
        metricsUpdates.push({
          experimentId: event.experimentId,
          variantId: event.variantId,
          metricName: "impressions",
          value: 1,
        });
      } else if (event.eventType === "donate_click") {
        metricsUpdates.push({
          experimentId: event.experimentId,
          variantId: event.variantId,
          metricName: "donations",
          value: 1,
        });
      } else if (event.eventType === "fistbump_click") {
        metricsUpdates.push({
          experimentId: event.experimentId,
          variantId: event.variantId,
          metricName: "fistbumps",
          value: 1,
        });
      } else if (event.eventType === "checkout_completed") {
        const amount =
          (event.eventData as Record<string, unknown> | undefined)?.amount;
        if (typeof amount === "number") {
          metricsUpdates.push({
            experimentId: event.experimentId,
            variantId: event.variantId,
            metricName: "revenue_cents",
            value: Math.round(amount * 100),
          });
        }
      }
    }
  }

  // Upsert metrics
  for (const m of metricsUpdates) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO experiment_metrics (id, experiment_id, variant_id, metric_name, metric_value, sample_size, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?)
           ON CONFLICT (experiment_id, variant_id, metric_name)
           DO UPDATE SET metric_value = metric_value + ?, sample_size = sample_size + 1, updated_at = ?`,
        )
        .bind(
          crypto.randomUUID(),
          m.experimentId,
          m.variantId,
          m.metricName,
          m.value,
          now,
          m.value,
          now,
        ),
    );
  }

  if (stmts.length > 0) {
    const work = db.batch(stmts);
    try {
      c.executionCtx.waitUntil(work);
    } catch {
      await work;
    }
  }

  return c.json({ accepted: stmts.length });
});

// ─── GET /api/experiments/active ────────────────────────────────────────────

experiments.get("/api/experiments/active", async (c) => {
  const db = c.env.DB;
  const rows = await db
    .prepare("SELECT * FROM experiments WHERE status = 'active'")
    .all<ExperimentRow>();

  const result = (rows.results ?? []).map((exp) => ({
    id: exp.id,
    name: exp.name,
    dimension: exp.dimension,
    variants: JSON.parse(exp.variants) as VariantDef[],
    trafficPct: exp.traffic_pct,
  }));

  c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  return c.json({ experiments: result });
});

// ─── GET /api/experiments/:id/metrics ───────────────────────────────────────

experiments.get("/api/experiments/:id/metrics", async (c) => {
  const id = c.req.param("id");
  const db = c.env.DB;

  const [expRow, metricsRows] = await Promise.all([
    db.prepare("SELECT * FROM experiments WHERE id = ?").bind(id).first<ExperimentRow>(),
    db
      .prepare(
        "SELECT variant_id, metric_name, metric_value, sample_size FROM experiment_metrics WHERE experiment_id = ?",
      )
      .bind(id)
      .all<{
        variant_id: string;
        metric_name: string;
        metric_value: number;
        sample_size: number;
      }>(),
  ]);

  if (!expRow) {
    return c.json({ error: "Experiment not found" }, 404);
  }

  const variants: VariantDef[] = JSON.parse(expRow.variants);
  const metrics = metricsRows.results ?? [];

  // Group metrics by variant
  const byVariant: Record<
    string,
    Record<string, { value: number; sampleSize: number }>
  > = {};
  for (const m of metrics) {
    if (!byVariant[m.variant_id]) byVariant[m.variant_id] = {};
    const variantBucket = byVariant[m.variant_id]!;
    variantBucket[m.metric_name] = {
      value: m.metric_value,
      sampleSize: m.sample_size,
    };
  }

  const variantMetrics = variants.map((v) => {
    const vm = byVariant[v.id] ?? {};
    const impressions = vm.impressions?.value ?? 0;
    const donations = vm.donations?.value ?? 0;
    const revenue = vm.revenue_cents?.value ?? 0;
    const fistbumps = vm.fistbumps?.value ?? 0;

    return {
      variantId: v.id,
      impressions,
      donations,
      revenue,
      fistbumps,
      donateRate: impressions > 0 ? donations / impressions : 0,
      revenuePerImpression: impressions > 0 ? revenue / impressions : 0,
      conversionRate:
        impressions > 0 ? (donations + fistbumps) / impressions : 0,
    };
  });

  return c.json({
    experimentId: id,
    name: expRow.name,
    status: expRow.status,
    winner: expRow.winner_variant_id,
    variants: variantMetrics,
  });
});

// ─── POST /api/experiments/:id/evaluate ─────────────────────────────────────

experiments.post("/api/experiments/:id/evaluate", async (c) => {
  const id = c.req.param("id");
  const db = c.env.DB;

  const exp = await db
    .prepare("SELECT * FROM experiments WHERE id = ?")
    .bind(id)
    .first<ExperimentRow>();
  if (!exp) return c.json({ error: "Experiment not found" }, 404);
  if (exp.status !== "active")
    return c.json({ error: "Experiment not active" }, 400);

  // Check min 48h runtime
  const runtimeMs = Date.now() - exp.created_at;
  const MIN_RUNTIME_MS = 48 * 60 * 60 * 1000;
  if (runtimeMs < MIN_RUNTIME_MS) {
    return c.json({
      ready: false,
      reason: "Minimum 48h runtime not met",
      runtimeHours: Math.round(runtimeMs / 3600000),
    });
  }

  const variants: VariantDef[] = JSON.parse(exp.variants);
  const metricsRows = await db
    .prepare(
      "SELECT variant_id, metric_name, metric_value, sample_size FROM experiment_metrics WHERE experiment_id = ?",
    )
    .bind(id)
    .all<{
      variant_id: string;
      metric_name: string;
      metric_value: number;
      sample_size: number;
    }>();

  const metrics = metricsRows.results ?? [];
  const byVariant: Record<
    string,
    Record<string, { value: number; sampleSize: number }>
  > = {};
  for (const m of metrics) {
    if (!byVariant[m.variant_id]) byVariant[m.variant_id] = {};
    const variantBucket = byVariant[m.variant_id]!;
    variantBucket[m.metric_name] = {
      value: m.metric_value,
      sampleSize: m.sample_size,
    };
  }

  // Check min sample size (500 impressions per variant)
  for (const v of variants) {
    const impressions = byVariant[v.id]?.impressions?.value ?? 0;
    if (impressions < 500) {
      return c.json({
        ready: false,
        reason: `Variant ${v.id} has ${impressions} impressions (need 500)`,
      });
    }
  }

  // Beta-Binomial Bayesian model for primary metric (donation rate)
  // Prior: Beta(1,1), Posterior: Beta(1 + successes, 1 + failures)
  const NUM_DRAWS = 10000;
  const wins = new Map<string, number>();

  // Prepare posterior parameters for each variant
  const posteriors = variants.map((v) => {
    const vm = byVariant[v.id] ?? {};
    const impressions = vm.impressions?.value ?? 0;
    const donations = vm.donations?.value ?? 0;
    const alpha = 1 + donations;
    const beta = 1 + (impressions - donations);
    return { id: v.id, alpha, beta, donateRate: impressions > 0 ? donations / impressions : 0 };
  });

  // Monte Carlo simulation
  for (let draw = 0; draw < NUM_DRAWS; draw++) {
    let bestId = "";
    let bestVal = -1;

    for (const p of posteriors) {
      const sample = sampleBeta(p.alpha, p.beta);
      if (sample > bestVal) {
        bestVal = sample;
        bestId = p.id;
      }
    }

    wins.set(bestId, (wins.get(bestId) ?? 0) + 1);
  }

  const probabilities: Record<string, number> = {};
  for (const v of variants) {
    probabilities[v.id] = (wins.get(v.id) ?? 0) / NUM_DRAWS;
  }

  // Find best variant
  let bestVariant = "";
  let bestProb = 0;
  for (const [vid, prob] of Object.entries(probabilities)) {
    if (prob > bestProb) {
      bestProb = prob;
      bestVariant = vid;
    }
  }

  // Check if winner is ≥10% better than control
  const controlRate =
    posteriors.find((p) => p.id === "control")?.donateRate ?? 0;
  const winnerRate =
    posteriors.find((p) => p.id === bestVariant)?.donateRate ?? 0;
  const improvement =
    controlRate > 0 ? (winnerRate - controlRate) / controlRate : 0;

  const shouldGraduate =
    bestProb > 0.95 && (bestVariant === "control" || improvement >= 0.1);

  if (shouldGraduate) {
    const now = Date.now();
    await db
      .prepare(
        "UPDATE experiments SET status = 'graduated', winner_variant_id = ?, updated_at = ? WHERE id = ?",
      )
      .bind(bestVariant, now, id)
      .run();
  }

  return c.json({
    ready: true,
    graduated: shouldGraduate,
    winner: shouldGraduate ? bestVariant : null,
    probabilities,
    improvement: Math.round(improvement * 1000) / 10,
    controlRate: Math.round(controlRate * 10000) / 100,
    winnerRate: Math.round(winnerRate * 10000) / 100,
  });
});

// ─── GET /api/experiments/dashboard ─────────────────────────────────────────

experiments.get("/api/experiments/dashboard", async (c) => {
  const db = c.env.DB;

  const [allExps, recentRevenue] = await Promise.all([
    db.prepare("SELECT * FROM experiments ORDER BY created_at DESC").all<ExperimentRow>(),
    db
      .prepare(
        `SELECT SUM(metric_value) as total
         FROM experiment_metrics
         WHERE metric_name = 'revenue_cents'
         AND updated_at >= ?`,
      )
      .bind(Date.now() - 24 * 60 * 60 * 1000)
      .first<{ total: number | null }>(),
  ]);

  const exps = (allExps.results ?? []).map((exp) => ({
    id: exp.id,
    name: exp.name,
    dimension: exp.dimension,
    status: exp.status,
    winner: exp.winner_variant_id,
    trafficPct: exp.traffic_pct,
    createdAt: exp.created_at,
  }));

  return c.json({
    experiments: exps,
    revenue24h: (recentRevenue?.total ?? 0) / 100,
  });
});

// ─── Beta distribution sampling (Box-Muller + Gamma) ────────────────────────

function sampleGamma(shape: number): number {
  // Marsaglia and Tsang's method
  if (shape < 1) {
    return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = randn();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function randn(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}

export { experiments };
