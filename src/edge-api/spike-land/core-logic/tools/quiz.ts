/**
 * Learning Quiz MCP Tools — Thin adapter over lib/quiz-engine.
 *
 * Verification-through-questions system: content → article → quiz → badge.
 */

import { z } from "zod";
import type { ToolRegistry } from "../../lazy-imports/registry";
import { freeTool, jsonResult } from "../../lazy-imports/procedures-index.ts";
import type { DrizzleDB } from "../../db/db/db-index.ts";
import type { ToolRegistrationEnv } from "../mcp/manifest";
import {
  type AnswerResult,
  type BadgePayload,
  type ConceptDefinition,
  type ConceptState,
  type ConflictRecord,
  type QuizQuestion,
  type QuizRound,
  type QuizSession,
  type QuizVariant,
  QUESTIONS_PER_ROUND,
  clearQuizSessions,
  computeScore,
  createQuizSession,
  evaluateAnswers,
  generateBadgeToken,
  generateConceptsFromContent,
  generateNextRound,
  getSession,
  sanitizeRound,
  setSession,
  truncate,
  verifyBadgeToken,
} from "../lib/quiz-engine";

// Re-export types and engine functions for existing consumers
export type {
  AnswerResult,
  BadgePayload,
  ConceptDefinition,
  ConceptState,
  ConflictRecord,
  QuizQuestion,
  QuizRound,
  QuizSession,
  QuizVariant,
};
export {
  clearQuizSessions,
  computeScore,
  evaluateAnswers,
  generateBadgeToken,
  generateConceptsFromContent,
  generateNextRound,
  getSession,
  verifyBadgeToken,
};

// ─── Registration ────────────────────────────────────────────────────────────

export function registerQuizTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
  env?: ToolRegistrationEnv,
): void {
  // ── quiz_create_session ──────────────────────────────────────────────────
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "quiz_create_session",
        "Create a learning quiz session from content URL or text. Returns article, concepts, and first round of questions.",
        {
          content_url: z.string().url().optional().describe("URL to fetch content from."),
          content_text: z.string().optional().describe("Raw content text to quiz on."),
        },
      )
      .meta({ category: "learn", tier: "free" })
      .handler(async ({ input }) => {
        let articleContent = input.content_text ?? "";

        if (!articleContent && input.content_url) {
          try {
            const jinaUrl = `https://r.jina.ai/${input.content_url}`;
            const res = await fetch(jinaUrl, {
              headers: {
                Accept: "text/plain",
                "X-Return-Format": "text",
              },
            });

            if (!res.ok) {
              throw new Error(
                `Failed to fetch URL content (Status: ${res.status} ${res.statusText})`,
              );
            }
            articleContent = await res.text();

            if (
              !articleContent ||
              articleContent.trim().toLowerCase().startsWith("<!doctype html>")
            ) {
              const directRes = await fetch(input.content_url);
              if (!directRes.ok) {
                throw new Error(
                  `Failed to fetch URL directly (Status: ${directRes.status} ${directRes.statusText})`,
                );
              }
              const html = await directRes.text();
              articleContent = html.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ");
            }
          } catch (err: unknown) {
            throw new Error(
              `Error fetching URL content: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        if (!articleContent || articleContent.trim().length === 0) {
          throw new Error(
            "Provide either content_url or content_text, and URL must be accessible and contain text.",
          );
        }

        const concepts = await generateConceptsFromContent(articleContent, env?.geminiApiKey);
        const id = crypto.randomUUID();
        const session = createQuizSession(id, userId, articleContent, concepts);
        setSession(id, session);

        return jsonResult(`Quiz session ${id} created with ${concepts.length} concepts`, {
          sessionId: id,
          article: truncate(articleContent, 2000),
          concepts: concepts.map((c) => c.name),
          firstRound: sanitizeRound(session.currentRound),
        });
      }),
  );

  // ── quiz_submit_answers ──────────────────────────────────────────────────
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "quiz_submit_answers",
        "Submit answers for the current quiz round. Returns results, conflicts, and next round or badge.",
        {
          session_id: z.string().describe("Quiz session ID."),
          answers: z
            .tuple([
              z.number().int().min(0).max(3),
              z.number().int().min(0).max(3),
              z.number().int().min(0).max(3),
            ])
            .describe("Answers for each of the 3 questions (0-3 index)."),
        },
      )
      .meta({ category: "learn", tier: "free" })
      .handler(async ({ input }) => {
        const session = getSession(input.session_id);
        if (!session) throw new Error(`Session ${input.session_id} not found`);
        if (session.completed) throw new Error("Session already completed");

        const answers = input.answers as [number, number, number];
        const { results, conflicts, allMastered } = evaluateAnswers(session, answers);

        session.score = computeScore(session);

        if (allMastered) {
          session.completed = true;
          session.completedAt = Date.now();

          const badgePayload: BadgePayload = {
            sid: session.id,
            topic: session.concepts[0]?.name ?? "Quiz",
            score: session.score,
            ts: session.completedAt,
          };
          const token = generateBadgeToken(badgePayload, "quiz-badge-secret");

          return jsonResult("All concepts mastered! Quiz complete.", {
            results,
            conflicts,
            completed: true,
            score: session.score,
            badge: {
              token,
              topic: badgePayload.topic,
              score: badgePayload.score,
              completedAt: new Date(badgePayload.ts).toISOString(),
            },
          });
        }

        session.roundNumber++;
        session.currentRound = generateNextRound(session);

        return jsonResult(
          `Round ${session.roundNumber - 1} results: ${
            results.filter((r) => r.correct).length
          }/${QUESTIONS_PER_ROUND} correct` +
            (conflicts.length > 0 ? `. ${conflicts.length} conflict(s) detected!` : ""),
          {
            results,
            conflicts,
            completed: false,
            score: session.score,
            progress: session.conceptStates.map((s) => ({
              concept: s.name,
              mastered: s.mastered,
              correctCount: s.correctCount,
              attempts: s.attempts,
            })),
            nextRound: sanitizeRound(session.currentRound),
          },
        );
      }),
  );

  // ── quiz_get_badge ───────────────────────────────────────────────────────
  registry.registerBuilt(
    freeTool(userId, db)
      .tool("quiz_get_badge", "Get the badge for a completed quiz session.", {
        session_id: z.string().describe("Quiz session ID."),
      })
      .meta({ category: "learn", tier: "free" })
      .handler(async ({ input }) => {
        const session = getSession(input.session_id);
        if (!session) throw new Error(`Session ${input.session_id} not found`);
        if (!session.completed) throw new Error("Session not yet completed");

        const badgePayload: BadgePayload = {
          sid: session.id,
          topic: session.concepts[0]?.name ?? "Quiz",
          score: session.score,
          ts: session.completedAt ?? Date.now(),
        };
        const token = generateBadgeToken(badgePayload, "quiz-badge-secret");

        return jsonResult("Badge retrieved", {
          token,
          badgeUrl: `/learn/badge/${token}`,
          topic: badgePayload.topic,
          score: badgePayload.score,
          completedAt: new Date(badgePayload.ts).toISOString(),
          concepts: session.conceptStates.map((s) => ({
            name: s.name,
            mastered: s.mastered,
            correctCount: s.correctCount,
            attempts: s.attempts,
          })),
        });
      }),
  );
}
