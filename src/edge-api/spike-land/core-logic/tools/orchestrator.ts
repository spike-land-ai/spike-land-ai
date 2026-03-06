/**
 * Orchestrator MCP Tools (CF Workers)
 *
 * Tools for creating execution plans, dispatching subtasks,
 * tracking status, submitting results, and merging final output.
 *
 * Runs on Cloudflare Workers. Uses in-memory plan storage.
 * No DB or Docker dependencies.
 */

import { z } from "zod";
import type { ToolRegistry } from "../../lazy-imports/registry";
import { freeTool, textResult } from "../../lazy-imports/procedures-index.ts";
import { safeToolCall } from "../lib/tool-helpers";
import type { DrizzleDB } from "../../db/db/db-index.ts";

interface Subtask {
  id: string;
  description: string;
  status: "pending" | "dispatched" | "running" | "completed" | "failed";
  dependencies: string[];
  result?: string;
  error?: string;
  dispatchedAt?: number;
  completedAt?: number;
}

interface Plan {
  id: string;
  userId: string;
  description: string;
  context?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  subtasks: Subtask[];
  createdAt: number;
  completedAt?: number;
}

const plans = new Map<string, Plan>();

/** Exported for testing — clears all in-memory plans. */
export function clearPlans(): void {
  plans.clear();
}

/**
 * Topological sort of subtasks by their dependencies.
 */
function topologicalSort(subtasks: Subtask[]): Subtask[] {
  const byId = new Map<string, Subtask>();
  for (const st of subtasks) {
    byId.set(st.id, st);
  }

  const visited = new Set<string>();
  const result: Subtask[] = [];

  function visit(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    const st = byId.get(id);
    if (!st) return;
    for (const dep of st.dependencies) {
      visit(dep);
    }
    result.push(st);
  }

  for (const st of subtasks) {
    visit(st.id);
  }

  return result;
}

