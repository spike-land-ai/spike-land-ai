/**
 * MCP Observability Tools (CF Workers)
 *
 * Tool usage metrics, latency tracking, and error analysis. Not yet fully migrated from spike.land.
 */

import type { ToolRegistry } from "../mcp/registry";
import type { DrizzleDB } from "../db/index";

export function registerMcpObservabilityTools(
  _registry: ToolRegistry,
  _userId: string,
  _db: DrizzleDB,
): void {
  // Not yet migrated from spike.land
}
