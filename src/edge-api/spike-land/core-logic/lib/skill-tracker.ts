/**
 * Records MCP tool call analytics into D1 rollup tables.
 *
 * Writes three rows in a single batch via db.batch()
 * (not transactional — partial writes possible on failure, acceptable for analytics):
 *  1. skill_usage_events  — raw event row
 *  2. tool_call_daily     — upsert rollup (call_count, error_count, total_ms)
 *  3. tool_user_daily     — INSERT OR IGNORE unique user-tool-day
 */

interface SkillCallRecord {
  userId: string;
  toolName: string;
  serverName: string;
  outcome: "success" | "error";
  durationMs: number;
  category?: string;
  errorMessage?: string;
}

function dayEpoch(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export async function recordSkillCall(
  db: D1Database,
  record: SkillCallRecord,
  spikeEdge?: Fetcher,
): Promise<void> {
  const now = Date.now();
  const day = dayEpoch(now);
  const id = crypto.randomUUID();
  const isError = record.outcome === "error" ? 1 : 0;

  await db.batch([
    // 1. Raw event
    db
      .prepare(
        `INSERT INTO skill_usage_events
         (id, user_id, skill_name, server_name, category, outcome, duration_ms, error_message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        record.userId,
        record.toolName,
        record.serverName,
        record.category ?? null,
        record.outcome,
        record.durationMs,
        record.errorMessage ?? null,
        now,
      ),

    // 2. Rollup upsert
    db
      .prepare(
        `INSERT INTO tool_call_daily (user_id, tool_name, server_name, day, call_count, error_count, total_ms)
         VALUES (?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT (user_id, tool_name, server_name, day) DO UPDATE SET
           call_count = call_count + 1,
           error_count = error_count + excluded.error_count,
           total_ms = total_ms + excluded.total_ms`,
      )
      .bind(record.userId, record.toolName, record.serverName, day, isError, record.durationMs),

    // 3. Unique user-tool dedup
    db
      .prepare(
        `INSERT OR IGNORE INTO tool_user_daily (tool_name, server_name, user_id, day)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(record.toolName, record.serverName, record.userId, day),
  ]);

  if (spikeEdge) {
    const [totalRows, distinctDays] = await Promise.all([
      db
        .prepare(`SELECT COUNT(*) as cnt FROM tool_user_daily WHERE user_id = ?`)
        .bind(record.userId)
        .first<{ cnt: number }>(),
      db
        .prepare(`SELECT COUNT(DISTINCT day) as days FROM tool_user_daily WHERE user_id = ?`)
        .bind(record.userId)
        .first<{ days: number }>(),
    ]);

    const events: Array<{ source: string; eventType: string; metadata: Record<string, unknown> }> =
      [];

    if (totalRows?.cnt === 1) {
      events.push({
        source: "mcp",
        eventType: "mcp_server_connected",
        metadata: { userId: record.userId },
      });
      events.push({
        source: "mcp",
        eventType: "first_tool_call",
        metadata: { userId: record.userId, toolName: record.toolName },
      });
    }

    if (distinctDays?.days === 2) {
      events.push({
        source: "mcp",
        eventType: "second_session",
        metadata: { userId: record.userId },
      });
    }

    if (events.length > 0) {
      // Use the SPIKE_EDGE service binding — must use a real hostname so CF can
      // route the request to spike-edge internally.  https://spike.land is correct.
      spikeEdge
        .fetch("https://spike.land/analytics/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(events),
        })
        .catch((err: unknown) => {
          console.error("[skill-tracker] Failed to forward lifecycle events:", err);
        });
    }
  }
}
