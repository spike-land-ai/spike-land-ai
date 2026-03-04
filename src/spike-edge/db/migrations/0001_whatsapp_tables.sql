-- WhatsApp linking and message log tables for spike-edge

CREATE TABLE IF NOT EXISTS whatsapp_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phone_hash TEXT,
  verified_at INTEGER,
  link_code TEXT,
  link_code_expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_links_phone_hash_idx ON whatsapp_links(phone_hash);
CREATE INDEX IF NOT EXISTS whatsapp_links_user_id_idx ON whatsapp_links(user_id);

CREATE TABLE IF NOT EXISTS whatsapp_message_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  phone_hash TEXT NOT NULL,
  direction TEXT NOT NULL,
  command TEXT,
  tool_name TEXT,
  message_preview TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS whatsapp_message_log_user_id_idx ON whatsapp_message_log(user_id);
CREATE INDEX IF NOT EXISTS whatsapp_message_log_phone_hash_idx ON whatsapp_message_log(phone_hash);

CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_name TEXT,
  error_code TEXT,
  message TEXT,
  stack_trace TEXT,
  severity TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
