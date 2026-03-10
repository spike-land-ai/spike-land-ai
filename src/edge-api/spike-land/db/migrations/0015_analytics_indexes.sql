-- Add compound indexes for MCP analytics rollup queries.
--
-- tool_call_daily: the summary and tool-listing queries scan by (day, tool_name)
-- across all user_ids.  A tool+day index avoids a full-table scan.
--
-- skill_usage_events: the health overview and error_rate tools filter by
-- (outcome, created_at); the latency tool filters by (created_at).

CREATE INDEX IF NOT EXISTS idx_tcd_server_tool_day
  ON tool_call_daily (server_name, tool_name, day);

CREATE INDEX IF NOT EXISTS idx_sue_outcome_created
  ON skill_usage_events (outcome, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sue_server_created
  ON skill_usage_events (server_name, created_at DESC);
