-- Migration: 0010_fix_fixer_schema
-- Fixes: P0-4 quiz uniqueness, P1-5 per-stage quiz tracking, P1-10 updated_at

CREATE UNIQUE INDEX IF NOT EXISTS idx_fixer_quiz_unique ON fixer_quiz_results(session_id, agent_id, stage);

ALTER TABLE fixer_agents ADD COLUMN quiz_stages_passed TEXT DEFAULT '[]';

ALTER TABLE fixer_sessions ADD COLUMN updated_at INTEGER;
