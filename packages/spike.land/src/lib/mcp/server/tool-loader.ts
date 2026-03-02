/**
 * Tool Loader
 *
 * Handles side-effectful loading operations triggered during tool invocation:
 * - Skill usage recording (Prisma DB write + Google Analytics)
 *
 * Extracted from tool-registry.ts to keep the ToolRegistry class focused on
 * registration and lookup logic only.
 */

import logger from "@/lib/logger";
import { trackServerEvent } from "@/lib/tracking/google-analytics";

export interface SkillUsageData {
  userId: string;
  skillName: string;
  category: string;
  outcome: string;
  durationMs: number;
  input: Record<string, unknown>;
  errorMessage?: string;
  tokensUsed?: number;
}

export async function recordSkillUsage(data: SkillUsageData): Promise<void> {
  try {
    const prisma = (await import("@/lib/prisma")).default;

    await prisma.skillUsageEvent.create({
      data: {
        userId: data.userId,
        skillName: data.skillName,
        category: data.category,
        outcome: data.outcome,
        durationMs: data.durationMs,
        metadata: {
          input: data.input as unknown as import("@/generated/prisma").Prisma.InputJsonValue,
          ...(data.errorMessage !== undefined && { errorMessage: data.errorMessage }),
          ...(data.tokensUsed !== undefined && { tokensUsed: data.tokensUsed }),
        },
      },
    });

    // Also track in Google Analytics
    void trackServerEvent(data.userId, data.userId, "mcp_tool_usage", {
      skill_name: data.skillName,
      category: data.category,
      outcome: data.outcome,
      duration_ms: data.durationMs,
      tokens_used: data.tokensUsed,
      error_message: data.errorMessage,
    });
  } catch (err) {
    logger.error("Failed to record skill usage event", { error: err });
  }
}
