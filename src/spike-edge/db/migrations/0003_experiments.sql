-- A/B Testing & Experiment Infrastructure
-- Sprint 1: Experiments, assignments, widget events, materialized metrics

-- Experiment definitions
CREATE TABLE experiments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dimension TEXT NOT NULL,
  variants TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  winner_variant_id TEXT,
  traffic_pct INTEGER DEFAULT 100,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Deterministic client→variant assignments
CREATE TABLE experiment_assignments (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_assign_unique ON experiment_assignments(experiment_id, client_id);

-- High-volume widget interaction events
CREATE TABLE widget_events (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT,
  experiment_id TEXT,
  variant_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_we_experiment ON widget_events(experiment_id, variant_id, event_type);
CREATE INDEX idx_we_slug ON widget_events(slug, created_at);

-- Materialized metrics (avoid COUNT on widget_events)
CREATE TABLE experiment_metrics (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL DEFAULT 0,
  sample_size INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_metrics_unique ON experiment_metrics(experiment_id, variant_id, metric_name);
