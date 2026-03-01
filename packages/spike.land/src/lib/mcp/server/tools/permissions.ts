import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { workspaceTool } from "../tool-builder/procedures.js";

export function registerPermissionsTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        workspaceTool(userId)
            .tool("permissions_list_pending", "List pending permission requests for the user.", {})
            .meta({ category: "permissions", tier: "workspace" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
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
            })
    );

    registry.registerBuilt(
        workspaceTool(userId)
            .tool("permissions_respond", "Approve or deny a permission request.", {
                requestId: z.string().describe("The ID of the permission request."),
                action: z.enum(["APPROVE", "DENY"]).describe("Approve or deny the request."),
            })
            .meta({ category: "permissions", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

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
                    `**Request ${args.action === "APPROVE" ? "Approved" : "Denied"
                    }**\n\nID: \`${updated.id}\``,
                );
            })
    );
}
