-- MCP Tool Call Analytics: rollup tables + server_name on raw events

ALTER TABLE skill_usage_events ADD COLUMN server_name TEXT NOT NULL DEFAULT 'spike-land-mcp';

CREATE TABLE tool_call_daily (
  user_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  server_name TEXT NOT NULL,
  day INTEGER NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  total_ms INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, tool_name, server_name, day)
);
CREATE INDEX idx_tcd_user_day ON tool_call_daily(user_id, day);
CREATE INDEX idx_tcd_tool_day ON tool_call_daily(tool_name, day);

CREATE TABLE tool_user_daily (
  tool_name TEXT NOT NULL,
  server_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  PRIMARY KEY (tool_name, server_name, user_id, day)
);
CREATE INDEX idx_tud_tool_day ON tool_user_daily(tool_name, day);
