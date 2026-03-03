import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { safeToolCall, textResult } from "./tool-helpers";

const PermissionResponseSchema = z.object({
  requestId: z.string().describe("The ID of the permission request."),
  action: z.enum(["APPROVE", "DENY"]).describe("Approve or deny the request."),
});

export function registerPermissionsTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "permissions_list_pending",
    description: "List pending permission requests for the user.",
    category: "permissions",
    tier: "workspace",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("permissions_list_pending", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const requests = await prisma.permissionRequest.findMany({
          where: { userId, status: "PENDING" },
          include: {
            agent: { select: { displayName: true } },
            template: { select: { displayName: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        if (requests.length === 0) {
          return textResult("No pending permission requests.");
        }
        let text = `**Pending Permission Requests**\n\n`;
        for (const r of requests) {
          text +=
            `- **${r.agent.displayName}** wants to: ${r.requestType}\n  ID: \`${r.id}\` | Created: ${r.createdAt.toISOString()}\n\n`;
        }
        return textResult(text);
      }),
  });

  registry.register({
    name: "permissions_respond",
    description: "Approve or deny a permission request.",
    category: "permissions",
    tier: "workspace",
    inputSchema: PermissionResponseSchema.shape,
    handler: async (
      args: z.infer<typeof PermissionResponseSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("permissions_respond", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const request = await prisma.permissionRequest.findUnique({
          where: { id: args.requestId, userId },
        });

        if (!request) throw new Error("Permission request not found.");
        if (request.status !== "PENDING") {
          throw new Error(`Request is already ${request.status}.`);
        }

        const updated = await prisma.permissionRequest.update({
          where: { id: args.requestId },
          data: {
            status: args.action === "APPROVE" ? "APPROVED" : "DENIED",
          },
        });

        return textResult(
          `**Request ${
            args.action === "APPROVE" ? "Approved" : "Denied"
          }**\n\nID: \`${updated.id}\``,
        );
      }),
  });
}
