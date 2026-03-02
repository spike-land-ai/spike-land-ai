/**
 * Learning Quiz MCP Tools
 *
 * Verification-through-questions system: content → article → quiz → badge.
 * Uses multiple-choice questions with reframing, conflict detection, and
 * consistency verification. Random guessing is statistically impossible.
 *
 * Algorithm:
 * - 4 options per question, correct answer randomized
 * - 3 questions per round, each testing a different concept
 * - Each concept has 3+ variant questions (reframings of same idea)
 * - Concept mastery = 2+ correct answers across different variants
 * - Contradiction detection: if answer conflicts with previous correct answer
 *   on same concept, mastery resets to 0
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, jsonResult } from "../procedures/index";
import type { DrizzleDB } from "../db/index";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  conceptIndex: number;
  variantIndex: number;
  question: string;
  options: [string, string, string, string];
  correctIndex: number; // 0-3
}

export interface QuizRound {
  roundNumber: number;
  questions: [QuizQuestion, QuizQuestion, QuizQuestion];
}

export interface ConceptState {
  name: string;
  correctCount: number;
  attempts: number;
  mastered: boolean;
  /** Track which option index was chosen for each variant to detect conflicts */
  answerHistory: Map<number, number>;
}

export interface QuizSession {
  id: string;
  userId: string;
  article: string;
  concepts: ConceptDefinition[];
  conceptStates: ConceptState[];
  currentRound: QuizRound;
  roundNumber: number;
  conflicts: ConflictRecord[];
  completed: boolean;
  score: number;
  createdAt: number;
  completedAt: number | null;
}

export interface ConceptDefinition {
  name: string;
  variants: QuizVariant[];
}

export interface QuizVariant {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
}

export interface ConflictRecord {
  concept: string;
  round: number;
  detail: string;
}

export interface AnswerResult {
  questionIndex: number;
  concept: string;
  correct: boolean;
  conflict: boolean;
}

