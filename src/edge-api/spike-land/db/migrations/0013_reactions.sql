CREATE TABLE tool_reactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_tool TEXT NOT NULL,
  source_event TEXT NOT NULL CHECK (source_event IN ('success', 'error')),
  target_tool TEXT NOT NULL,
  target_input TEXT NOT NULL DEFAULT '{}',
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX tool_reactions_user_id_idx ON tool_reactions(user_id);
CREATE INDEX tool_reactions_source_idx ON tool_reactions(user_id, source_tool, enabled);
CREATE INDEX tool_reactions_event_idx ON tool_reactions(user_id, source_tool, source_event);

CREATE TABLE reaction_logs (
  id TEXT PRIMARY KEY,
  reaction_id TEXT REFERENCES tool_reactions(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_tool TEXT NOT NULL,
  source_event TEXT NOT NULL CHECK (source_event IN ('success', 'error')),
  target_tool TEXT NOT NULL,
  is_error INTEGER NOT NULL DEFAULT 0 CHECK (is_error IN (0, 1)),
  duration_ms INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX reaction_logs_user_created_idx ON reaction_logs(user_id, created_at);
CREATE INDEX reaction_logs_reaction_created_idx ON reaction_logs(reaction_id, created_at);
CREATE INDEX reaction_logs_source_idx ON reaction_logs(user_id, source_tool, is_error);