export function registerOrchestratorTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // orchestrator_create_plan
  registry.registerBuilt(
    t
      .tool(
        "orchestrator_create_plan",
        "Create an execution plan from a task description with ordered subtasks and dependency tracking.",
        {
          description: z.string().min(1).describe("High-level task description"),
          subtasks: z
            .array(
              z.object({
                description: z.string().min(1).describe("Subtask description"),
                dependencies: z
                  .array(z.string())
                  .optional()
                  .describe("IDs of subtasks this depends on (e.g. subtask-1)"),
              }),
            )
            .min(1)
            .describe("List of subtasks to execute"),
          context: z.string().optional().describe("Optional repo/project context"),
        },
      )
      .meta({ category: "orchestrator", tier: "free" })
      .handler(async ({ input }) => {
        const { description, subtasks, context } = input;

        return safeToolCall("orchestrator_create_plan", async () => {
          const planId = crypto.randomUUID();
          const subtaskList: Subtask[] = subtasks.map((st, idx) => ({
            id: `subtask-${idx + 1}`,
            description: st.description,
            status: "pending" as const,
            dependencies: st.dependencies ?? [],
          }));

          // Validate that all dependency references exist
          const validIds = new Set(subtaskList.map((s) => s.id));
          for (const st of subtaskList) {
            for (const dep of st.dependencies) {
              if (!validIds.has(dep)) {
                throw new Error(`Subtask "${st.id}" references unknown dependency "${dep}"`);
              }
            }
          }

          const plan: Plan = {
            id: planId,
            userId,
            description,
            ...(context !== undefined ? { context } : {}),
            status: "pending",
            subtasks: subtaskList,
            createdAt: Date.now(),
          };

          plans.set(planId, plan);

          let text = `**Plan Created**\n\n`;
          text += `- **Plan ID:** \`${planId}\`\n`;
          text += `- **Status:** ${plan.status}\n`;
          text += `- **Subtasks:** ${subtaskList.length}\n\n`;
          for (const st of subtaskList) {
            const deps =
              st.dependencies.length > 0 ? ` (depends on: ${st.dependencies.join(", ")})` : "";
            text += `- \`${st.id}\`: ${st.description} [${st.status}]${deps}\n`;
          }

          return textResult(text);
        });
      }),
  );

  // orchestrator_dispatch
  registry.registerBuilt(
    t
      .tool(
        "orchestrator_dispatch",
        "Mark a plan's ready subtasks as dispatched. Only subtasks whose dependencies are all completed will be dispatched.",
        {
          plan_id: z.string().min(1).describe("The plan ID"),
        },
      )
      .meta({ category: "orchestrator", tier: "free" })
      .handler(async ({ input }) => {
        const { plan_id } = input;

        return safeToolCall("orchestrator_dispatch", async () => {
          const plan = plans.get(plan_id);
          if (!plan) throw new Error(`Plan "${plan_id}" not found`);
          if (plan.userId !== userId) {
            throw new Error("Unauthorized: you do not own this plan");
          }

          const completedIds = new Set(
            plan.subtasks.filter((s) => s.status === "completed").map((s) => s.id),
          );

          const dispatched: string[] = [];
          for (const st of plan.subtasks) {
            if (st.status !== "pending") continue;
            const allDepsCompleted = st.dependencies.every((dep) => completedIds.has(dep));
            if (allDepsCompleted) {
              st.status = "dispatched";
              st.dispatchedAt = Date.now();
              dispatched.push(st.id);
            }
          }

          if (dispatched.length > 0 && plan.status === "pending") {
            plan.status = "in_progress";
          }

          let text: string;
          if (dispatched.length === 0) {
            text = `**No subtasks ready for dispatch.**\nAll pending subtasks have unmet dependencies.`;
          } else {
            text = `**Dispatched ${dispatched.length} subtask(s):**\n\n`;
            for (const id of dispatched) {
              const st = plan.subtasks.find((s) => s.id === id)!;
              text += `- \`${id}\`: ${st.description}\n`;
            }
          }

          return textResult(text);
        });
      }),
  );

  // orchestrator_status
  registry.registerBuilt(
    t
      .tool("orchestrator_status", "Get current status of all subtasks in a plan.", {
        plan_id: z.string().min(1).describe("The plan ID"),
      })
      .meta({ category: "orchestrator", tier: "free" })
      .handler(async ({ input }) => {
        const { plan_id } = input;

        return safeToolCall("orchestrator_status", async () => {
          const plan = plans.get(plan_id);
          if (!plan) throw new Error(`Plan "${plan_id}" not found`);
          if (plan.userId !== userId) {
            throw new Error("Unauthorized: you do not own this plan");
          }

          let text = `**Plan Status: ${plan.status}**\n\n`;
          text += `- **Description:** ${plan.description}\n`;
          text += `- **Created:** ${new Date(plan.createdAt).toISOString()}\n`;
          if (plan.completedAt) {
            text += `- **Completed:** ${new Date(plan.completedAt).toISOString()}\n`;
          }
          text += `\n**Subtasks:**\n\n`;

          for (const st of plan.subtasks) {
            let line = `- \`${st.id}\` [${st.status}]: ${st.description}`;
            if (st.result) {
              line += ` — Result: ${st.result.slice(0, 100)}${st.result.length > 100 ? "..." : ""}`;
            }
            if (st.error) {
              line += ` — Error: ${st.error}`;
            }
            text += `${line}\n`;
          }

          return textResult(text);
        });
      }),
  );

  // orchestrator_submit_result
  registry.registerBuilt(
    t
      .tool(
        "orchestrator_submit_result",
        "Submit the result of a completed subtask. Updates subtask status and may auto-complete or auto-fail the plan.",
        {
          plan_id: z.string().min(1).describe("The plan ID"),
          subtask_id: z.string().min(1).describe("The subtask ID"),
          status: z.enum(["completed", "failed"]).describe("Result status"),
          result: z.string().describe("The result text"),
          error: z.string().optional().describe("Error message if failed"),
        },
      )
      .meta({ category: "orchestrator", tier: "free" })
      .handler(async ({ input }) => {
        const { plan_id, subtask_id, status, result, error } = input;

        return safeToolCall("orchestrator_submit_result", async () => {
          const plan = plans.get(plan_id);
          if (!plan) throw new Error(`Plan "${plan_id}" not found`);
          if (plan.userId !== userId) {
            throw new Error("Unauthorized: you do not own this plan");
          }

          const subtask = plan.subtasks.find((s) => s.id === subtask_id);
          if (!subtask) {
            throw new Error(`Subtask "${subtask_id}" not found in plan "${plan_id}"`);
          }

          subtask.status = status;
          subtask.result = result;
          subtask.completedAt = Date.now();
          if (error) subtask.error = error;

          const allCompleted = plan.subtasks.every((s) => s.status === "completed");
          const anyFailed = plan.subtasks.some((s) => s.status === "failed");

          if (allCompleted) {
            plan.status = "completed";
            plan.completedAt = Date.now();
          } else if (anyFailed) {
            plan.status = "failed";
          } else if (plan.status === "pending") {
            plan.status = "in_progress";
          }

          let text = `**Subtask Updated**\n\n`;
          text += `- **Subtask:** \`${subtask_id}\` → ${status}\n`;
          text += `- **Plan Status:** ${plan.status}\n`;
          if (result) {
            text += `- **Result:** ${result.slice(0, 200)}${result.length > 200 ? "..." : ""}\n`;
          }
          if (error) {
            text += `- **Error:** ${error}\n`;
          }

          return textResult(text);
        });
      }),
  );

  // orchestrator_merge
  registry.registerBuilt(
    t
      .tool(
        "orchestrator_merge",
        "Merge all completed subtask results into a final output in dependency order.",
        {
          plan_id: z.string().min(1).describe("The plan ID"),
        },
      )
      .meta({ category: "orchestrator", tier: "free" })
      .handler(async ({ input }) => {
        const { plan_id } = input;

        return safeToolCall("orchestrator_merge", async () => {
          const plan = plans.get(plan_id);
          if (!plan) throw new Error(`Plan "${plan_id}" not found`);
          if (plan.userId !== userId) {
            throw new Error("Unauthorized: you do not own this plan");
          }

          if (plan.status !== "completed") {
            throw new Error(
              `Plan is not completed (status: ${plan.status}). Cannot merge until all subtasks are done.`,
            );
          }

          const sorted = topologicalSort(plan.subtasks);
          const merged = sorted
            .map((st) => `## ${st.id}: ${st.description}\n\n${st.result ?? ""}`)
            .join("\n\n---\n\n");

          let text = `**Merged Output for Plan \`${plan_id}\`**\n\n`;
          text += merged;

          return textResult(text);
        });
      }),
  );
}
