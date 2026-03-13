/**
 * Incident Detector
 *
 * Compares current probe results against active incidents.
 * Opens new incidents for services that went down/degraded.
 * Resolves incidents for services that recovered.
 */

import type { ProbeResult } from "./monitor";
import { getActiveIncidents, openIncident, resolveIncident, type Incident } from "./incidents";

export interface DetectorResult {
  opened: Incident[];
  resolved: number[];
}

/**
 * Run incident detection: compare probe results against active incidents.
 * - If a service is down/degraded and has no open incident → open one.
 * - If a service is up and has an open incident → resolve it.
 */
export async function detectIncidents(
  db: D1Database,
  probeResults: ProbeResult[],
): Promise<DetectorResult> {
  const activeIncidents = await getActiveIncidents(db);
  const incidentByService = new Map<string, Incident>();
  for (const incident of activeIncidents) {
    incidentByService.set(incident.service_name, incident);
  }

  const opened: Incident[] = [];
  const resolved: number[] = [];

  for (const probe of probeResults) {
    const existing = incidentByService.get(probe.label);

    if (probe.status === "up") {
      // Service recovered — resolve any open incident
      if (existing) {
        await resolveIncident(
          db,
          existing.id,
          `Auto-resolved: probe returned HTTP ${probe.httpStatus} in ${probe.latencyMs}ms`,
        );
        resolved.push(existing.id);
      }
    } else {
      // Service is down or degraded — open incident if none exists
      if (!existing) {
        const severity = probe.status === "down" ? "down" : "degraded";
        const notes = probe.error
          ? `Auto-detected: ${probe.error}`
          : `Auto-detected: ${probe.status} (HTTP ${probe.httpStatus}, ${probe.latencyMs}ms)`;
        const incident = await openIncident(db, probe.label, severity, notes);
        opened.push(incident);
      }
    }
  }

  return { opened, resolved };
}
