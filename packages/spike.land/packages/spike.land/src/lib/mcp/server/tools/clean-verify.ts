/**
 * CleanSweep Verification Tools (Server-Side)
 *
 * MCP tools for AI-powered task verification and before/after comparison.
 * Uses Gemini Vision for image analysis.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import prisma from "@/lib/prisma";
import { safeToolCall, textResult } from "./tool-helpers";
import {
  buildVerificationPrompt,
  COMPARISON_PROMPT,
} from "@/lib/clean/vision-prompts";
import { BONUSES } from "@/lib/clean/gamification";

interface VerificationResult {
  completed: boolean;
  confidence: number;
  feedback: string;
}

interface ComparisonResult {
  improvement_score: number;
  changes_detected: string[];
  remaining_items: string[];
  encouragement: string;
}

export function registerCleanVerifyTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // clean_verify_check_completion
  registry.register({
    name: "clean_verify_check_completion",
    description:
      "Verify task completion using a photo. AI analyzes whether the task was done. If confidence > 0.6, task is upgraded to VERIFIED status with bonus points.",
    category: "clean-verify",
    tier: "free",
    inputSchema: {
      task_id: z.string().min(1).describe("The task ID to verify"),
      photo_base64: z
        .string()
        .min(1)
        .describe("Base64-encoded photo showing the completed task"),
    },
    handler: async ({
      task_id,
      photo_base64,
    }: {
      task_id: string;
      photo_base64: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_verify_check_completion", async () => {
        const task = await prisma.cleaningTask.findUnique({
          where: { id: task_id },
          include: { session: { select: { userId: true, id: true } } },
        });
        if (!task || task.session.userId !== userId) {
          return textResult("Task not found or not owned by you.");
        }

        const prompt = buildVerificationPrompt(task.description);
        let verification: VerificationResult;

        try {
          const { analyzeImageWithGemini } = await import(
            "@/lib/ai/gemini-client"
          );
          const rawResult = await analyzeImageWithGemini(photo_base64, prompt);
          verification = JSON.parse(
            typeof rawResult === "string"
              ? rawResult
              : JSON.stringify(rawResult),
          ) as VerificationResult;
        } catch (error) {
          throw new Error(
            `Failed to verify image with Gemini Vision: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          );
        }

        const verified = verification.confidence > 0.6;

        if (verified) {
          await prisma.cleaningTask.update({
            where: { id: task_id },
            data: {
              status: "VERIFIED",
              completedAt: task.completedAt ?? new Date(),
            },
          });

          // If task wasn't already completed, increment completedTasks
          if (task.status !== "COMPLETED" && task.status !== "VERIFIED") {
            await prisma.cleaningSession.update({
              where: { id: task.session.id },
              data: { completedTasks: { increment: 1 } },
            });
          }
        }

        let text = `**Verification Result**\n\n`;
        text += `- **Completed:** ${verification.completed ? "Yes" : "Not quite"}\n`;
        text += `- **Confidence:** ${(verification.confidence * 100).toFixed(0)}%\n`;
        text += `- **Status:** ${
          verified
            ? `VERIFIED (+${BONUSES.VERIFICATION_PHOTO} bonus pts)`
            : "Not verified — try again or mark as complete manually"
        }\n`;
        text += `- **Feedback:** ${verification.feedback}\n`;

        return textResult(text);
      });
    },
  });

  // clean_verify_compare_before_after
  registry.register({
    name: "clean_verify_compare_before_after",
    description:
      "Compare before and after photos of a room to measure cleaning progress. Returns improvement score and detected changes.",
    category: "clean-verify",
    tier: "free",
    inputSchema: {
      before_photo_base64: z
        .string()
        .min(1)
        .describe("Base64-encoded BEFORE photo"),
      after_photo_base64: z
        .string()
        .min(1)
        .describe("Base64-encoded AFTER photo"),
      session_id: z
        .string()
        .min(1)
        .describe("The session ID for context"),
    },
    handler: async ({
      before_photo_base64,
      after_photo_base64,
      session_id,
    }: {
      before_photo_base64: string;
      after_photo_base64: string;
      session_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_verify_compare_before_after", async () => {
        const session = await prisma.cleaningSession.findFirst({
          where: { id: session_id, userId },
        });
        if (!session) {
          return textResult("Session not found or not owned by you.");
        }

        let comparison: ComparisonResult;

        try {
          const { analyzeImageWithGemini } = await import(
            "@/lib/ai/gemini-client"
          );
          // Send both photos with comparison prompt
          const rawResult = await analyzeImageWithGemini(
            [before_photo_base64, after_photo_base64],
            COMPARISON_PROMPT,
          );
          comparison = JSON.parse(
            typeof rawResult === "string"
              ? rawResult
              : JSON.stringify(rawResult),
          ) as ComparisonResult;
        } catch (error) {
          throw new Error(
            `Failed to compare images with Gemini Vision: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          );
        }

        let text = `**Before/After Comparison**\n\n`;
        text += `- **Improvement score:** ${comparison.improvement_score}/100\n\n`;

        if (comparison.changes_detected.length > 0) {
          text += `### Changes Detected\n`;
          for (const change of comparison.changes_detected) {
            text += `- ${change}\n`;
          }
          text += `\n`;
        }

        if (comparison.remaining_items.length > 0) {
          text += `### Still Needs Attention\n`;
          for (const item of comparison.remaining_items) {
            text += `- ${item}\n`;
          }
          text += `\n`;
        }

        text += `### Encouragement\n${comparison.encouragement}`;

        return textResult(text);
      });
    },
  });
}
