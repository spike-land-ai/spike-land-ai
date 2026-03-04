-- Blog engagement and support donation tables

CREATE TABLE IF NOT EXISTS blog_engagement (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  client_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'fistbump',
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_unique ON blog_engagement(slug, client_id, type);
CREATE INDEX IF NOT EXISTS idx_engagement_slug ON blog_engagement(slug);

CREATE TABLE IF NOT EXISTS support_donations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  stripe_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_donations_slug ON support_donations(slug);
CREATE INDEX IF NOT EXISTS idx_donations_stripe ON support_donations(stripe_session_id);
