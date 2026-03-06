import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import { authMiddleware } from "../middleware/auth.js";
import { calculateBugEloChange } from "../../lazy-imports/elo.js";
import { ensureUserElo, getUserElo, recordEloEvent, type EloEventType } from "../../core-logic/elo-service.js";
import { ensureAgentElo, getAgentElo, recordAgentEloEvent } from "../../core-logic/agent-elo-service.js";
import { eloThrottleMiddleware } from "../middleware/elo-throttle.js";
import {
  buildBugListQuery,
  buildBugCountQuery,
  buildFindExistingBugByError,
  buildFindExistingBugByTitle,
  buildInsertBug,
  buildBumpBugReportCount,
  buildInsertBugReport,
  buildRandomCompetitor,
} from "../../core-logic/bugbook-queries.js";

const bugbook = new Hono<{ Bindings: Env; Variables: Variables }>();

// ── Public Endpoints ──

/** GET /bugbook — list bugs, paginated + filterable. */
bugbook.get("/bugbook", async (c) => {
  const status = c.req.query("status");
  const category = c.req.query("category");
  const sort = c.req.query("sort") ?? "elo";
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const listQ = buildBugListQuery({ status, category, sort, limit, offset });
  const countQ = buildBugCountQuery({ status, category });

  const [result, countResult] = await Promise.all([
    c.env.DB.prepare(listQ.sql).bind(...listQ.params).all(),
    c.env.DB.prepare(countQ.sql).bind(...countQ.params).first<{ total: number }>(),
  ]);

  return c.json({
    bugs: result.results,
    total: countResult?.total ?? 0,
    limit,
    offset,
  });
});

/** GET /bugbook/leaderboard — bugs ranked by ELO. */
bugbook.get("/bugbook/leaderboard", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "25", 10), 100);

  const [bugs, reporters] = await Promise.all([
    c.env.DB.prepare(
      "SELECT id, title, category, status, severity, elo, report_count FROM bugs WHERE status IN ('CANDIDATE', 'ACTIVE') ORDER BY elo DESC LIMIT ?",
    ).bind(limit).all(),
    c.env.DB.prepare(
      "SELECT user_id, elo, tier, event_count FROM user_elo ORDER BY elo DESC LIMIT ?",
    ).bind(limit).all(),
  ]);

  return c.json({
    topBugs: bugs.results,
    topReporters: reporters.results,
  });
});

/** GET /bugbook/reporters — top bug reporters by user ELO. */
bugbook.get("/bugbook/reporters", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "25", 10), 100);
  const result = await c.env.DB.prepare(
    "SELECT user_id, elo, tier, event_count FROM user_elo ORDER BY elo DESC LIMIT ?",
  ).bind(limit).all();
  return c.json(result.results);
});

/** GET /bugbook/:id — single bug detail with report history. */
bugbook.get("/bugbook/:id", async (c) => {
  const bugId = c.req.param("id");

  const [bug, reports, eloHistory] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM bugs WHERE id = ?").bind(bugId).first(),
    c.env.DB.prepare(
      "SELECT id, reporter_id, service_name, description, severity, created_at FROM bug_reports WHERE bug_id = ? ORDER BY created_at DESC LIMIT 50",
    ).bind(bugId).all(),
    c.env.DB.prepare(
      "SELECT old_elo, new_elo, change_amount, reason, created_at FROM bug_elo_history WHERE bug_id = ? ORDER BY created_at DESC LIMIT 20",
    ).bind(bugId).all(),
  ]);

  if (!bug) {
    return c.json({ error: "Bug not found" }, 404);
  }

  return c.json({
    bug,
    reports: reports.results,
    eloHistory: eloHistory.results,
  });
});

// ── Authenticated Endpoints ──

