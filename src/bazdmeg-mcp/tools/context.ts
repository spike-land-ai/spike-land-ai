/**
 * Context Tools
 *
 * MCP tools for context bundle serving, gap reporting, and session review.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { textResult, errorResult, formatError } from "@spike-land-ai/mcp-server-base";
import { ReportContextGapSchema } from "../types.js";
import { getWorkspace } from "../workspace-state.js";
import { buildContextBundle, formatContextBundle } from "../context-bundle.js";
import { logContextServed, logContextGap } from "../telemetry.js";

export function registerContextTools(server: McpServer): void {
  // ── bazdmeg_get_context ──────────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_get_context",
    "Serve pre-digested context bundle: CLAUDE.md + exported types + public API surface for current workspace",
    {},
    async () => {
      try {
        const workspace = getWorkspace();
        if (!workspace) {
          return errorResult("NO_WORKSPACE", "No workspace active. Call bazdmeg_enter_workspace first.");
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
        for (const dep of bundle.dependencyContexts) items.push(`dep:${dep.packageName}`);
        await logContextServed(workspace.packageName, items);

        return textResult(text);
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );

  // ── bazdmeg_report_context_gap ───────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_report_context_gap",
    "Report what context was missing — feeds the improvement loop",
    ReportContextGapSchema.shape,
    async (args) => {
      try {
        const { missingContext, whatWasNeeded } = args as {
          missingContext: string;
          whatWasNeeded: string;
        };
        const workspace = getWorkspace();

        await logContextGap(
          workspace?.packageName ?? null,
          missingContext,
          whatWasNeeded,
        );

        return textResult(
          `Context gap recorded.\n` +
          `- Missing: ${missingContext}\n` +
          `- Needed for: ${whatWasNeeded}\n` +
          `- Workspace: ${workspace?.packageName ?? "none"}\n\n` +
          `This feedback will improve future context bundles.`,
        );
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );

  // ── bazdmeg_review_session ───────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_review_session",
    "After task completion, analyze what context was served vs what was needed. Outputs improvement suggestions.",
    {},
    async () => {
      try {
        const workspace = getWorkspace();

        const suggestions: string[] = [];
        suggestions.push("Review the context gaps logged during this session");
        suggestions.push("Consider adding missing types or API docs to CLAUDE.md");
        if (!workspace) {
          suggestions.push("No workspace was active — consider using bazdmeg_enter_workspace for future sessions");
        }

        return textResult(
          `## Session Review\n\n` +
          `**Workspace**: ${workspace?.packageName ?? "none"}\n` +
          `**Suggestions**:\n` +
          suggestions.map((s) => `- ${s}`).join("\n") +
          `\n\nCheck /tmp/bazdmeg-context-log.jsonl for detailed context delivery history.`,
        );
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );
}
