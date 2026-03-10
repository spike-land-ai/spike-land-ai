/**
 * BAZDMEG Planning Interview MCP Tools (CF Workers)
 *
 * MCQ-based verification system that tests developer understanding before
 * they write code. Uses the quiz engine for mastery tracking, contradiction
 * detection, and adaptive questioning — with planning-specific concepts.
 *
 * Six concepts tested: file_awareness, test_strategy, edge_cases,
 * dependency_chain, failure_modes, verification.
 */

import { z } from "zod";
import type { ToolRegistry } from "../../../lazy-imports/registry";
import { freeTool, jsonResult } from "../../../lazy-imports/procedures-index.ts";
import type { DrizzleDB } from "../../../db/db/db-index.ts";
import type { ToolRegistrationEnv } from "../../mcp/manifest";
import {
  type BadgePayload,
  QUESTIONS_PER_ROUND,
  computeScore,
  createQuizSession,
  evaluateAnswers,
  generateBadgeToken,
  generateNextRound,
  generatePlanningConcepts,
  getSession,
  sanitizeRound,
  setSession,
} from "../../lib/quiz-engine";

const MAX_CONTRADICTIONS = 3;

export function registerBazdmegWorkflowTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
  env?: ToolRegistrationEnv,
): void {
  const t = freeTool(userId, db);

  // ── planning_interview_start ─────────────────────────────────────────────
  registry.registerBuilt(
    t
      .tool(
        "planning_interview_start",
        "Start a planning interview that verifies your understanding of a task before coding. " +
          "Tests 6 concepts: file awareness, test strategy, edge cases, dependency chain, " +
          "failure modes, and verification. Returns MCQ questions — master all 6 to proceed.",
        {
          task_description: z
            .string()
            .min(10)
            .describe("Description of the task being planned (what you intend to build/fix)."),
          package_name: z
            .string()
            .optional()
            .describe("Target package name (for context in question generation)."),
        },
      )
      .meta({ category: "bazdmeg", tier: "free" })
      .handler(async ({ input }) => {
        const concepts = await generatePlanningConcepts(
          input.task_description,
          input.package_name,
          env?.geminiApiKey,
        );

        const id = crypto.randomUUID();
        const session = createQuizSession(id, userId, input.task_description, concepts);
        setSession(id, session);

        return jsonResult(
          `Planning interview started — ${concepts.length} concepts to master. ` +
            `Answer all questions correctly (2+ per concept) to proceed to implementation.`,
          {
            sessionId: id,
            taskDescription: input.task_description,
            concepts: concepts.map((c) => c.name),
            stoppingRules: {
              pass: "All 6 concepts mastered (2+ correct each)",
              failLowScore: "Score < 50% on a round → must research before continuing",
              failContradictions: "3+ contradictions → review codebase before continuing",
            },
            firstRound: sanitizeRound(session.currentRound),
          },
        );
      }),
  );

  // ── planning_interview_answer ────────────────────────────────────────────
  registry.registerBuilt(
    t
      .tool(
        "planning_interview_answer",
        "Submit answers for the current planning interview round (3 questions, each 0-3). " +
          "Returns results, mastery progress, and next round or final verdict.",
        {
          session_id: z.string().describe("Planning interview session ID."),
          answers: z
            .tuple([
              z.number().int().min(0).max(3),
              z.number().int().min(0).max(3),
              z.number().int().min(0).max(3),
            ])
            .describe("Answers for each of the 3 questions (0-3 option index)."),
        },
      )
      .meta({ category: "bazdmeg", tier: "free" })
      .handler(async ({ input }) => {
        const session = getSession(input.session_id);
        if (!session) throw new Error(`Session ${input.session_id} not found`);
        if (session.completed) throw new Error("Interview already completed");

        const answers = input.answers as [number, number, number];
        const { results, conflicts, allMastered } = evaluateAnswers(session, answers);

        session.score = computeScore(session);

        const correctThisRound = results.filter((r) => r.correct).length;
        const progress = session.conceptStates.map((s) => ({
          concept: s.name,
          mastered: s.mastered,
          correctCount: s.correctCount,
          attempts: s.attempts,
        }));

        // Stopping rule: score < 50% on this round
        if (correctThisRound < Math.ceil(QUESTIONS_PER_ROUND / 2)) {
          session.completed = true;
          session.completedAt = Date.now();
          return jsonResult(
            `FAILED — Score too low (${correctThisRound}/${QUESTIONS_PER_ROUND} correct). ` +
              `Research the task before continuing.`,
            {
              verdict: "FAIL_LOW_SCORE",
              results,
              conflicts,
              score: session.score,
              progress,
              recommendation:
                "Re-read the codebase, check tests, and understand the existing implementation before retrying.",
            },
          );
        }

        // Stopping rule: too many contradictions
        if (session.conflicts.length >= MAX_CONTRADICTIONS) {
          session.completed = true;
          session.completedAt = Date.now();
          return jsonResult(
            `FAILED — ${session.conflicts.length} contradictions detected. ` +
              `Review the codebase before continuing.`,
            {
              verdict: "FAIL_CONTRADICTIONS",
              results,
              conflicts: session.conflicts,
              score: session.score,
              progress,
              recommendation:
                "Your answers are inconsistent. Review the actual code and documentation before retrying.",
            },
          );
        }

        // All mastered — pass!
        if (allMastered) {
          session.completed = true;
          session.completedAt = Date.now();

          const badgePayload: BadgePayload = {
            sid: session.id,
            topic: "Planning Interview",
            score: session.score,
            ts: session.completedAt,
          };
          const token = generateBadgeToken(badgePayload, "planning-interview-secret");

          return jsonResult(
            `PASSED — All ${session.concepts.length} concepts mastered! Proceed to implementation.`,
            {
              verdict: "PASS",
              results,
              conflicts,
              score: session.score,
              progress,
              badge: {
                token,
                topic: badgePayload.topic,
                score: badgePayload.score,
                completedAt: new Date(badgePayload.ts).toISOString(),
              },
            },
          );
        }

        // Continue — next round
        session.roundNumber++;
        session.currentRound = generateNextRound(session);

        return jsonResult(
          `Round ${session.roundNumber - 1}: ${correctThisRound}/${QUESTIONS_PER_ROUND} correct` +
            (conflicts.length > 0 ? `. ${conflicts.length} contradiction(s)!` : "") +
            `. ${progress.filter((p) => p.mastered).length}/${session.concepts.length} concepts mastered.`,
          {
            verdict: "CONTINUE",
            results,
            conflicts,
            score: session.score,
            progress,
            nextRound: sanitizeRound(session.currentRound),
          },
        );
      }),
  );
}
