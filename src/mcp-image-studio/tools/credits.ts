import { z } from "zod";
import { errorResult, jsonResult } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const creditsTool = imageProcedure
  .tool("credits", "Check credit balance, optionally with cost estimate for a tier", {
    tier: z
      .enum(["FREE", "TIER_0_5K", "TIER_1K", "TIER_2K", "TIER_4K"])
      .describe("Tier to estimate cost for")
      .optional(),
    count: z.number().describe("Number of operations to estimate").optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;

    const balanceResult = await tryCatch(deps.credits.getBalance(userId));
    if (!balanceResult.ok) {
      return errorResult(
        "BALANCE_ERROR",
        balanceResult.error?.message ?? "Could not retrieve credit balance",
      );
    }
    if (!balanceResult.data) {
      return errorResult("BALANCE_NOT_FOUND", "Could not find credit balance");
    }

    const response: Record<string, unknown> = {
      remaining: balanceResult.data.remaining,
    };

    if (input.tier) {
      const count = input.count ?? 1;
      const costPerUnit = deps.credits.calculateGenerationCost({
        tier: input.tier,
        numImages: 1,
      });
      const totalCost = deps.credits.calculateGenerationCost({
        tier: input.tier,
        numImages: count,
      });

      const canAffordResult = await tryCatch(deps.credits.hasEnough(userId, totalCost));

      response.estimate = {
        tier: input.tier,
        count,
        costPerUnit,
        totalCost,
        canAfford: canAffordResult.ok ? canAffordResult.data : false,
      };
    }

    return jsonResult(response);
  });

export const credits = creditsTool.handler;
export const CreditsInputSchema = z.object(creditsTool.inputSchema);
export type CreditsInput = Parameters<typeof credits>[0];
