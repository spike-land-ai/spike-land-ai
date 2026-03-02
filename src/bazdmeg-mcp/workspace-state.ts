/**
 * Workspace State
 *
 * Singleton managing the current workspace context.
 * Writes workspace config to /tmp/bazdmeg-workspace.json for the hook script.
 */

import { writeFile, unlink } from "node:fs/promises";
import type { WorkspaceConfig, WorkspaceConfigFile } from "./types.js";

const WORKSPACE_CONFIG_PATH = "/tmp/bazdmeg-workspace.json";

let currentWorkspace: WorkspaceConfig | null = null;

/**
 * Set the current workspace and write config to /tmp for hook script.
 */
export async function enterWorkspace(config: WorkspaceConfig): Promise<void> {
  currentWorkspace = config;

  const configFile: WorkspaceConfigFile = {
    packageName: config.packageName,
    allowedPaths: config.allowedPaths,
    enteredAt: config.enteredAt,
  };

  await writeFile(WORKSPACE_CONFIG_PATH, JSON.stringify(configFile, null, 2));
}

/**
 * Clear the current workspace and remove the config file.
 */
export async function exitWorkspace(): Promise<void> {
  currentWorkspace = null;

  try {
    await unlink(WORKSPACE_CONFIG_PATH);
  } catch {
    // File may not exist, that's fine
  }
}

/**
 * Get the current workspace config.
 */
export function getWorkspace(): WorkspaceConfig | null {
  return currentWorkspace;
}

/**
 * Check if a workspace is currently active.
 */
export function isWorkspaceActive(): boolean {
  return currentWorkspace !== null;
}

/**
 * Get the path to the workspace config file.
 */
export function getConfigPath(): string {
  return WORKSPACE_CONFIG_PATH;
}

/**
 * Reset state (for testing).
 */
export function resetWorkspaceState(): void {
  currentWorkspace = null;
}
