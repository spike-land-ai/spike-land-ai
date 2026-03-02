/**
 * Auth MCP Tools (CF Workers)
 *
 * Authentication validation and profile tools.
 * Ported from spike.land — uses Drizzle D1 instead of Prisma.
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool } from "../procedures/index";
import { textResult } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";
import { users, workspaceMembers, workspaces } from "../db/schema";

export function registerAuthTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "auth_check_session",
        "Validate the current user's authentication session and return user info.",
        {
          session_token: z.string().optional().describe("Optional session token to validate."),
        },
      )
      .meta({ category: "auth", tier: "free" })
      .handler(async ({ ctx }) => {
        const result = await ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.id, ctx.userId))
          .limit(1);

        const user = result[0];
        if (!user) {
          return textResult(
            "**Error: NOT_FOUND**\nUser session invalid or user not found.\n**Retryable:** false",
          );
        }
        return textResult(
          `**Session Valid**\n\n` +
            `**User:** ${user.name || "unnamed"}\n` +
            `**Email:** ${user.email}\n` +
            `**Role:** ${user.role}\n` +
            `**Member since:** ${new Date(user.createdAt).toISOString()}`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "auth_check_route_access",
        "Check if the current user has access to a specific route based on their role.",
        {
          path: z
            .string()
            .min(1)
            .describe("Route path to check access for (e.g., /admin, /dashboard)."),
        },
      )
      .meta({ category: "auth", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const result = await ctx.db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, ctx.userId))
          .limit(1);

        const user = result[0];
        if (!user) {
          return textResult("**Access: DENIED**\nUser not authenticated.\n**Retryable:** false");
        }
        const adminRoutes = [
          "/admin",
          "/admin/agents",
          "/admin/emails",
          "/admin/gallery",
          "/admin/jobs",
          "/admin/photos",
        ];
        const isAdminRoute = adminRoutes.some((r) => input.path.startsWith(r));
        const hasAccess = !isAdminRoute || user.role === "admin";
        return textResult(
          `**Route Access Check**\n\n` +
            `**Path:** ${input.path}\n` +
            `**Role:** ${user.role}\n` +
            `**Access:** ${hasAccess ? "GRANTED" : "DENIED"}\n` +
            `**Requires Admin:** ${isAdminRoute}`,
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "auth_get_profile",
        "Get the current user's full profile with optional workspace memberships.",
        {
          include_workspaces: z
            .boolean()
            .optional()
            .default(false)
            .describe("Include workspace memberships."),
        },
      )
      .meta({ category: "auth", tier: "free" })
      .handler(async ({ input, ctx }) => {
        const result = await ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            image: users.image,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.id, ctx.userId))
          .limit(1);

        const user = result[0];
        if (!user) {
          return textResult("**Error: NOT_FOUND**\nUser not found.\n**Retryable:** false");
        }

        let text = `**User Profile**\n\n`;
        text += `**Name:** ${user.name || "unnamed"}\n`;
        text += `**Email:** ${user.email}\n`;
        text += `**Role:** ${user.role}\n`;
        text += `**Avatar:** ${user.image || "(none)"}\n`;
        text += `**Joined:** ${new Date(user.createdAt).toISOString()}\n`;

        if (input.include_workspaces) {
          const memberships = await ctx.db
            .select({
              role: workspaceMembers.role,
              workspaceName: workspaces.name,
              workspaceSlug: workspaces.slug,
            })
            .from(workspaceMembers)
            .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
            .where(eq(workspaceMembers.userId, ctx.userId));

          if (memberships.length > 0) {
            text += `\n**Workspaces:**\n`;
            for (const m of memberships) {
              text += `- ${m.workspaceName} (\`${m.workspaceSlug}\`) — ${m.role}\n`;
            }
          }
        }

        return textResult(text);
      }),
  );
}
