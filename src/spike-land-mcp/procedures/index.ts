/**
 * spike-land-mcp Base Procedures
 *
 * Pre-composed middleware chains for CF Workers MCP tools.
 * Replaces Prisma (spike.land) with Drizzle ORM + D1.
 */

import { createProcedure, middleware } from "@spike-land-ai/shared/tool-builder";
import type { DrizzleDB } from "../db/index";
import { textResult, jsonResult } from "../tools/tool-helpers";

// ─── Middleware: userId injection ───

function withUserId(userId: string) {
  return middleware<Record<string, unknown>, { userId: string }>(async ({ ctx, next }) => {
    return next({ ...ctx, userId });
  });
}

// ─── Middleware: Drizzle DB injection ───

function withDrizzle(db: DrizzleDB) {
  return middleware<Record<string, unknown>, { db: DrizzleDB }>(async ({ ctx, next }) => {
    return next({ ...ctx, db });
  });
}

// ─── Composed Procedures ───

/**
 * Create a procedure for free-tier tools.
 * Includes: userId + Drizzle DB.
 *
 * Usage:
 * ```ts
 * const t = freeTool(userId, db);
 * registry.registerBuilt(
 *   t.tool("my_tool", "Description", { name: z.string().describe("...") })
 *     .meta({ category: "my-cat", tier: "free" })
 *     .handler(async ({ input, ctx }) => {
 *       // ctx.db is DrizzleDB, ctx.userId is string
 *     })
 * );
 * ```
 */
export function freeTool(userId: string, db: DrizzleDB) {
  return createProcedure().use(withUserId(userId)).use(withDrizzle(db));
}

/**
 * Create a procedure for workspace-tier tools.
 *
 * Intentionally identical to freeTool — tier enforcement happens via
 * `.meta({ tier: "workspace" })` on the tool definition, which controls
 * whether the tool is included in per-app MCP server configurations.
 * Runtime workspace membership checks must be done inside the handler
 * using `resolveWorkspace()` from tool-helpers when needed.
 */
export function workspaceTool(userId: string, db: DrizzleDB) {
  return freeTool(userId, db);
}

export { withUserId, withDrizzle, textResult, jsonResult };
