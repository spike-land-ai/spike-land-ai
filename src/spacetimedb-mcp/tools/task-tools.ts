/**
 * Task Tools — Create, list, claim, and complete coordination tasks.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpacetimeClient } from "../client.js";
import { errorResult, jsonResult, tryCatch } from "../types.js";

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
      const result = await tryCatch(client.createTask(description, priority, context));
      if (!result.ok) return errorResult("REDUCER_FAILED", result.error.message, true);
      return jsonResult({ created: true, description, priority });
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
      const result = await tryCatch(
        (async () => client.listTasks(status))(),
      );
      if (!result.ok) return errorResult("QUERY_FAILED", result.error.message, false);
      return jsonResult({
        count: result.data.length,
        tasks: result.data.map((t) => ({
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
      const result = await tryCatch(client.claimTask(BigInt(taskId)));
      if (!result.ok) return errorResult("REDUCER_FAILED", result.error.message, true);
      return jsonResult({ claimed: true, taskId });
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
      const result = await tryCatch(client.completeTask(BigInt(taskId)));
      if (!result.ok) return errorResult("REDUCER_FAILED", result.error.message, true);
      return jsonResult({ completed: true, taskId });
    },
  );
}
