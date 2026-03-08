ALTER TABLE iwd_visitors ADD COLUMN locale TEXT;
ALTER TABLE iwd_visitors ADD COLUMN greeting TEXT;
ALTER TABLE iwd_visitors ADD COLUMN language_label TEXT;

UPDATE iwd_visitors
SET
  locale = COALESCE(locale, 'en'),
  greeting = COALESCE(greeting, 'Happy International Women''s Day'),
  language_label = COALESCE(language_label, 'English')
WHERE locale IS NULL OR greeting IS NULL OR language_label IS NULL;

CREATE TABLE iwd_messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  visitor_id TEXT NOT NULL REFERENCES iwd_visitors(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  emoji_json TEXT NOT NULL DEFAULT '[]',
  country TEXT,
  city TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  locale TEXT,
  greeting TEXT,
  image_prompt TEXT,
  image_job_id TEXT,
  image_url TEXT,
  image_status TEXT NOT NULL DEFAULT 'PROCESSING',
  error_message TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_iwd_messages_created_at ON iwd_messages(created_at);
CREATE INDEX idx_iwd_messages_updated_at ON iwd_messages(updated_at);
CREATE INDEX idx_iwd_messages_visitor_id ON iwd_messages(visitor_id);
CREATE INDEX idx_iwd_messages_image_status ON iwd_messages(image_status);
