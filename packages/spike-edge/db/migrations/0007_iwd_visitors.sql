CREATE TABLE iwd_visitors (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  city TEXT,
  country TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_iwd_visitors_created_at ON iwd_visitors(created_at);
