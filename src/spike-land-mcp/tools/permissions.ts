/**
 * Permissions MCP Tools (CF Workers)
 *
 * List and respond to permission requests.
 * Ported from spike.land — uses Drizzle D1 instead of Prisma.
 * Simplified: D1 permissionRequests has permissionType/resource/status fields
 * (no agent relation with displayName, no template).
 */

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { workspaceTool } from "../procedures/index";
import { textResult } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";
import { permissionRequests, claudeCodeAgents } from "../db/schema";

export function registerPermissionsTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  const t = workspaceTool(userId, db);

  registry.registerBuilt(
    t
      .tool("permissions_list_pending", "List pending permission requests for the user.", {})
      .meta({ category: "permissions", tier: "workspace" })
      .handler(async ({ ctx }) => {
        const requests = await ctx.db
          .select({
            id: permissionRequests.id,
            permissionType: permissionRequests.permissionType,
            resource: permissionRequests.resource,
            status: permissionRequests.status,
            createdAt: permissionRequests.createdAt,
            agentName: claudeCodeAgents.name,
          })
          .from(permissionRequests)
          .leftJoin(claudeCodeAgents, eq(claudeCodeAgents.id, permissionRequests.agentId))
          .where(
            and(
              eq(permissionRequests.userId, ctx.userId),
              eq(permissionRequests.status, "pending"),
            ),
          );

        if (requests.length === 0) {
          return textResult("No pending permission requests.");
        }

        let text = `**Pending Permission Requests**\n\n`;
        for (const r of requests) {
          const agent = r.agentName ?? "Unknown agent";
          text += `- **${agent}** wants to: ${r.permissionType}\n`;
          if (r.resource) text += `  Resource: ${r.resource}\n`;
          text += `  ID: \`${r.id}\` | Created: ${new Date(r.createdAt).toISOString()}\n\n`;
        }
        return textResult(text);
      }),
  );

  registry.registerBuilt(
    t
      .tool("permissions_respond", "Approve or deny a permission request.", {
        requestId: z.string().describe("The ID of the permission request."),
        action: z.enum(["APPROVE", "DENY"]).describe("Approve or deny the request."),
      })
      .meta({ category: "permissions", tier: "workspace" })
      .handler(async ({ input, ctx }) => {
        const request = await ctx.db
          .select({
            id: permissionRequests.id,
            status: permissionRequests.status,
            userId: permissionRequests.userId,
          })
          .from(permissionRequests)
          .where(
            and(
              eq(permissionRequests.id, input.requestId),
              eq(permissionRequests.userId, ctx.userId),
            ),
          )
          .limit(1);

        if (request.length === 0 || !request[0]) {
          throw new Error("Permission request not found.");
        }
        if (request[0].status !== "pending") {
          throw new Error(`Request is already ${request[0].status}.`);
        }

        const newStatus = input.action === "APPROVE" ? "approved" : "denied";

        await ctx.db
          .update(permissionRequests)
          .set({
            status: newStatus,
            updatedAt: Date.now(),
          })
          .where(eq(permissionRequests.id, input.requestId));

        return textResult(
          `**Request ${input.action === "APPROVE" ? "Approved" : "Denied"}**\n\nID: \`${input.requestId}\``,
        );
      }),
  );
}
