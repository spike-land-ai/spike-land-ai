import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { BoxActionType, BoxStatus } from "@prisma/client";
import { safeToolCall, textResult } from "./tool-helpers";
import { workspaceTool } from "../tool-builder/procedures";

export function registerBoxesTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        workspaceTool(userId)
            .tool("boxes_list", "List all boxes for the current user", {})
            .meta({ category: "boxes", tier: "workspace" })
            .handler(async ({ input: _input, ctx }) => {
                return safeToolCall("boxes_list", async () => {
                    const boxes = await ctx.prisma.box.findMany({
                        where: { userId, deletedAt: null },
                        include: { tier: true },
                        orderBy: { createdAt: "desc" },
                    });
                    return textResult(JSON.stringify(boxes));
                }, { userId });
            })
    );

    registry.registerBuilt(
        workspaceTool(userId)
            .tool("boxes_create", "Create a new box", {
                name: z.string().min(1).max(50),
                tierId: z.string(),
            })
            .meta({ category: "boxes", tier: "workspace" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("boxes_create", async () => {
                    const tier = await ctx.prisma.boxTier.findUnique({
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
                        box = await ctx.prisma.box.create({
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
                }, { userId, input: args });
            })
    );

    registry.registerBuilt(
        workspaceTool(userId)
            .tool("boxes_action", "Start, stop, or restart a box", {
                id: z.string(),
                action: z.enum([
                    BoxActionType.START,
                    BoxActionType.STOP,
                    BoxActionType.RESTART,
                ]),
            })
            .meta({ category: "boxes", tier: "workspace" })
            .handler(async ({ input, ctx }) => {
                const { id, action } = input;
                return safeToolCall("boxes_action", async () => {
                    const box = await ctx.prisma.box.findUnique({ where: { id, userId } });
                    if (!box) throw new Error("Box not found");

                    await ctx.prisma.boxAction.create({
                        data: { boxId: id, action, status: "PENDING" },
                    });

                    let newStatus = box.status;
                    if (action === BoxActionType.START) newStatus = BoxStatus.STARTING;
                    if (action === BoxActionType.STOP) newStatus = BoxStatus.STOPPING;
                    if (action === BoxActionType.RESTART) newStatus = BoxStatus.STARTING;

                    const updatedBox = await ctx.prisma.box.update({
                        where: { id, userId },
                        data: { status: newStatus },
                    });

                    return textResult(JSON.stringify(updatedBox));
                }, { userId, input: { id, action } });
            })
    );

    registry.registerBuilt(
        workspaceTool(userId)
            .tool("boxes_get", "Get box details", {
                id: z.string(),
            })
            .meta({ category: "boxes", tier: "workspace" })
            .handler(async ({ input, ctx }) => {
                const { id } = input;
                return safeToolCall("boxes_get", async () => {
                    const box = await ctx.prisma.box.findUnique({
                        where: { id, userId },
                        include: { tier: true },
                    });
                    if (!box) throw new Error("Box not found");
                    return textResult(JSON.stringify(box));
                }, { userId, input: { id } });
            })
    );
}
