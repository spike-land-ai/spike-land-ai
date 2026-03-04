export interface AnalyticsEvent {
  source: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}

/**
 * Track events in the platform's central analytics database (spike-edge).
 * Also forwards to GA4 via spike-edge ingest logic.
 */
export async function trackPlatformEvents(
  spikeEdge: Fetcher,
  events: AnalyticsEvent[],
): Promise<void> {
  try {
    await spikeEdge.fetch("https://spike-edge/analytics/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(events),
    });
  } catch (err) {
    console.error("[Analytics] Failed to track platform events:", err);
  }
}
