import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { safeToolCall, textResult } from "./tool-helpers";

const CreateShareSchema = z.object({
  imageId: z.string().describe("ID of the image to share."),
});

const GetShareSchema = z.object({
  token: z.string().describe("Share token."),
});

export function registerShareTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "share_create_token",
    description: "Generate a unique share token for an image.",
    category: "share",
    tier: "workspace",
    inputSchema: CreateShareSchema.shape,
    handler: async (
      { imageId }: z.infer<typeof CreateShareSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("share_create_token", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const image = await prisma.enhancedImage.findUnique({
          where: { id: imageId, userId },
        });
        if (!image) throw new Error("Image not found");

        if (image.shareToken) {
          return textResult(JSON.stringify({ token: image.shareToken }));
        }

        const token = (await import("crypto")).randomBytes(16).toString("hex");
        const updated = await prisma.enhancedImage.update({
          where: { id: imageId },
          data: { shareToken: token },
        });

        return textResult(JSON.stringify({ token: updated.shareToken }));
      }, { userId, input: { imageId } }),
  });

  registry.register({
    name: "share_get_info",
    description: "Get metadata for a shared image using a token.",
    category: "share",
    tier: "free",
    inputSchema: GetShareSchema.shape,
    handler: async (
      { token }: z.infer<typeof GetShareSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("share_get_info", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const image = await prisma.enhancedImage.findUnique({
          where: { shareToken: token },
          include: {
            enhancementJobs: {
              where: { status: "COMPLETED" },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            user: { select: { name: true } },
          },
        });

        if (!image) throw new Error("Shared item not found");

        return textResult(JSON.stringify(image));
      }, { userId, input: { token } }),
  });
}
