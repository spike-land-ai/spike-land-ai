import { z as zod } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createZodTool, textResult } from "@spike-land-ai/mcp-server-base";
import {
  PERSONAS,
  QUIZ_BANK,
  createFixerSessionId,
} from "../core-logic/personas.js";

const API_BASE = process.env.EDGE_API_BASE_URL || "https://api.spike.land";
const SECRET = process.env.INTERNAL_SERVICE_SECRET || "dev-internal-secret";

const STAGE_ORDER = ["1_setup", "2_explore", "3_triage", "4_fix", "5_regression", "completed"] as const;

interface SessionResponse {
  session: Record<string, unknown>;
  agents: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  validations: Array<Record<string, unknown>>;
  quizzes: Array<Record<string, unknown>>;
}

async function fetchInternal<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SECRET,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status} at ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function registerFixerTools(server: McpServer): void {
  // ── bazdmeg_fixer_start ──────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_fixer_start",
    description: "Start a new fixer session, assigning roles to agents and returning Stage 1 quiz",
    schema: {
      target: zod.string().describe("Target system (e.g., local, staging)"),
      baseUrl: zod.string().describe("Base URL of the target"),
    },
    handler: async (args) => {
      const sessionId = createFixerSessionId();
      await fetchInternal("/internal/fixer/sessions", {
        method: "POST",
        body: JSON.stringify({
          id: sessionId,
          target: args.target,
          baseUrl: args.baseUrl,
          config: {},
        }),
      });

      return textResult(
        `## Fixer Session Created: ${sessionId}\n\n` +
        `**Stage 1: Setup Verification**\n` +
        `Please answer the following quiz to proceed (need 2/3 to pass).\n\n` +
        QUIZ_BANK["1_setup"]
          .map((q, i) => `Q${i + 1}: ${q.question}\nOptions: ${q.options.map((o, j) => `${j}. ${o}`).join(", ")}`)
          .join("\n\n") +
        `\n\n## Next Steps\n` +
        `Call \`bazdmeg_fixer_quiz\` with sessionId "${sessionId}", your agentId, stage "1_setup", and your answers [0-3 indices].`
      );
    },
  });

  // ── bazdmeg_fixer_assign_personas ────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_fixer_assign_personas",
    description: "Assign personas to a specific agent for the exploration phase",
    schema: {
      sessionId: zod.string(),
      agentId: zod.string(),
      role: zod.enum([
        "MCP_Explorer_A",
        "MCP_Explorer_B",
        "Website_Explorer_A",
        "Website_Explorer_B",
        "QA_Expert_A",
        "QA_Expert_B",
        "Log_Monitor_A",
        "Log_Monitor_B",
      ]),
    },
    handler: async (args) => {
      // QA_Expert roles get a task brief, not personas
      if (args.role.startsWith("QA_Expert")) {
        await fetchInternal(`/internal/fixer/sessions/${args.sessionId}/agents`, {
          method: "POST",
          body: JSON.stringify({
            agentId: args.agentId,
            role: args.role,
            personas: [],
          }),
        });

        return textResult(
          `## Agent Assigned: ${args.role}\n\n` +
          `**Role: Bug Reproduction & Triage**\n\n` +
          `### Your Mission\n` +
          `Reproduce bugs reported by Explorer agents using qa-studio tools, then confirm or reject them.\n\n` +
          `### Tools to Use\n` +
          `- \`bazdmeg_fixer_status\` — check current findings\n` +
          `- qa-studio tools (\`web_navigate\`, \`web_click\`, \`web_type\`) — reproduce bugs in browser\n` +
          `- \`bazdmeg_fixer_report_finding\` — log confirmed reproductions\n` +
          `- \`bazdmeg_fixer_validate\` — validate fixes in Stage 4\n\n` +
          `### Process\n` +
          `1. Get session status to see reported findings\n` +
          `2. For each finding, attempt to reproduce using qa-studio\n` +
          `3. If reproducible, confirm via POST /bugbook/:id/confirm\n` +
          `4. If not reproducible, note conditions in finding description\n\n` +
          `## Next Steps\n` +
          `Call \`bazdmeg_fixer_status\` with sessionId "${args.sessionId}" to see current findings.`
        );
      }

      // Log_Monitor roles get a task brief, not personas
      if (args.role.startsWith("Log_Monitor")) {
        await fetchInternal(`/internal/fixer/sessions/${args.sessionId}/agents`, {
          method: "POST",
          body: JSON.stringify({
            agentId: args.agentId,
            role: args.role,
            personas: [],
          }),
        });

        return textResult(
          `## Agent Assigned: ${args.role}\n\n` +
          `**Role: Error Log Correlation & ELO Monitoring**\n\n` +
          `### Your Mission\n` +
          `Correlate error logs with reported bugs and monitor bugbook ELO changes.\n\n` +
          `### Tools to Use\n` +
          `- \`bazdmeg_fixer_status\` — check current findings\n` +
          `- Error log endpoints (\`GET /errors\`, \`GET /errors/summary\`) — fetch error patterns\n` +
          `- \`bazdmeg_fixer_report_finding\` — report uncaptured errors as findings\n\n` +
          `### Process\n` +
          `1. Check error logs for patterns\n` +
          `2. Cross-reference with reported findings\n` +
          `3. Report any errors not yet captured as findings\n` +
          `4. Monitor bugbook ELO for anomalies\n\n` +
          `## Next Steps\n` +
          `Call \`bazdmeg_fixer_status\` with sessionId "${args.sessionId}" to see current findings.`
        );
      }

      // Explorer roles get persona assignments
      let assignedPersonaIds: number[] = [];
      if (args.role === "MCP_Explorer_A") assignedPersonaIds = [1, 2, 3, 4];
      if (args.role === "MCP_Explorer_B") assignedPersonaIds = [5, 6, 7, 8];
      if (args.role === "Website_Explorer_A") assignedPersonaIds = [9, 10, 11, 12];
      if (args.role === "Website_Explorer_B") assignedPersonaIds = [13, 14, 15, 16];

      await fetchInternal(`/internal/fixer/sessions/${args.sessionId}/agents`, {
        method: "POST",
        body: JSON.stringify({
          agentId: args.agentId,
          role: args.role,
          personas: assignedPersonaIds,
        }),
      });

      const assigned = assignedPersonaIds.map((id) => PERSONAS[id]);

      return textResult(
        `## Agent Assigned to ${args.role}\n\n` +
        `Your Personas:\n` +
        assigned
          .map(
            (p) =>
              `- **${p?.name}** (${p?.archetype})\n  Level: ${p?.level}\n  Focus: ${p?.focus}\n  Scenarios: ${p?.scenarios.join("; ")}`,
          )
          .join("\n\n") +
        `\n\n## Next Steps\n` +
        `Begin exploration using your assigned personas. For each scenario, call \`bazdmeg_fixer_report_finding\` when you discover issues.`
      );
    },
  });

  // ── bazdmeg_fixer_report_finding ─────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_fixer_report_finding",
    description: "Log a finding to the bugbook API and track it in the session",
    schema: {
      sessionId: zod.string(),
      agentId: zod.string(),
      personaId: zod.number(),
      serviceName: zod.string(),
      title: zod.string(),
      description: zod.string(),
      severity: zod.enum(["low", "medium", "high", "critical"]),
    },
    handler: async (args) => {
      let bugbookRes: { bugId: string };
      try {
        bugbookRes = (await fetchInternal("/internal/bugbook/report", {
          method: "POST",
          body: JSON.stringify({
            title: args.title,
            description: args.description,
            service_name: args.serviceName,
            severity: args.severity,
            userId: args.agentId,
          }),
        })) as { bugId: string };
      } catch (err) {
        return textResult(
          `ERROR: Bugbook API unreachable — finding logged locally but not linked to bugbook.\n` +
          `Error: ${err instanceof Error ? err.message : String(err)}\n\n` +
          `## Next Steps\n` +
          `Retry \`bazdmeg_fixer_report_finding\` or check API connectivity.`,
        );
      }

      const findingId = `fnd_${crypto.randomUUID().slice(0, 8)}`;

      await fetchInternal(`/internal/fixer/sessions/${args.sessionId}/findings`, {
        method: "POST",
        body: JSON.stringify({
          findingId,
          agentId: args.agentId,
          personaId: args.personaId,
          bugId: bugbookRes.bugId,
          title: args.title,
          severity: args.severity,
        }),
      });

      return textResult(
        `Finding reported and linked to Bug: ${bugbookRes.bugId} (Finding ID: ${findingId})\n\n` +
        `## Next Steps\n` +
        `Continue exploring with remaining scenarios, or call \`bazdmeg_fixer_quiz\` when exploration is complete.`,
      );
    },
  });

  // ── bazdmeg_fixer_quiz ───────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_fixer_quiz",
    description: "Submit quiz answers to advance a stage",
    schema: {
      sessionId: zod.string(),
      agentId: zod.string(),
      stage: zod.enum(["1_setup", "2_explore", "3_triage", "4_fix", "5_regression"]),
      answers: zod.array(zod.number()),
    },
    handler: async (args) => {
      const bank = QUIZ_BANK[args.stage as keyof typeof QUIZ_BANK];
      if (!bank) return textResult(`No quiz bank for stage ${args.stage}`);

      let correct = 0;
      args.answers.forEach((ans, i) => {
        if (bank[i] && bank[i].correctIndex === ans) {
          correct++;
        }
      });

      const passed = correct >= 2;

      await fetchInternal(`/internal/fixer/sessions/${args.sessionId}/quiz`, {
        method: "POST",
        body: JSON.stringify({
          agentId: args.agentId,
          stage: args.stage,
          score: correct,
          passed,
          answers: args.answers,
        }),
      });

      const stageIdx = STAGE_ORDER.indexOf(args.stage as typeof STAGE_ORDER[number]);
      const nextStageName = stageIdx >= 0 && stageIdx < STAGE_ORDER.length - 1
        ? STAGE_ORDER[stageIdx + 1]
        : "completed";

      let nextSteps: string;
      if (passed) {
        nextSteps =
          `## Next Steps\n` +
          `Call \`bazdmeg_fixer_advance\` to move to the next stage: "${nextStageName}".`;
      } else {
        nextSteps =
          `## Next Steps\n` +
          `Review the material and retry the quiz. You need 2/3 correct to pass.`;
      }

      return textResult(
        `Quiz Result for ${args.stage}: ${correct}/${bank.length} correct.\n` +
        `Status: ${passed ? "PASSED" : "FAILED"}\n\n` +
        nextSteps,
      );
    },
  });

  // ── bazdmeg_fixer_validate ───────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_fixer_validate",
    description: "Record a validation verdict for a fix",
    schema: {
      sessionId: zod.string(),
      bugId: zod.string(),
      validatorAgentId: zod.string(),
      verdict: zod.enum(["PASS", "FAIL"]),
      evidence: zod.string(),
    },
    handler: async (args) => {
      const validationId = `val_${crypto.randomUUID().slice(0, 8)}`;
      await fetchInternal(`/internal/fixer/sessions/${args.sessionId}/validations`, {
        method: "POST",
        body: JSON.stringify({
          validationId,
          bugId: args.bugId,
          validatorAgentId: args.validatorAgentId,
          verdict: args.verdict,
          evidence: args.evidence,
        }),
      });

      // Check pass count for this bug after recording
      const data = await fetchInternal<SessionResponse>(`/internal/fixer/sessions/${args.sessionId}`);
      const validations = data.validations || [];
      const passCount = validations.filter(
        (v) => v.bug_id === args.bugId && v.verdict === "PASS",
      ).length;

      let nextSteps: string;
      if (passCount >= 2) {
        nextSteps =
          `Bug ${args.bugId} has ${passCount} PASS validations — ready to ship!\n` +
          `Call \`bazdmeg_auto_ship\` to commit, push, and deploy the fix.`;
      } else {
        nextSteps =
          `Bug ${args.bugId} has ${passCount}/2 required PASS validations.\n` +
          `Another independent validator must also pass this fix.`;
      }

      return textResult(
        `Validation ${validationId} recorded as ${args.verdict} for bug ${args.bugId}.\n\n` +
        `## Next Steps\n` +
        nextSteps,
      );
    },
  });

  // ── bazdmeg_fixer_status ─────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_fixer_status",
    description: "Get current session status, bugs found, etc.",
    schema: {
      sessionId: zod.string(),
    },
    handler: async (args) => {
      const data = await fetchInternal<SessionResponse>(`/internal/fixer/sessions/${args.sessionId}`);
      const session = data.session;
      const agents = data.agents || [];
      const findings = data.findings || [];
      const validations = data.validations || [];
      const quizResults = data.quizzes || [];

      let md = `## Session: ${session.id}\n`;
      md += `**Stage**: ${session.stage} | **Target**: ${session.target} | **Created**: ${new Date(session.created_at as string).toISOString()}\n\n`;

      // Agents table
      md += `### Agents (${agents.length})\n`;
      if (agents.length > 0) {
        md += `| Agent | Role | Quiz | Findings |\n`;
        md += `|-------|------|------|----------|\n`;
        for (const a of agents) {
          md += `| ${a.agent_id} | ${a.role} | ${a.quiz_passed ? "Passed" : "Pending"} | ${a.findings_count ?? 0} |\n`;
        }
      } else {
        md += `_No agents assigned yet._\n`;
      }

      // Findings table
      md += `\n### Findings (${findings.length})\n`;
      if (findings.length > 0) {
        md += `| ID | Severity | Title | Bug ID | Agent |\n`;
        md += `|----|----------|-------|--------|-------|\n`;
        for (const f of findings) {
          md += `| ${f.finding_id} | ${f.severity} | ${f.title} | ${f.bug_id} | ${f.agent_id} |\n`;
        }
      } else {
        md += `_No findings reported yet._\n`;
      }

      // Validations table
      md += `\n### Validations (${validations.length})\n`;
      if (validations.length > 0) {
        md += `| Bug | Validator | Verdict | Evidence |\n`;
        md += `|-----|-----------|---------|----------|\n`;
        for (const v of validations) {
          md += `| ${v.bug_id} | ${v.validator_agent_id} | ${v.verdict} | ${v.evidence} |\n`;
        }
      } else {
        md += `_No validations recorded yet._\n`;
      }

      // Quiz results table
      md += `\n### Quiz Results (${quizResults.length})\n`;
      if (quizResults.length > 0) {
        md += `| Agent | Stage | Score | Passed |\n`;
        md += `|-------|-------|-------|--------|\n`;
        for (const q of quizResults) {
          md += `| ${q.agent_id} | ${q.stage} | ${q.score} | ${q.passed ? "Yes" : "No"} |\n`;
        }
      } else {
        md += `_No quiz results yet._\n`;
      }

      md += `\n## Next Steps\n`;
      md += `Based on current stage, proceed with stage-appropriate actions.`;

      return textResult(md);
    },
  });

  // ── bazdmeg_fixer_advance ────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_fixer_advance",
    description: "Advance the session to the next stage",
    schema: {
      sessionId: zod.string(),
      nextStage: zod.enum(["2_explore", "3_triage", "4_fix", "5_regression", "completed"]),
    },
    handler: async (args) => {
      // Validate stage transition
      const sessionData = await fetchInternal<SessionResponse>(`/internal/fixer/sessions/${args.sessionId}`);
      const currentStage = sessionData.session.stage as string;
      const currentIdx = STAGE_ORDER.indexOf(currentStage as typeof STAGE_ORDER[number]);
      const nextIdx = STAGE_ORDER.indexOf(args.nextStage as typeof STAGE_ORDER[number]);

      if (currentIdx === -1 || nextIdx === -1 || nextIdx !== currentIdx + 1) {
        return textResult(
          `ERROR: Invalid stage transition from "${currentStage}" to "${args.nextStage}". ` +
          `Expected next stage: "${STAGE_ORDER[currentIdx + 1] ?? "none"}".`,
        );
      }

      await fetchInternal(`/internal/fixer/sessions/${args.sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage: args.nextStage }),
      });

      const stageGuidance: Record<string, string> = {
        "2_explore": "Assign agents with `bazdmeg_fixer_assign_personas` and begin exploration.",
        "3_triage": "QA Experts should reproduce and confirm bugs. Log Monitors should correlate error logs.",
        "4_fix": "Apply fixes and submit for validation with `bazdmeg_fixer_validate`.",
        "5_regression": "Re-run all 16 scenarios against the Stage 2 baseline. Report regressions as new findings.",
        completed: "Session complete. Generate final report with `bazdmeg_fixer_report`.",
      };

      return textResult(
        `Session ${args.sessionId} advanced to stage ${args.nextStage}.\n\n` +
        `## Next Steps\n` +
        `Proceed with the activities for stage ${args.nextStage}. ${stageGuidance[args.nextStage] ?? ""}`,
      );
    },
  });

  // ── bazdmeg_fixer_report ─────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_fixer_report",
    description: "Generate final regression report comparing current findings with Stage 2 baseline",
    schema: {
      sessionId: zod.string(),
    },
    handler: async (args) => {
      const data = await fetchInternal<SessionResponse>(`/internal/fixer/sessions/${args.sessionId}`);
      const session = data.session;
      const findings = data.findings || [];
      const validations = data.validations || [];
      const agents = data.agents || [];

      // Group findings by severity
      const bySeverity: Record<string, unknown[]> = {};
      for (const f of findings) {
        const sev = (f.severity as string) || "unknown";
        if (!bySeverity[sev]) bySeverity[sev] = [];
        bySeverity[sev].push(f);
      }

      // Check which bugs have 2x PASS validations
      const validationsByBug: Record<string, string[]> = {};
      for (const v of validations) {
        const bugId = v.bug_id as string;
        if (v.verdict === "PASS") {
          if (!validationsByBug[bugId]) validationsByBug[bugId] = [];
          validationsByBug[bugId].push(v.validator_agent_id as string);
        }
      }

      const fixedBugs = Object.entries(validationsByBug).filter(
        ([, validators]) => validators.length >= 2,
      );
      const allBugIds = [...new Set(findings.map((f) => f.bug_id as string))];
      const remainingBugs = allBugIds.filter(
        (id) => !fixedBugs.some(([bugId]) => bugId === id),
      );

      let report = `## Fixer Session Report: ${args.sessionId}\n\n`;
      report += `**Stage**: ${session.stage} | **Target**: ${session.target}\n`;
      report += `**Created**: ${new Date(session.created_at as string).toISOString()}\n\n`;
      report += `### Summary\n`;
      report += `- Total findings: ${findings.length}\n`;
      report += `- Bugs fixed (2x validated): ${fixedBugs.length}\n`;
      report += `- Bugs remaining: ${remainingBugs.length}\n`;
      report += `- Agents participated: ${agents.length}\n\n`;

      report += `### By Severity\n`;
      for (const [sev, items] of Object.entries(bySeverity)) {
        report += `- **${sev}**: ${items.length}\n`;
      }

      report += `\n### Fixed Bugs\n`;
      if (fixedBugs.length === 0) {
        report += `_None_\n`;
      } else {
        for (const [bugId, validators] of fixedBugs) {
          report += `- ${bugId} (validated by: ${validators.join(", ")})\n`;
        }
      }

      report += `\n### Remaining Bugs\n`;
      if (remainingBugs.length === 0) {
        report += `_None — all bugs resolved!_\n`;
      } else {
        for (const bugId of remainingBugs) {
          report += `- ${bugId}\n`;
        }
      }

      report += `\n## Next Steps\n`;
      if (remainingBugs.length > 0) {
        report += `${remainingBugs.length} bugs still need fixes. Continue in Stage 4 or escalate.`;
      } else {
        report += `All bugs resolved. Call \`bazdmeg_fixer_advance\` to mark session as completed.`;
      }

      return textResult(report);
    },
  });

  // ── bazdmeg_fixer_cancel ─────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_fixer_cancel",
    description: "Cancel/abort a fixer session",
    schema: {
      sessionId: zod.string(),
      reason: zod.string().optional(),
    },
    handler: async (args) => {
      await fetchInternal(`/internal/fixer/sessions/${args.sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage: "cancelled" }),
      });
      return textResult(
        `## Session Cancelled: ${args.sessionId}\n\n` +
        (args.reason ? `**Reason**: ${args.reason}\n\n` : "") +
        `## Next Steps\n` +
        `Start a new session with \`bazdmeg_fixer_start\` if needed.`,
      );
    },
  });

  // ── bazdmeg_fixer_my_assignment ──────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_fixer_my_assignment",
    description: "Get your own assignment details — role, personas, quiz status, findings count",
    schema: {
      sessionId: zod.string(),
      agentId: zod.string(),
    },
    handler: async (args) => {
      const data = await fetchInternal<SessionResponse>(`/internal/fixer/sessions/${args.sessionId}`);
      const agents = data.agents || [];
      const agent = agents.find((a) => a.agent_id === args.agentId);
      if (!agent) {
        return textResult(
          `ERROR: Agent "${args.agentId}" not found in session "${args.sessionId}".`,
        );
      }

      const findings = (data.findings || []).filter(
        (f) => f.agent_id === args.agentId,
      );

      let result = `## Your Assignment\n\n`;
      result += `**Role**: ${agent.role}\n`;
      result += `**Quiz Passed**: ${agent.quiz_passed ? "Yes" : "No"}\n`;
      result += `**Findings Reported**: ${agent.findings_count}\n`;

      const personas = JSON.parse((agent.personas as string) || "[]") as number[];
      if (personas.length > 0) {
        result += `**Personas**: ${personas.join(", ")}\n`;
      }

      if (findings.length > 0) {
        result += `\n### Your Findings\n`;
        for (const f of findings) {
          result += `- [${f.severity}] ${f.title} (Bug: ${f.bug_id})\n`;
        }
      }

      result += `\n## Next Steps\n`;
      result += `Check session status with \`bazdmeg_fixer_status\` or continue with stage-appropriate work.`;

      return textResult(result);
    },
  });
}
