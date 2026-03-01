/**
 * Task coordination MCP tools — create, list, claim, and complete tasks.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpacetimeClient } from "../client.js";
import { errorResult, jsonResult } from "../types.js";

export function registerTaskTools(
  server: McpServer,
  client: SpacetimeClient,
): void {
  // ─── stdb_create_task ───

  server.tool(
    "stdb_create_task",
    "Create a new task for agent coordination",
    {
      description: z.string().min(1).describe("Task description"),
      priority: z.number().int().min(0).max(255).default(128).describe("Priority (0=highest, 255=lowest)"),
      context: z.string().default("").describe("Additional context or metadata (JSON string)"),
    },
    async ({ description, priority, context }) => {
      try {
        await client.createTask(description, priority, context);
        return jsonResult({
          created: true,
          description,
          priority,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", message, false);
        }
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_list_tasks ───

  server.tool(
    "stdb_list_tasks",
    "List tasks with optional status filter",
    {
      status: z
        .enum(["pending", "in_progress", "completed"])
        .optional()
        .describe("Filter by task status"),
    },
    async ({ status }) => {
      try {
        const tasks = client.listTasks(status);
        return jsonResult({
          count: tasks.length,
          tasks: tasks.map((t) => ({
            id: t.id.toString(),
            description: t.description,
            assignedTo: t.assignedTo ?? null,
            status: t.status,
            priority: t.priority,
            context: t.context,
            createdBy: t.createdBy,
            createdAt: t.createdAt.toString(),
          })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", message, false);
        }
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_claim_task ───

  server.tool(
    "stdb_claim_task",
    "Claim an unassigned pending task (sets status to in_progress)",
    {
      taskId: z.string().describe("Task ID to claim"),
    },
    async ({ taskId }) => {
      try {
        await client.claimTask(BigInt(taskId));
        return jsonResult({
          claimed: true,
          taskId,
          assignedTo: client.getState().identity,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", message, false);
        }
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_complete_task ───

  server.tool(
    "stdb_complete_task",
    "Mark a task as completed (must be assigned to you)",
    {
      taskId: z.string().describe("Task ID to complete"),
    },
    async ({ taskId }) => {
      try {
        await client.completeTask(BigInt(taskId));
        return jsonResult({
          completed: true,
          taskId,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) {
          return errorResult("NOT_CONNECTED", message, false);
        }
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );
}
