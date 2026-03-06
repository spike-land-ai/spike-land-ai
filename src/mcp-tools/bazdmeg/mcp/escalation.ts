/**
 * Escalation Tools
 *
 * MCP tool for stuck signal — agents declare when they're blocked.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createZodTool, textResult } from "@spike-land-ai/mcp-server-base";
import { writeFile } from "node:fs/promises";
import { SignalStuckSchema } from "../core-logic/types.js";
import type { StuckSignal } from "../core-logic/types.js";
import type { z } from "zod";
import { getWorkspace } from "../node-sys/workspace-state.js";
import { logStuckSignal } from "../node-sys/telemetry.js";

export function registerEscalationTools(server: McpServer): void {
  // ── bazdmeg_signal_stuck ─────────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_signal_stuck",
    description:
      "Declare that you are stuck — writes signal file and logs to telemetry for overseeing agent",
    schema: SignalStuckSchema.shape,
    handler: async ({ reason, attemptedAction, suggestedContext }: z.infer<typeof SignalStuckSchema>) => {

      const workspace = getWorkspace();
      const timestamp = new Date().toISOString();

      const signal: StuckSignal = {
        packageName: workspace?.packageName ?? null,
        reason,
        attemptedAction,
        suggestedContext,
        timestamp,
        contextServed: [], // Could be enriched from context log
        allowedPaths: workspace?.allowedPaths ?? [],
      };

      // Write stuck signal file
      const safeTimestamp = timestamp.replace(/[:.]/g, "-");
      const signalPath = `/tmp/bazdmeg-stuck-${safeTimestamp}.json`;
      await writeFile(signalPath, JSON.stringify(signal, null, 2));

      // Log to telemetry
      await logStuckSignal(workspace?.packageName ?? null, reason, attemptedAction);

      const suggestions: string[] = [];
      if (workspace) {
        suggestions.push(
          `Check if the needed file is in a dependency not listed in ${workspace.packageName}/package.json`,
        );
        suggestions.push(`Try bazdmeg_report_context_gap to log what context was missing`);
        suggestions.push(`Review allowed paths with bazdmeg_workspace_status`);
      } else {
        suggestions.push(
          `Enter a workspace with bazdmeg_enter_workspace to get proper isolation and context`,
        );
      }
      if (suggestedContext) {
        suggestions.push(
          `You suggested: "${suggestedContext}" — the overseeing agent will review this`,
        );
      }

      return textResult(
        `## Stuck Signal Recorded\n\n` +
          `**Reason**: ${reason}\n` +
          `**Attempted**: ${attemptedAction}\n` +
          `**Signal file**: ${signalPath}\n` +
          `**Workspace**: ${workspace?.packageName ?? "none"}\n\n` +
          `### While waiting for help, try:\n` +
          suggestions.map((s) => `- ${s}`).join("\n"),
      );
    },
  });
}
