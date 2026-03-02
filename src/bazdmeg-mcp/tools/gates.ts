/**
 * Gates Tools
 *
 * MCP tools for running, checking, and listing quality gates.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { textResult, jsonResult, formatError } from "@spike-land-ai/mcp-server-base";
import { RunGatesSchema, CheckGateSchema } from "../types.js";
import { getWorkspace } from "../workspace-state.js";
import {
  getBuiltinRules,
  getRuleByName,
  runGates,
  formatGateResults,
  getChangedFiles,
  countChanges,
} from "../gates/engine.js";
import { logGateCheck } from "../telemetry.js";

export function registerGatesTools(server: McpServer): void {
  // ── bazdmeg_run_gates ────────────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_run_gates",
    "Run all BAZDMEG quality gates against a diff",
    RunGatesSchema.shape,
    async (args) => {
      try {
        const { diff, prTitle, prBody } = args as {
          diff: string;
          prTitle?: string;
          prBody?: string;
        };

        const workspace = getWorkspace();
        const files = getChangedFiles(diff);
        const { additions, deletions } = countChanges(diff);

        const context = {
          diff,
          files,
          additions,
          deletions,
          prTitle: prTitle ?? "",
          prBody: prBody ?? null,
          claudeMdRules: [],
          allowedPaths: workspace?.allowedPaths,
        };

        const rules = getBuiltinRules();
        const results = runGates(rules, context);
        const formatted = formatGateResults(results);

        // Log each gate result
        for (const result of results) {
          await logGateCheck(result.name, result.status, result.detail);
        }

        return textResult(formatted);
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );

  // ── bazdmeg_check_gate ───────────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_check_gate",
    "Run a single quality gate by name",
    CheckGateSchema.shape,
    async (args) => {
      try {
        const { gateName, diff } = args as { gateName: string; diff?: string };

        const rule = getRuleByName(gateName);
        if (!rule) {
          const available = getBuiltinRules().map((r) => r.name);
          return textResult(
            `Gate "${gateName}" not found. Available gates:\n` +
            available.map((n) => `  - ${n}`).join("\n"),
          );
        }

        const workspace = getWorkspace();
        const actualDiff = diff ?? "";
        const files = getChangedFiles(actualDiff);
        const { additions, deletions } = countChanges(actualDiff);

        const context = {
          diff: actualDiff,
          files,
          additions,
          deletions,
          prTitle: "",
          prBody: null,
          claudeMdRules: [],
          allowedPaths: workspace?.allowedPaths,
        };

        const result = rule.check(context);
        await logGateCheck(result.name, result.status, result.detail);

        return jsonResult(result);
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );

  // ── bazdmeg_list_gates ───────────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_list_gates",
    "List all available BAZDMEG quality gates",
    {},
    async () => {
      try {
        const rules = getBuiltinRules();
        const list = rules.map((r) => ({
          name: r.name,
          description: r.description,
          category: r.category,
        }));
        return jsonResult(list);
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );
}
