/**
 * CleanSweep Scanner Tools (Server-Side)
 *
 * MCP tools for AI-powered room analysis and task generation.
 * Uses Gemini Vision for image analysis.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import prisma from "@/lib/prisma";
import { safeToolCall, textResult } from "./tool-helpers";
import { ROOM_ANALYSIS_PROMPT } from "@/lib/clean/vision-prompts";
import { POINTS } from "@/lib/clean/gamification";

interface RoomAnalysisItem {
  object: string;
  location: string;
  category: string;
  difficulty: string;
  action: string;
}

interface RoomAnalysisResult {
  room_type: string;
  mess_severity: number;
  items: RoomAnalysisItem[];
}

export function registerCleanScannerTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // clean_scanner_analyze_room
  registry.register({
    name: "clean_scanner_analyze_room",
    description:
      "Analyze a room photo using AI vision to identify cleaning tasks. Returns structured room analysis with mess severity and specific items to clean.",
    category: "clean-scanner",
    tier: "free",
    inputSchema: {
      photo_base64: z
        .string()
        .min(1)
        .describe("Base64-encoded photo of the room"),
      session_id: z
        .string()
        .optional()
        .describe("Optional session ID to associate with the analysis"),
    },
    handler: async ({
      photo_base64,
      session_id,
    }: {
      photo_base64: string;
      session_id?: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_scanner_analyze_room", async () => {
        // Verify session ownership if provided
        if (session_id) {
          const session = await prisma.cleaningSession.findFirst({
            where: { id: session_id, userId },
          });
          if (!session) {
            return textResult("Session not found or not owned by you.");
          }
        }

        let analysis: RoomAnalysisResult;

        try {
          const { analyzeImageWithGemini } = await import(
            "@/lib/ai/gemini-client"
          );
          const rawResult = await analyzeImageWithGemini(
            photo_base64,
            ROOM_ANALYSIS_PROMPT,
          );
          analysis = JSON.parse(
            typeof rawResult === "string"
              ? rawResult
              : JSON.stringify(rawResult),
          ) as RoomAnalysisResult;
        } catch (error) {
          throw new Error(
            `Failed to analyze image with Gemini Vision: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          );
        }

        let text = `**Room Analysis**\n\n`;
        text += `- **Room type:** ${analysis.room_type}\n`;
        text += `- **Mess severity:** ${analysis.mess_severity}/10\n`;
        text += `- **Items found:** ${analysis.items.length}\n\n`;

        if (analysis.items.length > 0) {
          text += `### Tasks Identified\n\n`;
          for (let i = 0; i < analysis.items.length; i++) {
            const item = analysis.items[i]!;
            text += `${i + 1}. **${item.object}** (${item.location})\n`;
            text += `   - Category: ${item.category} | Difficulty: ${item.difficulty}\n`;
            text += `   - Action: ${item.action}\n\n`;
          }
        }

        text += `\n**Analysis JSON:** \`${JSON.stringify(analysis)}\``;

        return textResult(text);
      });
    },
  });

  // clean_scanner_generate_tasks
  registry.register({
    name: "clean_scanner_generate_tasks",
    description:
      "Generate CleaningTask records from a room analysis result. Parses the analysis JSON and creates tasks ordered by difficulty (QUICK first).",
    category: "clean-scanner",
    tier: "free",
    inputSchema: {
      analysis_json: z
        .string()
        .min(1)
        .describe("JSON string from clean_scanner_analyze_room result"),
      session_id: z
        .string()
        .min(1)
        .describe("Session ID to create tasks in"),
    },
    handler: async ({
      analysis_json,
      session_id,
    }: {
      analysis_json: string;
      session_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_scanner_generate_tasks", async () => {
        // Verify session ownership
        const session = await prisma.cleaningSession.findFirst({
          where: { id: session_id, userId },
        });
        if (!session) {
          return textResult("Session not found or not owned by you.");
        }

        const analysis = JSON.parse(analysis_json) as RoomAnalysisResult;

        if (!analysis.items || analysis.items.length === 0) {
          return textResult(
            "No tasks found in the analysis. The room looks clean!",
          );
        }

        // Sort by difficulty: QUICK < EASY < MEDIUM < EFFORT
        const difficultyOrder: Record<string, number> = {
          QUICK: 0,
          EASY: 1,
          MEDIUM: 2,
          EFFORT: 3,
        };
        const sorted = [...analysis.items].sort(
          (a, b) =>
            (difficultyOrder[a.difficulty] ?? 4)
            - (difficultyOrder[b.difficulty] ?? 4),
        );

        // Create tasks
        const taskData = sorted.map((item, index) => {
          const difficulty = (["QUICK", "EASY", "MEDIUM", "EFFORT"].includes(
              item.difficulty,
            )
            ? item.difficulty
            : "EASY") as keyof typeof POINTS;
          const category = [
              "PICKUP",
              "DISHES",
              "LAUNDRY",
              "SURFACES",
              "FLOORS",
              "TRASH",
              "ORGANIZE",
              "OTHER",
            ].includes(item.category)
            ? item.category
            : "OTHER";

          return {
            sessionId: session_id,
            description: item.action,
            category: category as
              | "PICKUP"
              | "DISHES"
              | "LAUNDRY"
              | "SURFACES"
              | "FLOORS"
              | "TRASH"
              | "ORGANIZE"
              | "OTHER",
            difficulty: difficulty as "QUICK" | "EASY" | "MEDIUM" | "EFFORT",
            orderIndex: index,
            pointsValue: POINTS[difficulty],
          };
        });

        await prisma.cleaningTask.createMany({ data: taskData });

        // Update session totalTasks
        await prisma.cleaningSession.update({
          where: { id: session_id },
          data: { totalTasks: { increment: taskData.length } },
        });

        // Update room label from analysis
        if (analysis.room_type && analysis.room_type !== "unknown") {
          await prisma.cleaningSession.update({
            where: { id: session_id },
            data: { roomLabel: analysis.room_type },
          });
        }

        let text = `**${taskData.length} tasks created!**\n\n`;
        for (let i = 0; i < taskData.length; i++) {
          const t = taskData[i]!;
          text += `${i + 1}. [${t.difficulty}] ${t.description.slice(0, 80)}${
            t.description.length > 80 ? "..." : ""
          } (${t.pointsValue} pts)\n`;
        }

        return textResult(text);
      });
    },
  });
}
