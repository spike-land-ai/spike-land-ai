import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { jsonResult, safeToolCall } from "./tool-helpers";

export interface MCPTool {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (args: unknown) => Promise<CallToolResult>;
}

// In-memory state for distributed coding sessions (following orchestrator.ts pattern)
interface CodingSession {
  id: string;
  userId: string;
  name: string;
  description: string;
  status:
    | "planning"
    | "coding"
    | "reviewing"
    | "merging"
    | "completed"
    | "failed";
  planId?: string;
  sandboxId?: string;
  roles: Array<{ role: string; agentId?: string; status: string; }>;
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

const sessions = new Map<string, CodingSession>();

export const sessionTools: MCPTool[] = [
  {
    name: "session_create",
    description: "Create a new distributed coding session",
    schema: z.object({
      name: z.string().describe("Session name"),
      description: z.string().describe("Session description"),
      plan_id: z.string().optional().describe("Optional orchestrator plan ID"),
      config: z
        .object({
          maxIterations: z.number().optional(),
          timeoutMs: z.number().optional(),
          autoDispatch: z.boolean().optional(),
          requireReview: z.boolean().optional(),
        })
        .optional(),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        name: string;
        description: string;
        plan_id?: string;
        config?: {
          maxIterations?: number;
          timeoutMs?: number;
          autoDispatch?: boolean;
          requireReview?: boolean;
        };
      };
      return safeToolCall("session_create", async () => {
        const id = Math.random().toString(36).substring(2, 11);
        const session: CodingSession = {
          id,
          userId: "system",
          name: a.name,
          description: a.description,
          status: "planning",
          planId: a.plan_id,
          roles: [],
          events: [],
          config: {
            maxIterations: a.config?.maxIterations ?? 5,
            timeoutMs: a.config?.timeoutMs ?? 300000,
            autoDispatch: a.config?.autoDispatch ?? false,
            requireReview: a.config?.requireReview ?? true,
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
        return jsonResult(`Session ${a.name} created`, session);
      });
    },
  },
  {
    name: "session_get",
    description: "Get details of a specific coding session",
    schema: z.object({
      session_id: z.string().describe("The ID of the session to retrieve"),
    }),
    handler: async (args: unknown) => {
      const a = args as { session_id: string; };
      return safeToolCall("session_get", async () => {
        const session = sessions.get(a.session_id);
        if (!session) throw new Error(`Session ${a.session_id} not found`);
        return jsonResult(`Session details for ${a.session_id}`, session);
      });
    },
  },
  {
    name: "session_list",
    description: "List coding sessions with optional filtering",
    schema: z.object({
      status: z.enum([
        "planning",
        "coding",
        "reviewing",
        "merging",
        "completed",
        "failed",
      ]).optional(),
      limit: z.number().optional().default(10),
    }),
    handler: async (args: unknown) => {
      const a = args as { status?: CodingSession["status"]; limit: number; };
      return safeToolCall("session_list", async () => {
        let list = Array.from(sessions.values());
        if (a.status) {
          list = list.filter(s => s.status === a.status);
        }
        list = list.sort((x, y) => y.createdAt.localeCompare(x.createdAt))
          .slice(0, a.limit);
        return jsonResult(`Found ${list.length} session(s)`, list);
      });
    },
  },
  {
    name: "session_assign_role",
    description: "Assign an agent role to a session",
    schema: z.object({
      session_id: z.string(),
      role: z.enum([
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
      ]),
      agent_id: z.string().optional(),
    }),
    handler: async (args: unknown) => {
      const a = args as { session_id: string; role: string; agent_id?: string; };
      return safeToolCall("session_assign_role", async () => {
        const session = sessions.get(a.session_id);
        if (!session) throw new Error(`Session ${a.session_id} not found`);
        const existing = session.roles.find(r => r.role === a.role);
        if (existing) {
          existing.agentId = a.agent_id
            || "agent-" + Math.random().toString(36).substring(2, 5);
        } else {
          session.roles.push({
            role: a.role,
            agentId: a.agent_id
              || "agent-" + Math.random().toString(36).substring(2, 5),
            status: "idle",
          });
        }
        return jsonResult(
          `Role ${a.role} assigned/updated in session ${a.session_id}`,
          session.roles,
        );
      });
    },
  },
  {
    name: "session_log_event",
    description: "Log an event or activity in a session",
    schema: z.object({
      session_id: z.string(),
      type: z.string(),
      message: z.string(),
      agent_id: z.string().optional(),
      subtask_id: z.string().optional(),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        session_id: string;
        type: string;
        message: string;
        agent_id?: string;
        subtask_id?: string;
      };
      return safeToolCall("session_log_event", async () => {
        const session = sessions.get(a.session_id);
        if (!session) throw new Error(`Session ${a.session_id} not found`);
        const event = {
          id: Math.random().toString(36).substring(2, 11),
          timestamp: new Date().toISOString(),
          type: a.type,
          message: a.message,
          role: a.agent_id,
          subtaskId: a.subtask_id,
        };
        session.events.push(event);
        return jsonResult(`Event logged in session ${a.session_id}`, event);
      });
    },
  },
  {
    name: "session_update_status",
    description: "Update the operational status of a session",
    schema: z.object({
      session_id: z.string(),
      status: z.enum([
        "planning",
        "coding",
        "reviewing",
        "merging",
        "completed",
        "failed",
      ]),
    }),
    handler: async (args: unknown) => {
      const a = args as { session_id: string; status: CodingSession["status"]; };
      return safeToolCall("session_update_status", async () => {
        const session = sessions.get(a.session_id);
        if (!session) throw new Error(`Session ${a.session_id} not found`);
        session.status = a.status;
        return jsonResult(
          `Session ${a.session_id} status updated to ${a.status}`,
          { status: session.status },
        );
      });
    },
  },
  {
    name: "session_get_metrics",
    description: "Get performance and progress metrics for a session",
    schema: z.object({
      session_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { session_id: string; };
      return safeToolCall("session_get_metrics", async () => {
        const session = sessions.get(a.session_id);
        if (!session) throw new Error(`Session ${a.session_id} not found`);
        return jsonResult(
          `Metrics for session ${a.session_id}`,
          session.metrics,
        );
      });
    },
  },
  {
    name: "session_close",
    description: "Close a session and finalize its reports",
    schema: z.object({
      session_id: z.string(),
      summary: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { session_id: string; summary: string; };
      return safeToolCall("session_close", async () => {
        const session = sessions.get(a.session_id);
        if (!session) throw new Error(`Session ${a.session_id} not found`);
        session.status = "completed";
        session.completedAt = new Date().toISOString();
        session.events.push({
          id: "close",
          timestamp: session.completedAt,
          type: "session_closed",
          message: a.summary,
        });
        return jsonResult(`Session ${a.session_id} closed`, session);
      });
    },
  },
  {
    name: "session_dispatch_task",
    description: "Dispatch a subtask to a specific agent role in the session",
    schema: z.object({
      session_id: z.string(),
      role: z.string().describe("Target agent role"),
      task: z.string().describe("Task description"),
      context: z.array(z.string()).optional().describe(
        "Context files or references",
      ),
      priority: z.enum(["low", "normal", "high", "critical"]).optional()
        .default("normal"),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        session_id: string;
        role: string;
        task: string;
        context?: string[];
        priority: string;
      };
      return safeToolCall("session_dispatch_task", async () => {
        const session = sessions.get(a.session_id);
        if (!session) throw new Error(`Session ${a.session_id} not found`);
        const roleEntry = session.roles.find(r => r.role === a.role);
        if (!roleEntry) {
          throw new Error(
            `Role ${a.role} not assigned in session ${a.session_id}`,
          );
        }

        const taskId = Math.random().toString(36).substring(2, 11);
        roleEntry.status = "busy";
        session.events.push({
          id: taskId,
          timestamp: new Date().toISOString(),
          type: "task_dispatched",
          message: a.task,
          role: a.role,
          subtaskId: taskId,
        });

        return jsonResult(
          `Task dispatched to ${a.role} in session ${a.session_id}`,
          {
            taskId,
            role: a.role,
            task: a.task,
            priority: a.priority,
            context: a.context ?? [],
          },
        );
      });
    },
  },
];
