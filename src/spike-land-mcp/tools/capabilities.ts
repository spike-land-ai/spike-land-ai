/**
 * Capabilities MCP Tools (CF Workers)
 *
 * Agent permission management: request permissions, check status, list queued actions.
 * Ported from spike.land — uses Drizzle D1 instead of Prisma.
 * Simplified: D1 schema has permissionRequests with permissionType/resource/status.
 * No agentCapabilityToken or agentTrustScore tables — permission requests
 * are created directly.
 */

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool } from "../procedures/index";
import { textResult } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";
import { permissionRequests, claudeCodeAgents } from "../db/schema";

export function registerCapabilitiesTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "capabilities_request_permissions",
        "Request additional tool or category permissions. Creates an approval request for the user.",
        {
          tools: z
            .array(z.string())
            .optional()
            .describe("Specific tool names to request access to."),
          categories: z
            .array(z.string())
            .optional()
            .describe("Tool categories to request access to."),
          reason: z.string().min(1).describe("Why access is needed."),
        },
      )
      .meta({ category: "capabilities", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { tools, categories, reason } = input;

        // Find the user's active agent
        const agent = await ctx.db
          .select({ id: claudeCodeAgents.id })
          .from(claudeCodeAgents)
          .where(
            and(eq(claudeCodeAgents.userId, ctx.userId), eq(claudeCodeAgents.status, "running")),
          )
          .limit(1);

        const now = Date.now();
        const requestId = crypto.randomUUID();

        // Create permission request with details in resource field
        const resourcePayload = JSON.stringify({
          tools: tools ?? [],
          categories: categories ?? [],
          reason,
        });

        await ctx.db.insert(permissionRequests).values({
          id: requestId,
          userId: ctx.userId,
          agentId: agent[0]?.id ?? null,
          permissionType: "scope_expansion",
          resource: resourcePayload,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        });

        return textResult(
          `**Permission Request Created**\n\n` +
            `**Request ID:** ${requestId}\n` +
            `**Tools:** ${(tools ?? []).join(", ") || "(none)"}\n` +
            `**Categories:** ${(categories ?? []).join(", ") || "(none)"}\n` +
            `**Reason:** ${reason}\n` +
            `**Status:** pending\n\n` +
            `The user will be notified to approve or deny this request.`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "capabilities_check_permissions",
        "Check current permission status and any active agents.",
        {},
      )
      .meta({ category: "capabilities", tier: "free" })
      .handler(async ({ ctx }) => {
        // Find active agent
        const agent = await ctx.db
          .select({
            id: claudeCodeAgents.id,
            name: claudeCodeAgents.name,
            status: claudeCodeAgents.status,
          })
          .from(claudeCodeAgents)
          .where(
            and(eq(claudeCodeAgents.userId, ctx.userId), eq(claudeCodeAgents.status, "running")),
          )
          .limit(1);

        if (agent.length === 0 || !agent[0]) {
          return textResult(
            "**No Active Agent**\n\n" +
              "No running agent found. You are operating with full user permissions.",
          );
        }

        // Count permission requests by status
        const pending = await ctx.db
          .select({ id: permissionRequests.id })
          .from(permissionRequests)
          .where(
            and(
              eq(permissionRequests.userId, ctx.userId),
              eq(permissionRequests.status, "pending"),
            ),
          );

        const approved = await ctx.db
          .select({ id: permissionRequests.id })
          .from(permissionRequests)
          .where(
            and(
              eq(permissionRequests.userId, ctx.userId),
              eq(permissionRequests.status, "approved"),
            ),
          );

        return textResult(
          `**Current Capabilities**\n\n` +
            `**Agent:** ${agent[0].name}\n` +
            `**Agent Status:** ${agent[0].status}\n` +
            `**Pending Requests:** ${pending.length}\n` +
            `**Approved Requests:** ${approved.length}\n`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool("capabilities_list_queued_actions", "List permission requests and their status.", {
        status: z
          .string()
          .optional()
          .default("pending")
          .describe("Filter by status: pending, approved, denied."),
      })
      .meta({ category: "capabilities", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const { status } = input;

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
            and(eq(permissionRequests.userId, ctx.userId), eq(permissionRequests.status, status)),
          )
          .limit(20);

        if (requests.length === 0) {
          return textResult(
            `**No ${status} Requests**\n\nNo permission requests with status "${status}" found.`,
          );
        }

        let text = `**Permission Requests (${status})**\n\n`;
        for (const req of requests) {
          text += `---\n`;
          text += `**ID:** ${req.id}\n`;
          text += `**Agent:** ${req.agentName ?? "Unknown"}\n`;
          text += `**Type:** ${req.permissionType}\n`;
          text += `**Status:** ${req.status}\n`;
          if (req.resource) {
            try {
              const payload = JSON.parse(req.resource) as { reason?: string };
              if (payload.reason) text += `**Reason:** ${payload.reason}\n`;
            } catch {
              text += `**Resource:** ${req.resource}\n`;
            }
          }
          text += `**Created:** ${new Date(req.createdAt).toISOString()}\n`;
        }

        return textResult(text);
      }),
  );
}