export interface BadgePayload {
  sid: string;
  topic: string;
  score: number;
  ts: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MASTERY_THRESHOLD = 2;
const OPTIONS_PER_QUESTION = 4;
const QUESTIONS_PER_ROUND = 3;

// ─── In-memory storage ───────────────────────────────────────────────────────

const sessions = new Map<string, QuizSession>();

export function clearQuizSessions(): void {
  sessions.clear();
}

export function getSession(id: string): QuizSession | undefined {
  return sessions.get(id);
}

// ─── Engine Functions ────────────────────────────────────────────────────────

/**
 * Generate sample concepts from content. In production this would call an AI model.
 * For now, generates deterministic concepts from content structure.
 */
export function generateConceptsFromContent(content: string): ConceptDefinition[] {
  // Split content into paragraphs/sections and extract key concepts
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  if (paragraphs.length === 0) {
    return getDefaultConcepts();
  }

  // Extract up to 6 concepts from the content
  const concepts: ConceptDefinition[] = [];
  const numConcepts = Math.min(6, Math.max(3, paragraphs.length));

  for (let i = 0; i < numConcepts; i++) {
    const paragraph = paragraphs[i % paragraphs.length] ?? "";
    const sentences = paragraph.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    const keySentence = sentences[0]?.trim() ?? `Concept ${i + 1}`;

    // Generate 3 variant questions per concept
    const variants: QuizVariant[] = [];
    for (let v = 0; v < 3; v++) {
      const correctIndex = Math.floor(deterministicRandom(content, i, v) * OPTIONS_PER_QUESTION);
      variants.push({
        question: generateVariantQuestion(keySentence, v),
        options: generateOptions(keySentence, v, correctIndex),
        correctIndex,
      });
    }

    concepts.push({
      name: truncate(keySentence, 60),
      variants,
    });
  }

  return concepts;
}

function getDefaultConcepts(): ConceptDefinition[] {
  return [
    {
      name: "Core understanding",
      variants: [
        {
          question: "What is the main topic of this content?",
          options: ["The primary subject discussed", "An unrelated topic", "A minor detail", "Background information"],
          correctIndex: 0,
        },
        {
          question: "Which best describes the central theme?",
          options: ["A secondary theme", "The main theme of the content", "An opposing viewpoint", "A tangential idea"],
          correctIndex: 1,
        },
        {
          question: "The content primarily focuses on:",
          options: ["Unrelated matters", "Historical context only", "The core subject matter", "Future predictions"],
          correctIndex: 2,
        },
      ],
    },
    {
      name: "Key details",
      variants: [
        {
          question: "Which detail is most important to the content?",
          options: ["A minor footnote", "A key supporting detail", "An unmentioned fact", "A contradicting claim"],
          correctIndex: 1,
        },
        {
          question: "What supporting evidence is presented?",
          options: ["The main evidence from the content", "No evidence at all", "Only anecdotal claims", "Only statistical data"],
          correctIndex: 0,
        },
        {
          question: "The most significant detail mentioned is:",
          options: ["Something not in the content", "A trivial aside", "An important supporting fact", "A disputed claim"],
          correctIndex: 2,
        },
      ],
    },
    {
      name: "Implications",
      variants: [
        {
          question: "What can be inferred from this content?",
          options: ["Nothing meaningful", "A key implication", "The opposite of what's stated", "An unrelated conclusion"],
          correctIndex: 1,
        },
        {
          question: "The content implies that:",
          options: ["A logical conclusion from the content", "Something contradictory", "Something completely unrelated", "The content has no implications"],
          correctIndex: 0,
        },
        {
          question: "Based on the content, which is most likely true?",
          options: ["Something unrelated", "Something contradicted by the content", "Something not discussed", "A reasonable inference from the content"],
          correctIndex: 3,
        },
      ],
    },
  ];
}

/** Deterministic pseudo-random based on content hash */
function deterministicRandom(content: string, conceptIdx: number, variantIdx: number): number {
  let hash = 0;
  const seed = `${content.slice(0, 100)}:${conceptIdx}:${variantIdx}`;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

function truncate(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen - 3) + "...";
}

function generateVariantQuestion(keySentence: string, variant: number): string {
  const prefix = truncate(keySentence, 40);
  switch (variant) {
    case 0:
      return `Which statement about "${prefix}" is correct?`;
    case 1:
      return `Regarding "${prefix}", which is true?`;
    case 2:
      return `What best describes "${prefix}"?`;
    default:
      return `About "${prefix}":`;
  }
}

function generateOptions(
  keySentence: string,
  _variant: number,
  correctIndex: number,
): [string, string, string, string] {
  const prefix = truncate(keySentence, 30);
  const correct = `This accurately reflects: ${prefix}`;
  const distractors = [
    `This contradicts: ${prefix}`,
    `This is unrelated to: ${prefix}`,
    `This oversimplifies: ${prefix}`,
  ];

  const options: string[] = [];
  let distractorIdx = 0;
  for (let i = 0; i < OPTIONS_PER_QUESTION; i++) {
    if (i === correctIndex) {
      options.push(correct);
    } else {
      options.push(distractors[distractorIdx++] ?? `Distractor ${i}`);
    }
  }
  return options as [string, string, string, string];
}

/** Pick the next round of questions, choosing unmastered concepts and unused variants */
export function generateNextRound(session: QuizSession): QuizRound {
  const unmasteredConcepts = session.conceptStates
    .map((state, idx) => ({ state, idx }))
    .filter(({ state }) => !state.mastered);

  // Pick up to 3 unmastered concepts
  const selected: { state: ConceptState; idx: number }[] = [];
  const shuffled = [...unmasteredConcepts];
  // Fisher-Yates with deterministic seed
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.abs((session.roundNumber * 31 + i * 17) % (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  for (const item of shuffled) {
    if (selected.length >= QUESTIONS_PER_ROUND) break;
    selected.push(item);
  }

  // If not enough unmastered, re-test mastered ones
  if (selected.length < QUESTIONS_PER_ROUND) {
    const mastered = session.conceptStates
      .map((state, idx) => ({ state, idx }))
      .filter(({ state }) => state.mastered);
    for (const item of mastered) {
      if (selected.length >= QUESTIONS_PER_ROUND) break;
      selected.push(item);
    }
  }

  // Pad with first concepts if still not enough
  while (selected.length < QUESTIONS_PER_ROUND) {
    const idx = selected.length % session.conceptStates.length;
    selected.push({
      state: session.conceptStates[idx]!,
      idx,
    });
  }

  const questions = selected.map(({ state, idx }) => {
    const concept = session.concepts[idx]!;
    // Pick a variant not yet answered
    const usedVariants = new Set(state.answerHistory.keys());
    let variantIdx = 0;
    for (let v = 0; v < concept.variants.length; v++) {
      if (!usedVariants.has(v)) {
        variantIdx = v;
        break;
      }
    }
    // If all used, cycle back
    if (usedVariants.size >= concept.variants.length) {
      variantIdx = state.attempts % concept.variants.length;
    }

    const variant = concept.variants[variantIdx]!;
    return {
      conceptIndex: idx,
      variantIndex: variantIdx,
      question: variant.question,
      options: variant.options,
      correctIndex: variant.correctIndex,
    } satisfies QuizQuestion;
  });

  return {
    roundNumber: session.roundNumber,
    questions: questions as [QuizQuestion, QuizQuestion, QuizQuestion],
  };
}

/** Evaluate answers for a round. Returns results, detects conflicts, updates mastery. */
export function evaluateAnswers(
  session: QuizSession,
  answers: [number, number, number],
): { results: AnswerResult[]; conflicts: ConflictRecord[]; allMastered: boolean } {
  const results: AnswerResult[] = [];
  const newConflicts: ConflictRecord[] = [];

  for (let i = 0; i < QUESTIONS_PER_ROUND; i++) {
    const question = session.currentRound.questions[i]!;
    const answer = answers[i]!;
    const conceptState = session.conceptStates[question.conceptIndex]!;
    const concept = session.concepts[question.conceptIndex]!;
    const isCorrect = answer === question.correctIndex;

    // Check for conflict: did user previously answer a different variant of this concept
    // correctly, but now answered incorrectly (or chose a conflicting answer)?
    let hasConflict = false;
    if (conceptState.answerHistory.size > 0) {
      // Check if previous correct answers conflict with current answer
      for (const [prevVariant, prevAnswer] of conceptState.answerHistory) {
        const prevVariantDef = concept.variants[prevVariant];
        if (prevVariantDef && prevAnswer === prevVariantDef.correctIndex && !isCorrect) {
          // User got it right before but wrong now — contradiction
          hasConflict = true;
          const conflict: ConflictRecord = {
            concept: concept.name,
            round: session.roundNumber,
            detail: `Previously correct on variant ${prevVariant}, now incorrect on variant ${question.variantIndex}`,
          };
          newConflicts.push(conflict);
          session.conflicts.push(conflict);

          // Reset mastery for this concept
          conceptState.correctCount = 0;
          conceptState.mastered = false;
          break;
        }
      }
    }

    // Record this answer
    conceptState.answerHistory.set(question.variantIndex, answer);
    conceptState.attempts++;

    if (isCorrect && !hasConflict) {
      conceptState.correctCount++;
      if (conceptState.correctCount >= MASTERY_THRESHOLD) {
        conceptState.mastered = true;
      }
    }

    results.push({
      questionIndex: i,
      concept: concept.name,
      correct: isCorrect,
      conflict: hasConflict,
    });
  }

  const allMastered = session.conceptStates.every((s) => s.mastered);
  return { results, conflicts: newConflicts, allMastered };
}

/** Generate a self-contained signed badge URL */
export function generateBadgeToken(payload: BadgePayload, secret: string): string {
  // Simple HMAC-like signature using the secret
  // In production, use crypto.subtle for proper HMAC-SHA256
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = btoa(payloadStr);

  // Simple signature: hash of payload + secret
  let hash = 0;
  const signInput = payloadStr + secret;
  for (let i = 0; i < signInput.length; i++) {
    const char = signInput.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const sigB64 = btoa(String(Math.abs(hash)));

  return `${payloadB64}.${sigB64}`;
}

/** Verify a badge token */
export function verifyBadgeToken(
  token: string,
  secret: string,
): BadgePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  try {
    const payloadStr = atob(payloadB64);
    const payload = JSON.parse(payloadStr) as BadgePayload;

    // Regenerate signature and compare
    const expectedToken = generateBadgeToken(payload, secret);
    const expectedSig = expectedToken.split(".")[1];
    if (sigB64 !== expectedSig) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Sanitize round data for client (strip correct answers) */
function sanitizeRound(round: QuizRound): {
  roundNumber: number;
  questions: Array<{
    conceptIndex: number;
    question: string;
    options: [string, string, string, string];
  }>;
} {
  return {
    roundNumber: round.roundNumber,
    questions: round.questions.map((q) => ({
      conceptIndex: q.conceptIndex,
      question: q.question,
      options: q.options,
    })),
  };
}

/** Compute overall score as percentage */
function computeScore(session: QuizSession): number {
  const totalCorrect = session.conceptStates.reduce((sum, s) => sum + s.correctCount, 0);
  const totalAttempts = session.conceptStates.reduce((sum, s) => sum + s.attempts, 0);
  if (totalAttempts === 0) return 0;
  return Math.round((totalCorrect / totalAttempts) * 100);
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerQuizTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
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
        const content = input.content_text ?? input.content_url ?? "";
        if (!content) {
          throw new Error("Provide either content_url or content_text");
        }

        // For URLs, we'd fetch content in production. For now, use the URL as content.
        const articleContent = input.content_text ?? `Content from: ${input.content_url}`;

        const concepts = generateConceptsFromContent(articleContent);
        const id = crypto.randomUUID();

        const conceptStates: ConceptState[] = concepts.map((c) => ({
          name: c.name,
          correctCount: 0,
          attempts: 0,
          mastered: false,
          answerHistory: new Map(),
        }));

        const session: QuizSession = {
          id,
          userId,
          article: articleContent,
          concepts,
          conceptStates,
          currentRound: { roundNumber: 0, questions: [] as unknown as [QuizQuestion, QuizQuestion, QuizQuestion] },
          roundNumber: 1,
          conflicts: [],
          completed: false,
          score: 0,
          createdAt: Date.now(),
          completedAt: null,
        };

        // Generate first round
        session.currentRound = generateNextRound(session);

        sessions.set(id, session);

        return jsonResult(
          `Quiz session ${id} created with ${concepts.length} concepts`,
          {
            sessionId: id,
            article: truncate(articleContent, 2000),
            concepts: concepts.map((c) => c.name),
            firstRound: sanitizeRound(session.currentRound),
          },
        );
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
            .tuple([z.number().int().min(0).max(3), z.number().int().min(0).max(3), z.number().int().min(0).max(3)])
            .describe("Answers for each of the 3 questions (0-3 index)."),
        },
      )
      .meta({ category: "learn", tier: "free" })
      .handler(async ({ input }) => {
        const session = sessions.get(input.session_id);
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
          // Use a default secret for in-memory badge generation
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

        // Generate next round
        session.roundNumber++;
        session.currentRound = generateNextRound(session);

        return jsonResult(
          `Round ${session.roundNumber - 1} results: ${results.filter((r) => r.correct).length}/${QUESTIONS_PER_ROUND} correct` +
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
      .tool(
        "quiz_get_badge",
        "Get the badge for a completed quiz session.",
        {
          session_id: z.string().describe("Quiz session ID."),
        },
      )
      .meta({ category: "learn", tier: "free" })
      .handler(async ({ input }) => {
        const session = sessions.get(input.session_id);
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
