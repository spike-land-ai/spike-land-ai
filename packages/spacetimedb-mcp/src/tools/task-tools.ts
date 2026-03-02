/**
 * Task Tools — Create, list, claim, and complete coordination tasks.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpacetimeClient } from "../client.js";
import { errorResult, jsonResult } from "../types.js";

export function registerTaskTools(server: McpServer, client: SpacetimeClient): void {
  // ─── stdb_create_task ───

  server.tool(
    "stdb_create_task",
    "Create a new coordination task",
    {
      description: z.string().describe("Task description"),
      priority: z.number().int().describe("Priority (lower = higher priority)"),
      context: z.string().describe("JSON context for the task"),
    },
    async ({ description, priority, context }) => {
      const state = client.getState();
      if (!state.connected) {
        return errorResult("NOT_CONNECTED", "Not connected to SpacetimeDB", false);
      }
      try {
        await client.createTask(description, priority, context);
        return jsonResult({ created: true, description, priority });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_list_tasks ───

  server.tool(
    "stdb_list_tasks",
    "List tasks, optionally filtered by status",
    {
      status: z.string().optional().describe("Status filter: pending, in_progress, completed"),
    },
    async ({ status }) => {
      const state = client.getState();
      if (!state.connected) {
        return errorResult("NOT_CONNECTED", "Not connected to SpacetimeDB", false);
      }
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
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_claim_task ───

  server.tool(
    "stdb_claim_task",
    "Claim an unassigned pending task",
    {
      taskId: z.string().describe("Task ID to claim"),
    },
    async ({ taskId }) => {
      const state = client.getState();
      if (!state.connected) {
        return errorResult("NOT_CONNECTED", "Not connected to SpacetimeDB", false);
      }
      try {
        await client.claimTask(BigInt(taskId));
        return jsonResult({ claimed: true, taskId });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_complete_task ───

  server.tool(
    "stdb_complete_task",
    "Mark a task as completed",
    {
      taskId: z.string().describe("Task ID to complete"),
    },
    async ({ taskId }) => {
      const state = client.getState();
      if (!state.connected) {
        return errorResult("NOT_CONNECTED", "Not connected to SpacetimeDB", false);
      }
      try {
        await client.completeTask(BigInt(taskId));
        return jsonResult({ completed: true, taskId });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );
}
