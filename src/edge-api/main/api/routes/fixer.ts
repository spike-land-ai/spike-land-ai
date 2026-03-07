import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import { internalAuthMiddleware } from "../middleware/internal-auth.js";

const fixer = new Hono<{ Bindings: Env; Variables: Variables }>();

const STAGE_ORDER = ["1_setup", "2_explore", "3_triage", "4_fix", "5_regression", "completed"] as const;
type Stage = (typeof STAGE_ORDER)[number];

const VALID_STAGES = new Set<string>([...STAGE_ORDER, "cancelled"]);
const VALID_SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);
const VALID_VERDICTS = new Set(["confirmed", "rejected", "inconclusive"]);

function isValidStage(stage: string): stage is Stage {
  return (STAGE_ORDER as readonly string[]).includes(stage);
}

function isValidTransition(current: string, next: string): boolean {
  if (next === "cancelled") return true;
  const currentIdx = STAGE_ORDER.indexOf(current as Stage);
  const nextIdx = STAGE_ORDER.indexOf(next as Stage);
  if (currentIdx === -1 || nextIdx === -1) return false;
  return nextIdx === currentIdx + 1;
}

// ── Internal Endpoints (protected by x-internal-secret) ──

/** POST /internal/fixer/sessions -- create session */
fixer.post("/internal/fixer/sessions", internalAuthMiddleware, async (c) => {
  const body = await c.req.json<{
    id: string;
    target: string;
    baseUrl: string;
    config: Record<string, unknown>;
  }>();

  if (!body.id || typeof body.id !== "string") {
    return c.json({ error: "id is required and must be a string" }, 400);
  }
  if (!body.target || typeof body.target !== "string") {
    return c.json({ error: "target is required and must be a string" }, 400);
  }
  if (!body.baseUrl || typeof body.baseUrl !== "string") {
    return c.json({ error: "baseUrl is required and must be a string" }, 400);
  }

  const now = Date.now();
  try {
    await c.env.DB.prepare(
      "INSERT INTO fixer_sessions (id, stage, target, base_url, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(body.id, "1_setup", body.target, body.baseUrl, JSON.stringify(body.config ?? {}), now, now).run();
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
      return c.json({ error: "Session already exists" }, 409);
    }
    throw err;
  }

  return c.json({ success: true, sessionId: body.id });
});

/** GET /internal/fixer/sessions/:id -- get session state */
fixer.get("/internal/fixer/sessions/:id", internalAuthMiddleware, async (c) => {
  const id = c.req.param("id");

  const [session, agents, findings, validations, quizzes] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM fixer_sessions WHERE id = ?").bind(id).first(),
    c.env.DB.prepare("SELECT * FROM fixer_agents WHERE session_id = ?").bind(id).all(),
    c.env.DB.prepare("SELECT * FROM fixer_findings WHERE session_id = ?").bind(id).all(),
    c.env.DB.prepare("SELECT * FROM fixer_validations WHERE session_id = ?").bind(id).all(),
    c.env.DB.prepare("SELECT * FROM fixer_quiz_results WHERE session_id = ?").bind(id).all(),
  ]);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({
    session,
    agents: agents.results,
    findings: findings.results,
    validations: validations.results,
    quizzes: quizzes.results,
  });
});

/** PATCH /internal/fixer/sessions/:id -- advance stage */
fixer.patch("/internal/fixer/sessions/:id", internalAuthMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ stage: string }>();

  if (!body.stage || typeof body.stage !== "string") {
    return c.json({ error: "stage is required and must be a string" }, 400);
  }
  if (!VALID_STAGES.has(body.stage)) {
    return c.json({ error: `Invalid stage. Must be one of: ${[...VALID_STAGES].join(", ")}` }, 400);
  }

  const session = await c.env.DB.prepare("SELECT stage FROM fixer_sessions WHERE id = ?").bind(id).first<{ stage: string }>();
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  if (!isValidTransition(session.stage, body.stage)) {
    return c.json({
      error: `Invalid stage transition from '${session.stage}' to '${body.stage}'`,
    }, 400);
  }

  const now = Date.now();
  const isTerminal = body.stage === "completed" || body.stage === "cancelled";
  await c.env.DB.prepare(
    "UPDATE fixer_sessions SET stage = ?, updated_at = ?, completed_at = CASE WHEN ? THEN ? ELSE completed_at END WHERE id = ?",
  ).bind(body.stage, now, isTerminal ? 1 : 0, now, id).run();

  return c.json({ success: true, stage: body.stage });
});

/** POST /internal/fixer/sessions/:id/agents -- record agent */
fixer.post("/internal/fixer/sessions/:id/agents", internalAuthMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    agentId: string;
    role: string;
    personas: number[];
  }>();

  if (!body.agentId || typeof body.agentId !== "string") {
    return c.json({ error: "agentId is required and must be a string" }, 400);
  }
  if (!body.role || typeof body.role !== "string") {
    return c.json({ error: "role is required and must be a string" }, 400);
  }
  if (!Array.isArray(body.personas)) {
    return c.json({ error: "personas is required and must be an array of numbers" }, 400);
  }

  const result = await c.env.DB.prepare(
    "INSERT OR IGNORE INTO fixer_agents (session_id, agent_id, role, personas, quiz_passed, findings_count, quiz_stages_passed) VALUES (?, ?, ?, ?, 0, 0, '[]')",
  ).bind(id, body.agentId, body.role, JSON.stringify(body.personas)).run();

  if (!result.meta.changes) {
    return c.json({ error: "Agent already registered for this session" }, 409);
  }

  return c.json({ success: true });
});