/** POST /bugbook/report — submit a bug report. */
bugbook.post("/bugbook/report", authMiddleware, eloThrottleMiddleware, async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json<{
    title: string;
    description: string;
    service_name: string;
    severity?: string;
    reproduction_steps?: string;
    error_code?: string;
    metadata?: Record<string, unknown>;
  }>();

  if (!body.title || !body.description || !body.service_name) {
    return c.json({ error: "title, description, and service_name are required" }, 400);
  }

  const severity = ["low", "medium", "high", "critical"].includes(body.severity ?? "")
    ? body.severity!
    : "medium";

  const now = Date.now();

  // Try to match existing bug by error_code+service_name or exact title
  let existingBug: Record<string, unknown> | null = null;

  if (body.error_code) {
    const q = buildFindExistingBugByError(body.service_name, body.error_code);
    existingBug = await c.env.DB.prepare(q.sql).bind(...q.params).first();
  }

  if (!existingBug) {
    const q = buildFindExistingBugByTitle(body.title, body.service_name);
    existingBug = await c.env.DB.prepare(q.sql).bind(...q.params).first();
  }

  let bugId: string;
  let isNewBug: boolean;

  if (existingBug) {
    bugId = existingBug.id as string;
    isNewBug = false;

    const bumpQ = buildBumpBugReportCount(now, bugId);
    await c.env.DB.prepare(bumpQ.sql).bind(...bumpQ.params).run();
  } else {
    const insertQ = buildInsertBug(body.title, body.description, body.service_name, severity, body.error_code);
    const result = await c.env.DB.prepare(insertQ.sql).bind(...insertQ.params).first<{ id: string }>();

    bugId = result!.id;
    isNewBug = true;
  }

  const reportQ = buildInsertBugReport(
    bugId, userId, body.service_name, body.description,
    body.reproduction_steps ?? null, severity, body.metadata,
  );
  await c.env.DB.prepare(reportQ.sql).bind(...reportQ.params).run();

  // Bug-vs-Bug ELO: pick a random same-category competitor
  const compQ = buildRandomCompetitor(body.service_name, bugId);
  const competitor = await c.env.DB.prepare(compQ.sql).bind(...compQ.params).first<{ id: string; elo: number; report_count: number }>();

  if (competitor) {
    const currentBug = await c.env.DB.prepare(
      "SELECT elo, report_count FROM bugs WHERE id = ?",
    ).bind(bugId).first<{ elo: number; report_count: number }>();

    if (currentBug) {
      const eloResult = calculateBugEloChange(
        currentBug.elo,
        competitor.elo,
        currentBug.report_count,
        competitor.report_count,
      );

      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE bugs SET elo = ? WHERE id = ?").bind(eloResult.winnerNewElo, bugId),
        c.env.DB.prepare("UPDATE bugs SET elo = ? WHERE id = ?").bind(eloResult.loserNewElo, competitor.id),
        c.env.DB.prepare(
          "INSERT INTO bug_elo_history (bug_id, old_elo, new_elo, change_amount, reason, opponent_bug_id) VALUES (?, ?, ?, ?, 'new_report', ?)",
        ).bind(bugId, currentBug.elo, eloResult.winnerNewElo, eloResult.winnerChange, competitor.id),
        c.env.DB.prepare(
          "INSERT INTO bug_elo_history (bug_id, old_elo, new_elo, change_amount, reason, opponent_bug_id) VALUES (?, ?, ?, ?, 'competitor_loss', ?)",
        ).bind(competitor.id, competitor.elo, eloResult.loserNewElo, eloResult.loserChange, bugId),
      ]);
    }
  }

  // User ELO: reward for reporting
  const eloEvent = isNewBug ? "report_valid_bug" : "bug_confirmed";
  const eloResult = await recordEloEvent(c.env.DB, userId, eloEvent as "report_valid_bug" | "bug_confirmed", bugId);

  return c.json({
    bugId,
    isNewBug,
    status: isNewBug ? "CANDIDATE" : (existingBug?.status ?? "ACTIVE"),
    userElo: { newElo: eloResult.newElo, delta: eloResult.delta, tier: eloResult.tier },
  }, 201);
});

/** POST /bugbook/:id/confirm — confirm an existing bug. */
bugbook.post("/bugbook/:id/confirm", authMiddleware, eloThrottleMiddleware, async (c) => {
  const userId = c.get("userId");
  const bugId = c.req.param("id");

  const bug = await c.env.DB.prepare("SELECT * FROM bugs WHERE id = ?").bind(bugId).first();
  if (!bug) {
    return c.json({ error: "Bug not found" }, 404);
  }

  // Check if user already reported this bug
  const existing = await c.env.DB.prepare(
    "SELECT id FROM bug_reports WHERE bug_id = ? AND reporter_id = ? LIMIT 1",
  ).bind(bugId, userId).first();

  if (existing) {
    return c.json({ error: "You have already reported this bug" }, 409);
  }

  const now = Date.now();
  const bumpQ = buildBumpBugReportCount(now, bugId);
  await c.env.DB.batch([
    c.env.DB.prepare(bumpQ.sql).bind(...bumpQ.params),
    c.env.DB.prepare(
      "INSERT INTO bug_reports (bug_id, reporter_id, service_name, description, severity) VALUES (?, ?, ?, 'Confirmed by user', ?)",
    ).bind(bugId, userId, bug.category as string, bug.severity as string),
  ]);

  const eloResult = await recordEloEvent(c.env.DB, userId, "bug_confirmed", bugId);

  return c.json({
    bugId,
    userElo: { newElo: eloResult.newElo, delta: eloResult.delta, tier: eloResult.tier },
  });
});

/** PATCH /bugbook/:id/fix — mark bug as fixed (admin only for now). */
bugbook.patch("/bugbook/:id/fix", authMiddleware, async (c) => {
  const bugId = c.req.param("id");
  const now = Date.now();

  const bug = await c.env.DB.prepare("SELECT * FROM bugs WHERE id = ?").bind(bugId).first();
  if (!bug) {
    return c.json({ error: "Bug not found" }, 404);
  }

  await c.env.DB.prepare(
    "UPDATE bugs SET status = 'FIXED', fixed_at = ? WHERE id = ?",
  ).bind(now, bugId).run();

  return c.json({ bugId, status: "FIXED" });
});

