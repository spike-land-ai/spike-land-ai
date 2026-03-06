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
import type { Env } from "../../core-logic/env.js";
import { assignVariant, computeConversionRates, evaluateExperiment } from "../../lazy-imports/experiment-engine.js";
import { createRateLimiter } from "../../core-logic/in-memory-rate-limiter.js";

const experiments = new Hono<{ Bindings: Env }>();

const isRateLimited = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

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
  "thankyou_viewed",
]);

// ─── Helpers ────────────────────────────────────────────────────────────────

type MetricRow = {
  variant_id: string;
  metric_name: string;
  metric_value: number;
  sample_size: number;
};

function groupMetricsByVariant(
  metrics: MetricRow[],
): Record<string, Record<string, { value: number; sampleSize: number }>> {
  const byVariant: Record<string, Record<string, { value: number; sampleSize: number }>> = {};
  for (const m of metrics) {
    if (!byVariant[m.variant_id]) byVariant[m.variant_id] = {};
    const variantBucket = byVariant[m.variant_id]!;
    variantBucket[m.metric_name] = {
      value: m.metric_value,
      sampleSize: m.sample_size,
    };
  }
  return byVariant;
}

// ─── POST /api/experiments/assign ───────────────────────────────────────────

experiments.post("/api/experiments/assign", async (c) => {
  const body = await c.req
    .json<{ clientId?: string }>()
    .catch((_err: unknown): { clientId: string | undefined } => ({
      clientId: undefined,
    }));
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
    .catch((_err: unknown): { events: undefined } => ({ events: undefined }));

  const events = body.events;
  if (!Array.isArray(events) || events.length === 0) {
    return c.json({ error: "events array required" }, 400);
  }

  // Cap batch size (allows ~16 user actions × 3 experiments per flush)
  const batch = events.slice(0, 150);
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
    } catch (_err: unknown) {
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
      .all<MetricRow>(),
  ]);

  if (!expRow) {
    return c.json({ error: "Experiment not found" }, 404);
  }

  const variants: VariantDef[] = JSON.parse(expRow.variants);
  const byVariant = groupMetricsByVariant(metricsRows.results ?? []);

  const variantMetrics = variants.map((v) =>
    computeConversionRates(v.id, byVariant[v.id] ?? {}),
  );

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
    .all<MetricRow>();

  const byVariant = groupMetricsByVariant(metricsRows.results ?? []);

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

  // Build input for Bayesian evaluation
  const variantData = variants.map((v) => {
    const vm = byVariant[v.id] ?? {};
    return {
      id: v.id,
      impressions: vm.impressions?.value ?? 0,
      donations: vm.donations?.value ?? 0,
    };
  });

  const result = evaluateExperiment(variantData);

  if (result.shouldGraduate) {
    const now = Date.now();
    await db
      .prepare(
        "UPDATE experiments SET status = 'graduated', winner_variant_id = ?, updated_at = ? WHERE id = ?",
      )
      .bind(result.bestVariant, now, id)
      .run();
  }

  return c.json({
    ready: true,
    graduated: result.shouldGraduate,
    winner: result.shouldGraduate ? result.bestVariant : null,
    probabilities: result.probabilities,
    improvement: Math.round(result.improvement * 1000) / 10,
    controlRate: Math.round(result.controlRate * 10000) / 100,
    winnerRate: Math.round(result.winnerRate * 10000) / 100,
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

// ─── GET /api/experiments/monitor ────────────────────────────────────────

experiments.get("/api/experiments/monitor", async (c) => {
  const hours = parseInt(c.req.query("hours") ?? "4", 10);
  const windowMs = Math.min(Math.max(hours, 1), 168) * 60 * 60 * 1000; // 1h to 7d
  const since = Date.now() - windowMs;

  const db = c.env.DB;

  const [eventCounts, activeExps] = await Promise.all([
    db
      .prepare(
        `SELECT experiment_id, variant_id, event_type, COUNT(*) as cnt
         FROM widget_events
         WHERE created_at >= ? AND experiment_id IS NOT NULL
         GROUP BY experiment_id, variant_id, event_type`,
      )
      .bind(since)
      .all<{
        experiment_id: string;
        variant_id: string;
        event_type: string;
        cnt: number;
      }>(),
    db
      .prepare("SELECT id, name, variants FROM experiments WHERE status = 'active'")
      .all<{ id: string; name: string; variants: string }>(),
  ]);

  const counts = eventCounts.results ?? [];
  const active = activeExps.results ?? [];

  // Build per-experiment, per-variant impression set
  const impressionSet = new Set<string>();
  for (const row of counts) {
    if (row.event_type === "widget_impression") {
      impressionSet.add(`${row.experiment_id}:${row.variant_id}`);
    }
  }

  // Check for anomalies: active variants with 0 impressions in window
  const anomalies: Array<{ experimentId: string; variantId: string; issue: string }> = [];
  for (const exp of active) {
    const variants: Array<{ id: string }> = JSON.parse(exp.variants);
    for (const v of variants) {
      if (!impressionSet.has(`${exp.id}:${v.id}`)) {
        anomalies.push({
          experimentId: exp.id,
          variantId: v.id,
          issue: `Zero impressions in last ${hours}h`,
        });
      }
    }
  }

  return c.json({
    windowHours: hours,
    events: counts,
    anomalies,
    activeExperiments: active.length,
  });
});

export { experiments };
