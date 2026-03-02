/**
 * Communication MCP Tools (CF Workers)
 *
 * Email, newsletter, and notification tools.
 * Not yet fully migrated from spike.land (requires email service adapter).
 */

import type { ToolRegistry } from "../mcp/registry";
import type { DrizzleDB } from "../db/index";

export function registerEmailTools(_registry: ToolRegistry, _userId: string, _db: DrizzleDB): void {
  // Not yet migrated — requires email service adapter
}

export function registerNewsletterTools(
  _registry: ToolRegistry,
  _userId: string,
  _db: DrizzleDB,
): void {
  // Not yet migrated — requires email service adapter
}

export function registerNotificationsTools(
  _registry: ToolRegistry,
  _userId: string,
  _db: DrizzleDB,
): void {
  // Not yet migrated — requires push/email notification adapter
}