/** GET /bugbook/my-reports — user's own reports. */
bugbook.get("/bugbook/my-reports", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);

  const [reports, userElo] = await Promise.all([
    c.env.DB.prepare(
      `SELECT br.id, br.bug_id, br.description, br.severity, br.created_at,
              b.title as bug_title, b.status as bug_status, b.elo as bug_elo
       FROM bug_reports br JOIN bugs b ON br.bug_id = b.id
       WHERE br.reporter_id = ? ORDER BY br.created_at DESC LIMIT ?`,
    ).bind(userId, limit).all(),
    getUserElo(c.env.DB, userId),
  ]);

  return c.json({
    reports: reports.results,
    userElo: userElo ?? { elo: 1200, tier: "pro" },
  });
});

// ── Internal Endpoints (protected by x-internal-secret) ──

/** GET /internal/elo/:userId — get user ELO + tier. */
bugbook.get("/internal/elo/:userId", async (c) => {
  const secret = c.req.header("x-internal-secret");
  if (!secret || !c.env.INTERNAL_SERVICE_SECRET || secret !== c.env.INTERNAL_SERVICE_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userId = c.req.param("userId");
  const user = await ensureUserElo(c.env.DB, userId);
  return c.json({ elo: user.elo, tier: user.tier, eventCount: user.eventCount });
});

/** POST /internal/elo/event — record an ELO event. */
bugbook.post("/internal/elo/event", async (c) => {
  const secret = c.req.header("x-internal-secret");
  if (!secret || !c.env.INTERNAL_SERVICE_SECRET || secret !== c.env.INTERNAL_SERVICE_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json<{
    userId: string;
    eventType: string;
    referenceId?: string;
  }>();

  if (!body.userId || !body.eventType) {
    return c.json({ error: "userId and eventType are required" }, 400);
  }

  const validTypes = new Set([
    "report_valid_bug", "bug_confirmed", "successful_tool_use",
    "false_bug_report", "rate_limit_hit", "abuse_flag",
  ]);

  if (!validTypes.has(body.eventType)) {
    return c.json({ error: "Invalid event type" }, 400);
  }

  const result = await recordEloEvent(
    c.env.DB,
    body.userId,
    body.eventType as "report_valid_bug",
    body.referenceId,
  );

  return c.json(result);
});

/** GET /internal/agent-elo/:agentId — get agent ELO + tier. */
bugbook.get("/internal/agent-elo/:agentId", async (c) => {
  const secret = c.req.header("x-internal-secret");
  if (!secret || !c.env.INTERNAL_SERVICE_SECRET || secret !== c.env.INTERNAL_SERVICE_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const agentId = c.req.param("agentId");
  const agent = await getAgentElo(c.env.DB, agentId);
  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }
  return c.json({ elo: agent.elo, tier: agent.tier, eventCount: agent.eventCount });
});

/** POST /internal/agent-elo/event — record an agent ELO event. */
bugbook.post("/internal/agent-elo/event", async (c) => {
  const secret = c.req.header("x-internal-secret");
  if (!secret || !c.env.INTERNAL_SERVICE_SECRET || secret !== c.env.INTERNAL_SERVICE_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json<{
    agentId: string;
    ownerUserId: string;
    eventType: string;
    referenceId?: string;
  }>();

  if (!body.agentId || !body.ownerUserId || !body.eventType) {
    return c.json({ error: "agentId, ownerUserId and eventType are required" }, 400);
  }

  const validTypes = new Set([
    "report_valid_bug", "bug_confirmed", "successful_tool_use",
    "false_bug_report", "rate_limit_hit", "abuse_flag",
  ]);

  if (!validTypes.has(body.eventType)) {
    return c.json({ error: "Invalid event type" }, 400);
  }

  const result = await recordAgentEloEvent(
    c.env.DB,
    body.agentId,
    body.ownerUserId,
    body.eventType as EloEventType,
    body.referenceId,
  );

  return c.json(result);
});

/** POST /internal/agent-elo/ensure — creates agent ELO if not exists. */
bugbook.post("/internal/agent-elo/ensure", async (c) => {
  const secret = c.req.header("x-internal-secret");
  if (!secret || !c.env.INTERNAL_SERVICE_SECRET || secret !== c.env.INTERNAL_SERVICE_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json<{
    agentId: string;
    ownerUserId: string;
  }>();

  if (!body.agentId || !body.ownerUserId) {
    return c.json({ error: "agentId and ownerUserId are required" }, 400);
  }

  const agent = await ensureAgentElo(c.env.DB, body.agentId, body.ownerUserId);
  return c.json({ elo: agent.elo, tier: agent.tier, eventCount: agent.eventCount });
});

export { bugbook };