/** POST /internal/fixer/sessions/:id/findings -- record finding */
fixer.post("/internal/fixer/sessions/:id/findings", internalAuthMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    findingId: string;
    agentId: string;
    personaId: number;
    bugId: string;
    title: string;
    severity: string;
  }>();

  if (!body.findingId || typeof body.findingId !== "string") {
    return c.json({ error: "findingId is required" }, 400);
  }
  if (!body.agentId || typeof body.agentId !== "string") {
    return c.json({ error: "agentId is required" }, 400);
  }
  if (typeof body.personaId !== "number") {
    return c.json({ error: "personaId is required and must be a number" }, 400);
  }
  if (!body.bugId || typeof body.bugId !== "string") {
    return c.json({ error: "bugId is required" }, 400);
  }
  if (!body.title || typeof body.title !== "string") {
    return c.json({ error: "title is required" }, 400);
  }
  if (!body.severity || !VALID_SEVERITIES.has(body.severity)) {
    return c.json({ error: `severity must be one of: ${[...VALID_SEVERITIES].join(", ")}` }, 400);
  }

  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO fixer_findings (id, session_id, agent_id, persona_id, bug_id, title, severity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(body.findingId, id, body.agentId, body.personaId, body.bugId, body.title, body.severity, now),
    c.env.DB.prepare(
      "UPDATE fixer_agents SET findings_count = findings_count + 1 WHERE session_id = ? AND agent_id = ?",
    ).bind(id, body.agentId),
  ]);

  return c.json({ success: true });
});

/** POST /internal/fixer/sessions/:id/validations -- record validation */
fixer.post("/internal/fixer/sessions/:id/validations", internalAuthMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    validationId: string;
    bugId: string;
    validatorAgentId: string;
    verdict: string;
    evidence: string;
  }>();

  if (!body.validationId || typeof body.validationId !== "string") {
    return c.json({ error: "validationId is required" }, 400);
  }
  if (!body.bugId || typeof body.bugId !== "string") {
    return c.json({ error: "bugId is required" }, 400);
  }
  if (!body.validatorAgentId || typeof body.validatorAgentId !== "string") {
    return c.json({ error: "validatorAgentId is required" }, 400);
  }
  if (!body.verdict || !VALID_VERDICTS.has(body.verdict)) {
    return c.json({ error: `verdict must be one of: ${[...VALID_VERDICTS].join(", ")}` }, 400);
  }
  if (typeof body.evidence !== "string") {
    return c.json({ error: "evidence is required and must be a string" }, 400);
  }

  const now = Date.now();
  await c.env.DB.prepare(
    "INSERT INTO fixer_validations (id, session_id, bug_id, validator_agent_id, verdict, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(body.validationId, id, body.bugId, body.validatorAgentId, body.verdict, body.evidence, now).run();

  return c.json({ success: true });
});

/** POST /internal/fixer/sessions/:id/quiz -- record quiz result */
fixer.post("/internal/fixer/sessions/:id/quiz", internalAuthMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    agentId: string;
    stage: string;
    score: number;
    passed: boolean;
    answers: number[];
  }>();

  if (!body.agentId || typeof body.agentId !== "string") {
    return c.json({ error: "agentId is required" }, 400);
  }
  if (!body.stage || !isValidStage(body.stage)) {
    return c.json({ error: `stage must be one of: ${STAGE_ORDER.join(", ")}` }, 400);
  }
  if (typeof body.score !== "number") {
    return c.json({ error: "score is required and must be a number" }, 400);
  }
  if (typeof body.passed !== "boolean") {
    return c.json({ error: "passed is required and must be a boolean" }, 400);
  }
  if (!Array.isArray(body.answers)) {
    return c.json({ error: "answers is required and must be an array" }, 400);
  }

  const stmts = [
    c.env.DB.prepare(
      "INSERT OR REPLACE INTO fixer_quiz_results (session_id, agent_id, stage, score, passed, answers) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(id, body.agentId, body.stage, body.score, body.passed ? 1 : 0, JSON.stringify(body.answers)),
  ];

  if (body.passed) {
    const agent = await c.env.DB.prepare(
      "SELECT quiz_stages_passed FROM fixer_agents WHERE session_id = ? AND agent_id = ?",
    ).bind(id, body.agentId).first<{ quiz_stages_passed: string }>();

    const stagesPassed: string[] = agent?.quiz_stages_passed ? JSON.parse(agent.quiz_stages_passed) as string[] : [];
    if (!stagesPassed.includes(body.stage)) {
      stagesPassed.push(body.stage);
    }

    stmts.push(
      c.env.DB.prepare(
        "UPDATE fixer_agents SET quiz_passed = 1, quiz_stages_passed = ? WHERE session_id = ? AND agent_id = ?",
      ).bind(JSON.stringify(stagesPassed), id, body.agentId),
    );
  }

  await c.env.DB.batch(stmts);

  return c.json({ success: true });
});

export { fixer };
