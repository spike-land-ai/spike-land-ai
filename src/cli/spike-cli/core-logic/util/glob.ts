/**
 * Simple glob matching for tool name filtering.
 * Supports '*' wildcards only (not full glob syntax).
 */

export function matchesGlob(name: string, pattern: string): boolean {
  // Convert glob pattern to regex: escape special chars, replace * with .*
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
  return regex.test(name);
}

export function matchesAnyGlob(name: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesGlob(name, pattern));
}

export interface ToolFilterConfig {
  allowed?: string[] | undefined;
  blocked?: string[] | undefined;
}

/**
 * Filter tools by allowed/blocked glob patterns.
 * - If `allowed` is set, only tools matching at least one allowed pattern pass.
 * - If `blocked` is set, tools matching any blocked pattern are removed.
 * - Both can be combined: allowed is applied first, then blocked.
 */
export function filterTools<T extends { name: string }>(
  tools: T[],
  config?: ToolFilterConfig,
): T[] {
  if (!config) return tools;

  let result = tools;

  if (config.allowed && config.allowed.length > 0) {
    result = result.filter((t) => matchesAnyGlob(t.name, config.allowed ?? []));
  }

  if (config.blocked && config.blocked.length > 0) {
    result = result.filter((t) => !matchesAnyGlob(t.name, config.blocked ?? []));
  }

  return result;
}
