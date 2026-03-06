/**
 * Gates Tools
 *
 * MCP tools for running, checking, and listing quality gates.
 */

import type { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createZodTool, jsonResult, textResult } from "@spike-land-ai/mcp-server-base";
import { CheckGateSchema, RunGatesSchema } from "../core-logic/types.js";
import { getWorkspace } from "../node-sys/workspace-state.js";
import {
  countChanges,
  formatGateResults,
  getBuiltinRules,
  getChangedFiles,
  getRuleByName,
  runGates,
} from "../core-logic/engine.js";
import { logGateCheck } from "../node-sys/telemetry.js";

export function registerGatesTools(server: McpServer): void {
  // ── bazdmeg_run_gates ────────────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_run_gates",
    description: "Run all BAZDMEG quality gates against a diff",
    schema: RunGatesSchema.shape,
    handler: async (args: z.infer<typeof RunGatesSchema>) => {
      const { diff, prTitle, prBody } = args;

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
    },
  });

  // ── bazdmeg_check_gate ───────────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_check_gate",
    description: "Run a single quality gate by name",
    schema: CheckGateSchema.shape,
    handler: async (args: z.infer<typeof CheckGateSchema>) => {
      const { gateName, diff } = args;

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
    },
  });

  // ── bazdmeg_list_gates ───────────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_list_gates",
    description: "List all available BAZDMEG quality gates",
    schema: {},
    handler: async () => {
      const rules = getBuiltinRules();
      const list = rules.map((r) => ({
        name: r.name,
        description: r.description,
        category: r.category,
      }));
      return jsonResult(list);
    },
  });
}
