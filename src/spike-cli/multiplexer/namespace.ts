/**
 * Namespace utilities for MCP tool name prefixing.
 */

const DEFAULT_SEPARATOR = "__";

/**
 * Prefix a tool name with a server name and separator.
 */
export function namespaceTool(
  serverName: string,
  toolName: string,
  separator: string = DEFAULT_SEPARATOR,
): string {
  return `${serverName}${separator}${toolName}`;
}

/**
 * Parse a namespaced tool name back into its server and tool components.
 * Returns null if the name does not match any known server prefix.
 * Uses greedy matching: tries longer server names first.
 */
export function parseNamespacedTool(
  namespacedName: string,
  servers: string[],
  separator: string = DEFAULT_SEPARATOR,
): { serverName: string; toolName: string } | null {
  // Sort by length descending to prefer longer (more specific) matches
  const sorted = [...servers].sort((a, b) => b.length - a.length);

  for (const serverName of sorted) {
    const prefix = `${serverName}${separator}`;
    if (namespacedName.startsWith(prefix)) {
      return {
        serverName,
        toolName: namespacedName.slice(prefix.length),
      };
    }
  }

  return null;
}

/**
 * Strip a server namespace prefix from a tool name.
 * If the name does not start with the given prefix, returns it unchanged.
 */
export function stripNamespace(
  namespacedName: string,
  serverName: string,
  separator: string = DEFAULT_SEPARATOR,
): string {
  const prefix = `${serverName}${separator}`;
  if (namespacedName.startsWith(prefix)) {
    return namespacedName.slice(prefix.length);
  }
  return namespacedName;
}
