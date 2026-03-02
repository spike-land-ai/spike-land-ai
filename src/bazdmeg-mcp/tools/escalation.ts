/**
 * Escalation Tools
 *
 * MCP tool for stuck signal — agents declare when they're blocked.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { textResult, formatError } from "@spike-land-ai/mcp-server-base";
import { writeFile } from "node:fs/promises";
import { SignalStuckSchema } from "../types.js";
import type { StuckSignal } from "../types.js";
import { getWorkspace } from "../workspace-state.js";
import { logStuckSignal } from "../telemetry.js";

export function registerEscalationTools(server: McpServer): void {
  // ── bazdmeg_signal_stuck ─────────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_signal_stuck",
    "Declare that you are stuck — writes signal file and logs to telemetry for overseeing agent",
    SignalStuckSchema.shape,
    async (args) => {
      try {
        const { reason, attemptedAction, suggestedContext } = args as {
          reason: string;
          attemptedAction: string;
          suggestedContext?: string;
        };

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
          suggestions.push(`Check if the needed file is in a dependency not listed in ${workspace.packageName}/package.json`);
          suggestions.push(`Try bazdmeg_report_context_gap to log what context was missing`);
          suggestions.push(`Review allowed paths with bazdmeg_workspace_status`);
        } else {
          suggestions.push(`Enter a workspace with bazdmeg_enter_workspace to get proper isolation and context`);
        }
        if (suggestedContext) {
          suggestions.push(`You suggested: "${suggestedContext}" — the overseeing agent will review this`);
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
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );
}
