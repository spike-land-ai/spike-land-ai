/**
 * Workspace Tools
 *
 * MCP tools for entering, exiting, and checking workspace state.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createZodTool, jsonResult, textResult } from "@spike-land-ai/mcp-server-base";
import { EnterWorkspaceSchema } from "../core-logic/types.js";
import { resolveWorkspacePaths } from "../node-sys/workspace-resolver.js";
import { enterWorkspace, exitWorkspace, getWorkspace } from "../node-sys/workspace-state.js";
import { buildContextBundle, formatContextBundle } from "../node-sys/context-bundle.js";
import { logWorkspaceEnter, logWorkspaceExit } from "../node-sys/telemetry.js";

export function registerWorkspaceTools(server: McpServer): void {
  // ── bazdmeg_enter_workspace ──────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_enter_workspace",
    description:
      "Declare active workspace, compute allowed paths from deps, write config, serve context bundle",
    schema: EnterWorkspaceSchema.shape,
    handler: async ({ packageName }) => {
      const monorepoRoot = process.cwd();

      // Resolve dependencies and allowed paths
      const resolved = await resolveWorkspacePaths(monorepoRoot, packageName);

      // Enter workspace
      const config = {
        packageName,
        packagePath: `packages/${packageName}/`,
        allowedPaths: resolved.paths,
        dependencies: resolved.direct,
        enteredAt: new Date().toISOString(),
      };
      await enterWorkspace(config);

      // Log telemetry
      await logWorkspaceEnter(packageName, resolved.paths);

      // Build context bundle
      const bundle = await buildContextBundle(monorepoRoot, packageName, resolved.direct);
      const contextText = formatContextBundle(bundle);

      return textResult(
        `Workspace entered: ${packageName}\n\n` +
          `Allowed paths (${resolved.paths.length}):\n` +
          resolved.paths.map((p) => `  - ${p}`).join("\n") +
          `\n\nDependencies (${resolved.direct.length}):\n` +
          resolved.direct.map((d) => `  - ${d}`).join("\n") +
          `\n\n---\n\n${contextText}`,
      );
    },
  });

  // ── bazdmeg_workspace_status ─────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_workspace_status",
    description: "Show current workspace scope, allowed paths, and dependency tree",
    schema: {},
    handler: async () => {
      const workspace = getWorkspace();
      if (!workspace) {
        return textResult("No workspace active. Use bazdmeg_enter_workspace to declare one.");
      }

      return jsonResult({
        packageName: workspace.packageName,
        packagePath: workspace.packagePath,
        allowedPaths: workspace.allowedPaths,
        dependencies: workspace.dependencies,
        enteredAt: workspace.enteredAt,
        pathCount: workspace.allowedPaths.length,
        depCount: workspace.dependencies.length,
      });
    },
  });

  // ── bazdmeg_exit_workspace ───────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_exit_workspace",
    description: "Clear workspace restrictions — all file paths become accessible again",
    schema: {},
    handler: async () => {
      const workspace = getWorkspace();
      if (!workspace) {
        return textResult("No workspace was active.");
      }

      const packageName = workspace.packageName;
      await exitWorkspace();
      await logWorkspaceExit(packageName);

      return textResult(`Workspace exited: ${packageName}. All file restrictions lifted.`);
    },
  });
}
