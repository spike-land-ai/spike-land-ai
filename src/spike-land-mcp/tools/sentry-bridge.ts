/**
 * Sentry Bridge MCP Tools (CF Workers)
 *
 * Error log querying and issue tracking via Sentry API. Not yet fully migrated from spike.land.
 */

import type { ToolRegistry } from "../mcp/registry";
import type { DrizzleDB } from "../db/index";

export function registerSentryBridgeTools(
  _registry: ToolRegistry,
  _userId: string,
  _db: DrizzleDB,
): void {
  // Not yet migrated from spike.land (requires SENTRY_AUTH_TOKEN binding)
}
