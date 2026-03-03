import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BoxActionType, BoxStatus } from "@prisma/client";
import { safeToolCall, textResult } from "./tool-helpers";

const CreateBoxSchema = z.object({
  name: z.string().min(1).max(50),
  tierId: z.string(),
});

const BoxActionSchema = z.object({
  id: z.string(),
  action: z.enum([
    BoxActionType.START,
    BoxActionType.STOP,
    BoxActionType.RESTART,
  ]),
});

const BoxIdSchema = z.object({
  id: z.string(),
});

export function registerBoxesTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "boxes_list",
    description: "List all boxes for the current user",
    category: "boxes",
    tier: "workspace",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("boxes_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const boxes = await prisma.box.findMany({
          where: { userId, deletedAt: null },
          include: { tier: true },
          orderBy: { createdAt: "desc" },
        });
        return textResult(JSON.stringify(boxes));
      }, { userId }),
  });

  registry.register({
    name: "boxes_create",
    description: "Create a new box",
    category: "boxes",
    tier: "workspace",
    inputSchema: CreateBoxSchema.shape,
    handler: async (
      args: z.infer<typeof CreateBoxSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("boxes_create", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const tier = await prisma.boxTier.findUnique({
          where: { id: args.tierId },
        });
        if (!tier) throw new Error("Invalid tier");

        const cost = tier.pricePerHour;
        const { WorkspaceCreditManager } = await import(
          "@/lib/credits/workspace-credit-manager"
        );
        const hasBalance = await WorkspaceCreditManager.hasEnoughCredits(
          userId,
          cost,
        );
        if (!hasBalance) throw new Error("Insufficient credits");

        await WorkspaceCreditManager.consumeCredits({
          userId,
          amount: cost,
          source: "box_creation",
          sourceId: "pending",
        });

        let box;
        try {
          box = await prisma.box.create({
            data: {
              name: args.name,
              userId,
              tierId: args.tierId,
              status: BoxStatus.CREATING,
            },
          });
        } catch (createError) {
          await WorkspaceCreditManager.refundCredits(userId, cost);
          throw createError;
        }

        // Trigger provisioning async
        const { triggerBoxProvisioning } = await import(
          "@/lib/boxes/provisioning"
        );
        triggerBoxProvisioning(box.id).catch(console.error);

        return textResult(JSON.stringify(box));
      }, { userId, input: args }),
  });

  registry.register({
    name: "boxes_action",
    description: "Start, stop, or restart a box",
    category: "boxes",
    tier: "workspace",
    inputSchema: BoxActionSchema.shape,
    handler: async (
      { id, action }: z.infer<typeof BoxActionSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("boxes_action", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const box = await prisma.box.findUnique({ where: { id, userId } });
        if (!box) throw new Error("Box not found");

        await prisma.boxAction.create({
          data: { boxId: id, action, status: "PENDING" },
        });

        let newStatus = box.status;
        if (action === BoxActionType.START) newStatus = BoxStatus.STARTING;
        if (action === BoxActionType.STOP) newStatus = BoxStatus.STOPPING;
        if (action === BoxActionType.RESTART) newStatus = BoxStatus.STARTING;

        const updatedBox = await prisma.box.update({
          where: { id, userId },
          data: { status: newStatus },
        });

        return textResult(JSON.stringify(updatedBox));
      }, { userId, input: { id, action } }),
  });

  registry.register({
    name: "boxes_get",
    description: "Get box details",
    category: "boxes",
    tier: "workspace",
    inputSchema: BoxIdSchema.shape,
    handler: async (
      { id }: z.infer<typeof BoxIdSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("boxes_get", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const box = await prisma.box.findUnique({
          where: { id, userId },
          include: { tier: true },
        });
        if (!box) throw new Error("Box not found");
        return textResult(JSON.stringify(box));
      }, { userId, input: { id } }),
  });
}
