/**
 * Context Tools
 *
 * MCP tools for context bundle serving, gap reporting, and session review.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createZodTool, errorResult, textResult } from "@spike-land-ai/mcp-server-base";
import { ReportContextGapSchema } from "../core-logic/types.js";
import { getWorkspace } from "../node-sys/workspace-state.js";
import { buildContextBundle, formatContextBundle } from "../node-sys/context-bundle.js";
import { logContextGap, logContextServed } from "../node-sys/telemetry.js";

export function registerContextTools(server: McpServer): void {
  // ── bazdmeg_get_context ──────────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_get_context",
    description:
      "Serve pre-digested context bundle: CLAUDE.md + exported types + public API surface for current workspace",
    schema: {},
    handler: async () => {
      const workspace = getWorkspace();
      if (!workspace) {
        return errorResult(
          "NO_WORKSPACE",
          "No workspace active. Call bazdmeg_enter_workspace first.",
        );
      }

      const monorepoRoot = process.cwd();
      const bundle = await buildContextBundle(
        monorepoRoot,
        workspace.packageName,
        workspace.dependencies,
      );
      const text = formatContextBundle(bundle);

      // Log what context was served
      const items: string[] = [];
      if (bundle.claudeMd) items.push("CLAUDE.md");
      if (bundle.packageJson) items.push("package.json");
      for (const exp of bundle.exportedTypes) items.push(`types:${exp.file}`);
      for (const dep of bundle.dependencyContexts) {
        items.push(`dep:${dep.packageName}`);
      }
      await logContextServed(workspace.packageName, items);

      return textResult(text);
    },
  });

  // ── bazdmeg_report_context_gap ───────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_report_context_gap",
    description: "Report what context was missing — feeds the improvement loop",
    schema: ReportContextGapSchema.shape,
    handler: async ({ missingContext, whatWasNeeded }) => {
      const workspace = getWorkspace();

      await logContextGap(workspace?.packageName ?? null, missingContext, whatWasNeeded);

      return textResult(
        `Context gap recorded.\n` +
          `- Missing: ${missingContext}\n` +
          `- Needed for: ${whatWasNeeded}\n` +
          `- Workspace: ${workspace?.packageName ?? "none"}\n\n` +
          `This feedback will improve future context bundles.`,
      );
    },
  });

  // ── bazdmeg_review_session ───────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_review_session",
    description:
      "After task completion, analyze what context was served vs what was needed. Outputs improvement suggestions.",
    schema: {},
    handler: async () => {
      const workspace = getWorkspace();

      const suggestions: string[] = [];
      suggestions.push("Review the context gaps logged during this session");
      suggestions.push("Consider adding missing types or API docs to CLAUDE.md");
      if (!workspace) {
        suggestions.push(
          "No workspace was active — consider using bazdmeg_enter_workspace for future sessions",
        );
      }

      return textResult(
        `## Session Review\n\n` +
          `**Workspace**: ${workspace?.packageName ?? "none"}\n` +
          `**Suggestions**:\n` +
          suggestions.map((s) => `- ${s}`).join("\n") +
          `\n\nCheck /tmp/bazdmeg-context-log.jsonl for detailed context delivery history.`,
      );
    },
  });
}
