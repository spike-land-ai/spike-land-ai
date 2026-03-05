/**
 * Donation and experiment revenue tracking service.
 * Handles blog support donations and A/B test revenue attribution.
 */

import { createLogger } from "@spike-land-ai/shared";
import type { StripeEvent, StripeSession } from "./subscription-service.js";

const log = createLogger("spike-edge");

// ─── Blog Support Donation ──────────────────────────────────────────────────

export async function handleBlogDonation(
  db: D1Database,
  event: StripeEvent,
): Promise<void> {
  const session = event.data.object as unknown as StripeSession;
  const slug = session.metadata?.slug;
  const amountStr = session.metadata?.amount;
  const sessionId = (event.data.object as Record<string, unknown>).id as string | undefined;

  if (!slug || !sessionId) return;

  // Update pending donation to completed
  const updated = await db.prepare(
    "UPDATE support_donations SET status = 'completed' WHERE stripe_session_id = ?",
  ).bind(sessionId).run();

  // If no pending record found, insert one
  if (!updated.meta.changes || updated.meta.changes === 0) {
    await db.prepare(
      "INSERT INTO support_donations (id, slug, amount_cents, stripe_session_id, status, created_at) VALUES (?, ?, ?, ?, 'completed', ?)",
    ).bind(
      crypto.randomUUID(),
      slug,
      amountStr ? Math.round(parseFloat(amountStr) * 100) : 0,
      sessionId,
      Date.now(),
    ).run();
  }

  // Track experiment revenue
  await trackExperimentRevenue(db, session.metadata, slug, amountStr);
}

// ─── Experiment Revenue Tracking ────────────────────────────────────────────

async function trackExperimentRevenue(
  db: D1Database,
  metadata: Record<string, string> | undefined,
  slug: string,
  amountStr: string | undefined,
): Promise<void> {
  try {
    const metaClientId = metadata?.client_id;
    const amountCents = amountStr ? Math.round(parseFloat(amountStr) * 100) : 0;
    if (!metaClientId || amountCents <= 0) return;

    const assignmentRows = await db
      .prepare(
        "SELECT experiment_id, variant_id FROM experiment_assignments WHERE client_id = ?",
      )
      .bind(metaClientId)
      .all<{ experiment_id: string; variant_id: string }>();

    const assignments = assignmentRows.results ?? [];
    if (assignments.length === 0) return;

    const now = Date.now();
    const stmts: D1PreparedStatement[] = [];

    for (const a of assignments) {
      // Insert checkout_completed event
      stmts.push(
        db
          .prepare(
            "INSERT INTO widget_events (id, client_id, slug, event_type, event_data, experiment_id, variant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            crypto.randomUUID(),
            metaClientId,
            slug ?? "",
            "checkout_completed",
            JSON.stringify({ amount: amountCents / 100 }),
            a.experiment_id,
            a.variant_id,
            now,
          ),
      );

      // Upsert revenue_cents metric
      stmts.push(
        db
          .prepare(
            `INSERT INTO experiment_metrics (id, experiment_id, variant_id, metric_name, metric_value, sample_size, updated_at)
             VALUES (?, ?, ?, 'revenue_cents', ?, 1, ?)
             ON CONFLICT (experiment_id, variant_id, metric_name)
             DO UPDATE SET metric_value = metric_value + ?, sample_size = sample_size + 1, updated_at = ?`,
          )
          .bind(
            crypto.randomUUID(),
            a.experiment_id,
            a.variant_id,
            amountCents,
            now,
            amountCents,
            now,
          ),
      );

      // Upsert donations metric
      stmts.push(
        db
          .prepare(
            `INSERT INTO experiment_metrics (id, experiment_id, variant_id, metric_name, metric_value, sample_size, updated_at)
             VALUES (?, ?, ?, 'donations', 1, 1, ?)
             ON CONFLICT (experiment_id, variant_id, metric_name)
             DO UPDATE SET metric_value = metric_value + 1, sample_size = sample_size + 1, updated_at = ?`,
          )
          .bind(
            crypto.randomUUID(),
            a.experiment_id,
            a.variant_id,
            now,
            now,
          ),
      );
    }

    await db.batch(stmts);
  } catch (trackingErr) {
    const msg = trackingErr instanceof Error ? trackingErr.message : "Unknown";
    log.error("Experiment tracking failed (non-fatal)", { error: msg });
  }
}
