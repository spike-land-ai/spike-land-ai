/**
 * Tool Dependency Graph
 *
 * Enforces dependency chains between tools:
 * - `dependsOn`: Must be registered before this tool appears
 * - `enables`: Auto-enabled after this tool succeeds
 * - `requires`: Must have been called in this session before executing
 */

import type { StandaloneToolDefinition, ToolDependencies } from "./types";

export interface DependencyCheckResult {
  ok: boolean;
  missing: string[];
}

/**
 * Check that all `dependsOn` tools exist in the registry.
 */
export function checkDependsOn(
  tool: StandaloneToolDefinition,
  registeredNames: Set<string>,
): DependencyCheckResult {
  const deps = tool.dependencies?.dependsOn;
  if (!deps || deps.length === 0) return { ok: true, missing: [] };

  const missing = deps.filter((d) => !registeredNames.has(d));
  return { ok: missing.length === 0, missing };
}

/**
 * Check that all `requires` tools have been called in this session.
 */
export function checkRequires(
  tool: StandaloneToolDefinition,
  calledTools: Set<string>,
): DependencyCheckResult {
  const reqs = tool.dependencies?.requires;
  if (!reqs || reqs.length === 0) return { ok: true, missing: [] };

  const missing = reqs.filter((r) => !calledTools.has(r));
  return { ok: missing.length === 0, missing };
}

/**
 * Get the list of tools to auto-enable after a successful call.
 */
export function getEnables(deps: ToolDependencies | undefined): string[] {
  return deps?.enables ?? [];
}

/**
 * Detect cycles in the dependency graph.
 * Returns arrays of tool names forming cycles, or empty if no cycles.
 */
export function detectCycles(tools: StandaloneToolDefinition[]): string[][] {
  const graph = new Map<string, string[]>();
  for (const tool of tools) {
    const edges: string[] = [
      ...(tool.dependencies?.dependsOn ?? []),
      ...(tool.dependencies?.requires ?? []),
    ];
    graph.set(tool.name, edges);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const edges = graph.get(node) ?? [];
    for (const edge of edges) {
      dfs(edge, [...path]);
    }

    inStack.delete(node);
  }

  for (const name of graph.keys()) {
    if (!visited.has(name)) {
      dfs(name, []);
    }
  }

  return cycles;
}
