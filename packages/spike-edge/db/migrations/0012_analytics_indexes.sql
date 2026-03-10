-- Add compound indexes to analytics_events for common query patterns.
--
-- The funnel and summary queries filter by (event_type, created_at) and group
-- by client_id.  Without a covering index SQLite performs full scans on every
-- request to /analytics/summary and /analytics/funnel.

CREATE INDEX IF NOT EXISTS idx_events_type_created
  ON analytics_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_client_created
  ON analytics_events (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_source_type
  ON analytics_events (source, event_type, created_at DESC);
