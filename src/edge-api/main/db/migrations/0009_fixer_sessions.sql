-- Migration: 0009_fixer_sessions
-- Created for tracking 8-agent orchestrated QA system

CREATE TABLE IF NOT EXISTS fixer_sessions (
    id TEXT PRIMARY KEY,
    stage TEXT NOT NULL,
    target TEXT,
    base_url TEXT,
    config JSON,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS fixer_agents (
    session_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    role TEXT NOT NULL,
    personas JSON,
    quiz_passed INTEGER DEFAULT 0,
    findings_count INTEGER DEFAULT 0,
    PRIMARY KEY (session_id, agent_id),
    FOREIGN KEY (session_id) REFERENCES fixer_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fixer_findings (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    persona_id INTEGER,
    bug_id TEXT,
    title TEXT NOT NULL,
    severity TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES fixer_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fixer_findings_session_id ON fixer_findings(session_id);

CREATE TABLE IF NOT EXISTS fixer_validations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    bug_id TEXT NOT NULL,
    validator_agent_id TEXT NOT NULL,
    verdict TEXT NOT NULL,
    evidence TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES fixer_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fixer_validations_session_id ON fixer_validations(session_id);

CREATE TABLE IF NOT EXISTS fixer_quiz_results (
    session_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    score INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    answers JSON,
    FOREIGN KEY (session_id) REFERENCES fixer_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fixer_quiz_results_session_id ON fixer_quiz_results(session_id);
