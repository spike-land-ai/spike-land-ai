/**
 * Workspace Tools
 *
 * MCP tools for entering, exiting, and checking workspace state.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { textResult, jsonResult, formatError } from "@spike-land-ai/mcp-server-base";
import { EnterWorkspaceSchema } from "../types.js";
import { resolveWorkspacePaths } from "../workspace-resolver.js";
import { enterWorkspace, exitWorkspace, getWorkspace } from "../workspace-state.js";
import { buildContextBundle, formatContextBundle } from "../context-bundle.js";
import { logWorkspaceEnter, logWorkspaceExit } from "../telemetry.js";

export function registerWorkspaceTools(server: McpServer): void {
  // ── bazdmeg_enter_workspace ──────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_enter_workspace",
    "Declare active workspace, compute allowed paths from deps, write config, serve context bundle",
    EnterWorkspaceSchema.shape,
    async (args) => {
      try {
        const { packageName } = args as { packageName: string };
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
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );

  // ── bazdmeg_workspace_status ─────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_workspace_status",
    "Show current workspace scope, allowed paths, and dependency tree",
    {},
    async () => {
      try {
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
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );

  // ── bazdmeg_exit_workspace ───────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_exit_workspace",
    "Clear workspace restrictions — all file paths become accessible again",
    {},
    async () => {
      try {
        const workspace = getWorkspace();
        if (!workspace) {
          return textResult("No workspace was active.");
        }

        const packageName = workspace.packageName;
        await exitWorkspace();
        await logWorkspaceExit(packageName);

        return textResult(`Workspace exited: ${packageName}. All file restrictions lifted.`);
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );
}
