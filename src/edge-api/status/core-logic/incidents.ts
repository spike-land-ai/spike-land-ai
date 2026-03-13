/**
 * Incident State Machine
 *
 * D1-backed incident lifecycle: open → resolved.
 * Auto-opens incidents when probes detect failures, auto-resolves when recovery is confirmed.
 */

export interface Incident {
  id: number;
  service_name: string;
  status: "open" | "resolved";
  severity: "degraded" | "down";
  opened_at: number;
  updated_at: number;
  resolved_at: number | null;
  notes: string | null;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS status_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  severity TEXT NOT NULL DEFAULT 'degraded',
  opened_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER,
  notes TEXT
)`;

let schemaEnsured = false;

export async function ensureIncidentSchema(db: D1Database): Promise<void> {
  if (schemaEnsured) return;
  await db.prepare(SCHEMA_SQL).run();
  schemaEnsured = true;
}

export async function openIncident(
  db: D1Database,
  serviceName: string,
  severity: "degraded" | "down",
  notes?: string,
): Promise<Incident> {
  await ensureIncidentSchema(db);
  const now = Date.now();
  const result = await db
    .prepare(
      `INSERT INTO status_incidents (service_name, status, severity, opened_at, updated_at, notes)
       VALUES (?, 'open', ?, ?, ?, ?)`,
    )
    .bind(serviceName, severity, now, now, notes ?? null)
    .run();

  return {
    id: result.meta.last_row_id as number,
    service_name: serviceName,
    status: "open",
    severity,
    opened_at: now,
    updated_at: now,
    resolved_at: null,
    notes: notes ?? null,
  };
}

export async function resolveIncident(
  db: D1Database,
  incidentId: number,
  notes?: string,
): Promise<void> {
  await ensureIncidentSchema(db);
  const now = Date.now();
  const notesSql = notes
    ? `notes = CASE WHEN notes IS NULL THEN ? ELSE notes || '\n' || ? END,`
    : "";
  const binds = notes ? [notes, notes, now, now, incidentId] : [now, now, incidentId];

  await db
    .prepare(
      `UPDATE status_incidents SET
       ${notesSql}
       status = 'resolved',
       resolved_at = ?,
       updated_at = ?
       WHERE id = ?`,
    )
    .bind(...binds)
    .run();
}

export async function getActiveIncidents(db: D1Database): Promise<Incident[]> {
  await ensureIncidentSchema(db);
  const result = await db
    .prepare(
      `SELECT id, service_name, status, severity, opened_at, updated_at, resolved_at, notes
       FROM status_incidents
       WHERE status = 'open'
       ORDER BY opened_at DESC`,
    )
    .all<Incident>();
  return result.results;
}

export async function getRecentIncidents(db: D1Database, limit = 20): Promise<Incident[]> {
  await ensureIncidentSchema(db);
  const result = await db
    .prepare(
      `SELECT id, service_name, status, severity, opened_at, updated_at, resolved_at, notes
       FROM status_incidents
       ORDER BY opened_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<Incident>();
  return result.results;
}
