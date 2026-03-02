/**
 * GitHub Admin MCP Tools (CF Workers)
 *
 * Repository administration, branch protection, and team management via GitHub API.
 * Requires GH_PAT_TOKEN environment binding.
 */

import type { ToolRegistry } from "../mcp/registry";
import type { DrizzleDB } from "../db/index";

export function registerGitHubAdminTools(
  _registry: ToolRegistry,
  _userId: string,
  _db: DrizzleDB,
): void {
  // Not yet migrated — requires GH_PAT_TOKEN binding in wrangler.toml
}
