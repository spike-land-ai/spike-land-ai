-- Service purchases for productized services (app builder, workshops)
CREATE TABLE IF NOT EXISTS service_purchases (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL,
  user_id TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_purchases_service ON service_purchases(service);
CREATE INDEX IF NOT EXISTS idx_service_purchases_created ON service_purchases(created_at);
