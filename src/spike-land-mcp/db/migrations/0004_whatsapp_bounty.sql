-- Migration: WhatsApp links, API key vault, access grants, message log
-- Created: 2026-03-04

-- WhatsApp Links
CREATE TABLE IF NOT EXISTS whatsapp_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_hash TEXT NOT NULL,
  verified_at INTEGER,
  link_code TEXT,
  link_code_expires_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_links_phone_hash_idx ON whatsapp_links(phone_hash);
CREATE INDEX IF NOT EXISTS whatsapp_links_user_id_idx ON whatsapp_links(user_id);

-- User API Key Vault (BYOK)
CREATE TABLE IF NOT EXISTS user_api_key_vault (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS user_api_key_vault_user_provider_idx ON user_api_key_vault(user_id, provider);

-- Access Grants (bug bounty, referral, admin)
CREATE TABLE IF NOT EXISTS access_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grant_type TEXT NOT NULL,
  tier TEXT NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS access_grants_user_id_idx ON access_grants(user_id);
CREATE INDEX IF NOT EXISTS access_grants_user_expires_idx ON access_grants(user_id, expires_at);

-- WhatsApp Message Log
CREATE TABLE IF NOT EXISTS whatsapp_message_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  phone_hash TEXT NOT NULL,
  direction TEXT NOT NULL,
  command TEXT,
  tool_name TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS whatsapp_message_log_user_id_idx ON whatsapp_message_log(user_id);
CREATE INDEX IF NOT EXISTS whatsapp_message_log_phone_hash_idx ON whatsapp_message_log(phone_hash);
