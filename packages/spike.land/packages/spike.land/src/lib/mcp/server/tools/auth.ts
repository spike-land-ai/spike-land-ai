/**
 * Auth MCP Tools
 *
 * Authentication validation and protected route verification tools.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const CheckAuthSchema = z.object({
  session_token: z.string().optional().describe(
    "Optional session token to validate.",
  ),
});

const CheckRouteAccessSchema = z.object({
  path: z.string().min(1).describe(
    "Route path to check access for (e.g., /admin, /dashboard).",
  ),
});

const GetUserProfileSchema = z.object({
  include_workspaces: z.boolean().optional().default(false).describe(
    "Include workspace memberships.",
  ),
});

export function registerAuthTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "auth_check_session",
    description: "Validate the current user's authentication session and return user info.",
    category: "auth",
    tier: "free",
    inputSchema: CheckAuthSchema.shape,
    handler: async (
      _args: z.infer<typeof CheckAuthSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("auth_check_session", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        });
        if (!user) {
          return textResult(
            "**Error: NOT_FOUND**\nUser session invalid or user not found.\n**Retryable:** false",
          );
        }
        return textResult(
          `**Session Valid**\n\n`
            + `**User:** ${user.name || "unnamed"}\n`
            + `**Email:** ${user.email}\n`
            + `**Role:** ${user.role}\n`
            + `**Member since:** ${user.createdAt.toISOString()}`,
        );
      }),
  });

  registry.register({
    name: "auth_check_route_access",
    description: "Check if the current user has access to a specific route based on their role.",
    category: "auth",
    tier: "free",
    inputSchema: CheckRouteAccessSchema.shape,
    handler: async (
      { path }: z.infer<typeof CheckRouteAccessSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("auth_check_route_access", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        if (!user) {
          return textResult(
            "**Access: DENIED**\nUser not authenticated.\n**Retryable:** false",
          );
        }
        const adminRoutes = [
          "/admin",
          "/admin/agents",
          "/admin/emails",
          "/admin/gallery",
          "/admin/jobs",
          "/admin/photos",
        ];
        const isAdminRoute = adminRoutes.some(r => path.startsWith(r));
        const hasAccess = !isAdminRoute || user.role === "ADMIN";
        return textResult(
          `**Route Access Check**\n\n`
            + `**Path:** ${path}\n`
            + `**Role:** ${user.role}\n`
            + `**Access:** ${hasAccess ? "GRANTED" : "DENIED"}\n`
            + `**Requires Admin:** ${isAdminRoute}`,
        );
      }),
  });

  registry.register({
    name: "auth_get_profile",
    description: "Get the current user's full profile with optional workspace memberships.",
    category: "auth",
    tier: "free",
    inputSchema: GetUserProfileSchema.shape,
    handler: async (
      { include_workspaces = false }: z.infer<typeof GetUserProfileSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("auth_get_profile", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
            createdAt: true,
            ...(include_workspaces
              ? {
                workspaceMembers: {
                  select: {
                    workspace: { select: { id: true, name: true, slug: true } },
                    role: true,
                  },
                },
              }
              : {}),
          },
        });
        if (!user) {
          return textResult(
            "**Error: NOT_FOUND**\nUser not found.\n**Retryable:** false",
          );
        }
        let text = `**User Profile**\n\n`;
        text += `**Name:** ${user.name || "unnamed"}\n`;
        text += `**Email:** ${user.email}\n`;
        text += `**Role:** ${user.role}\n`;
        text += `**Avatar:** ${user.image || "(none)"}\n`;
        text += `**Joined:** ${user.createdAt.toISOString()}\n`;
        if (include_workspaces && "workspaceMembers" in user) {
          const members = user.workspaceMembers as unknown as Array<
            { workspace: { name: string; slug: string; }; role: string; }
          >;
          if (members.length > 0) {
            text += `\n**Workspaces:**\n`;
            for (const m of members) {
              text += `- ${m.workspace.name} (\`${m.workspace.slug}\`) — ${m.role}\n`;
            }
          }
        }
        return textResult(text);
      }),
  });
}
