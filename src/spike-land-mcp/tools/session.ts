/**
 * Distributed Coding Session MCP Tools
 *
 * Create and manage distributed coding sessions with role-based agents.
 * Ported from spike.land — in-memory session state.
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, jsonResult } from "../procedures/index";
import type { DrizzleDB } from "../db/index";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CodingSession {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: "planning" | "coding" | "reviewing" | "merging" | "completed" | "failed";
  planId?: string;
  roles: Array<{ role: string; agentId?: string; status: string }>;
  events: Array<{
    id: string;
    timestamp: string;
    type: string;
    message: string;
    role?: string;
    subtaskId?: string;
  }>;
  config: {
    maxIterations: number;
    timeoutMs: number;
    autoDispatch: boolean;
    requireReview: boolean;
  };
  metrics: {
    totalTokensIn: number;
    totalTokensOut: number;
    codeGenCalls: number;
    passRate: number;
    iterations: number;
  };
  createdAt: string;
  completedAt?: string;
}

// ─── In-memory storage ───────────────────────────────────────────────────────

const sessions = new Map<string, CodingSession>();

export function clearSessions(): void {
  sessions.clear();
}

// ─── Registration ────────────────────────────────────────────────────────────

const SessionStatusEnum = z.enum([
  "planning",
  "coding",
  "reviewing",
  "merging",
  "completed",
  "failed",
]);

const RoleEnum = z.enum([
  "planner",
  "coder",
  "reviewer",
  "tester",
  "architect",
  "security_analyst",
  "devops",
  "tech_lead",
  "documenter",
  "qa_engineer",
  "product_manager",
  "ux_designer",
  "data_engineer",
  "performance_engineer",
  "integration_tester",
  "release_manager",
]);

export function registerSessionTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool("session_create", "Create a new distributed coding session.", {
        name: z.string().describe("Session name."),
        description: z.string().describe("Session description."),
        plan_id: z.string().optional().describe("Optional orchestrator plan ID."),
        config: z
          .object({
            maxIterations: z.number().optional(),
            timeoutMs: z.number().optional(),
            autoDispatch: z.boolean().optional(),
            requireReview: z.boolean().optional(),
          })
          .optional()
          .describe("Session configuration."),
      })
      .meta({ category: "session", tier: "free" })
      .handler(async ({ input }) => {
        const id = crypto.randomUUID();
        const session: CodingSession = {
          id,
          userId,
          name: input.name,
          description: input.description,
          status: "planning",
          ...(input.plan_id !== undefined ? { planId: input.plan_id } : {}),
          roles: [],
          events: [],
          config: {
            maxIterations: input.config?.maxIterations ?? 5,
            timeoutMs: input.config?.timeoutMs ?? 300000,
            autoDispatch: input.config?.autoDispatch ?? false,
            requireReview: input.config?.requireReview ?? true,
          },
          metrics: {
            totalTokensIn: 0,
            totalTokensOut: 0,
            codeGenCalls: 0,
            passRate: 0,
            iterations: 0,
          },
          createdAt: new Date().toISOString(),
        };
        sessions.set(id, session);
        return jsonResult(`Session ${input.name} created`, session);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("session_get", "Get details of a specific coding session.", {
        session_id: z.string().describe("Session ID."),
      })
      .meta({ category: "session", tier: "free" })
      .handler(async ({ input }) => {
        const session = sessions.get(input.session_id);
        if (!session) throw new Error(`Session ${input.session_id} not found`);
        return jsonResult(`Session details for ${input.session_id}`, session);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("session_list", "List coding sessions with optional filtering.", {
        status: SessionStatusEnum.optional().describe("Filter by status."),
        limit: z.number().optional().describe("Max results (default 10)."),
      })
      .meta({ category: "session", tier: "free" })
      .handler(async ({ input }) => {
        const limit = input.limit ?? 10;
        let list = Array.from(sessions.values());
        if (input.status) list = list.filter((s) => s.status === input.status);
        list = list.sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, limit);
        return jsonResult(`Found ${list.length} session(s)`, list);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("session_assign_role", "Assign an agent role to a session.", {
        session_id: z.string().describe("Session ID."),
        role: RoleEnum.describe("Agent role."),
        agent_id: z.string().optional().describe("Agent ID."),
      })
      .meta({ category: "session", tier: "free" })
      .handler(async ({ input }) => {
        const session = sessions.get(input.session_id);
        if (!session) throw new Error(`Session ${input.session_id} not found`);
        const agentId = input.agent_id || "agent-" + crypto.randomUUID().substring(0, 5);
        const existing = session.roles.find((r) => r.role === input.role);
        if (existing) existing.agentId = agentId;
        else session.roles.push({ role: input.role, agentId, status: "idle" });
        return jsonResult(
          `Role ${input.role} assigned/updated in session ${input.session_id}`,
          session.roles,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("session_log_event", "Log an event or activity in a session.", {
        session_id: z.string().describe("Session ID."),
        type: z.string().describe("Event type."),
        message: z.string().describe("Event message."),
        agent_id: z.string().optional().describe("Agent ID."),
        subtask_id: z.string().optional().describe("Subtask ID."),
      })
      .meta({ category: "session", tier: "free" })
      .handler(async ({ input }) => {
        const session = sessions.get(input.session_id);
        if (!session) throw new Error(`Session ${input.session_id} not found`);
        const event = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          type: input.type,
          message: input.message,
          ...(input.agent_id !== undefined ? { role: input.agent_id } : {}),
          ...(input.subtask_id !== undefined ? { subtaskId: input.subtask_id } : {}),
        };
        session.events.push(event);
        return jsonResult(`Event logged in session ${input.session_id}`, event);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("session_update_status", "Update the operational status of a session.", {
        session_id: z.string().describe("Session ID."),
        status: SessionStatusEnum.describe("New status."),
      })
      .meta({ category: "session", tier: "free" })
      .handler(async ({ input }) => {
        const session = sessions.get(input.session_id);
        if (!session) throw new Error(`Session ${input.session_id} not found`);
        session.status = input.status;
        return jsonResult(`Session ${input.session_id} status updated to ${input.status}`, {
          status: session.status,
        });
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("session_get_metrics", "Get performance and progress metrics for a session.", {
        session_id: z.string().describe("Session ID."),
      })
      .meta({ category: "session", tier: "free" })
      .handler(async ({ input }) => {
        const session = sessions.get(input.session_id);
        if (!session) throw new Error(`Session ${input.session_id} not found`);
        return jsonResult(`Metrics for session ${input.session_id}`, session.metrics);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("session_close", "Close a session and finalize its reports.", {
        session_id: z.string().describe("Session ID."),
        summary: z.string().describe("Closing summary."),
      })
      .meta({ category: "session", tier: "free" })
      .handler(async ({ input }) => {
        const session = sessions.get(input.session_id);
        if (!session) throw new Error(`Session ${input.session_id} not found`);
        session.status = "completed";
        session.completedAt = new Date().toISOString();
        session.events.push({
          id: "close",
          timestamp: session.completedAt,
          type: "session_closed",
          message: input.summary,
        });
        return jsonResult(`Session ${input.session_id} closed`, session);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "session_dispatch_task",
        "Dispatch a subtask to a specific agent role in the session.",
        {
          session_id: z.string().describe("Session ID."),
          role: z.string().describe("Target agent role."),
          task: z.string().describe("Task description."),
          context: z.array(z.string()).optional().describe("Context files or references."),
          priority: z
            .enum(["low", "normal", "high", "critical"])
            .optional()
            .describe("Priority level."),
        },
      )
      .meta({ category: "session", tier: "free" })
      .handler(async ({ input }) => {
        const session = sessions.get(input.session_id);
        if (!session) throw new Error(`Session ${input.session_id} not found`);
        const roleEntry = session.roles.find((r) => r.role === input.role);
        if (!roleEntry)
          throw new Error(`Role ${input.role} not assigned in session ${input.session_id}`);
        const taskId = crypto.randomUUID();
        roleEntry.status = "busy";
        session.events.push({
          id: taskId,
          timestamp: new Date().toISOString(),
          type: "task_dispatched",
          message: input.task,
          role: input.role,
          subtaskId: taskId,
        });
        return jsonResult(`Task dispatched to ${input.role} in session ${input.session_id}`, {
          taskId,
          role: input.role,
          task: input.task,
          priority: input.priority ?? "normal",
          context: input.context ?? [],
        });
      }),
  );
}
