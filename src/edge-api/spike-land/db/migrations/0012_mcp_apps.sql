CREATE TABLE mcp_apps (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  tools TEXT NOT NULL DEFAULT '[]',
  graph TEXT NOT NULL DEFAULT '{}',
  markdown TEXT NOT NULL DEFAULT '',
  tool_count INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_mcp_apps_status ON mcp_apps(status);
CREATE INDEX idx_mcp_apps_sort ON mcp_apps(sort_order);