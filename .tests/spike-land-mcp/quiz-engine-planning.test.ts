import { describe, it, expect } from "vitest";
import {
  generatePlanningConcepts,
  createQuizSession,
  evaluateAnswers,
  computeScore,
  generateNextRound,
  sanitizeRound,
  generateBadgeToken,
  verifyBadgeToken,
  QUESTIONS_PER_ROUND,
} from "../../src/edge-api/spike-land/core-logic/lib/quiz-engine";

describe("generatePlanningConcepts", () => {
  it("returns 6 hardcoded planning concepts when no Gemini key", async () => {
    const concepts = await generatePlanningConcepts(
      "Implement a useDebounce React hook",
      undefined,
      undefined,
    );

    expect(concepts).toHaveLength(6);
    const names = concepts.map((c) => c.name);
    expect(names).toContain("file_awareness");
    expect(names).toContain("test_strategy");
    expect(names).toContain("edge_cases");
    expect(names).toContain("dependency_chain");
    expect(names).toContain("failure_modes");
    expect(names).toContain("verification");
  });

  it("each concept has 3 variants with 4 options", async () => {
    const concepts = await generatePlanningConcepts("Build a REST API", undefined, undefined);

    for (const concept of concepts) {
      expect(concept.variants).toHaveLength(3);
      for (const variant of concept.variants) {
        expect(variant.options).toHaveLength(4);
        expect(variant.correctIndex).toBeGreaterThanOrEqual(0);
        expect(variant.correctIndex).toBeLessThanOrEqual(3);
        expect(variant.question.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("planning interview session lifecycle", () => {
  it("creates a session with 6 concepts and generates a first round", async () => {
    const concepts = await generatePlanningConcepts("Add caching layer", undefined, undefined);
    const session = createQuizSession("test-1", "user-1", "Add caching layer", concepts);

    expect(session.id).toBe("test-1");
    expect(session.concepts).toHaveLength(6);
    expect(session.conceptStates).toHaveLength(6);
    expect(session.currentRound.questions).toHaveLength(QUESTIONS_PER_ROUND);
    expect(session.completed).toBe(false);
    expect(session.score).toBe(0);
  });

  it("evaluates correct answers and tracks mastery", async () => {
    const concepts = await generatePlanningConcepts("Fix auth bug", undefined, undefined);
    const session = createQuizSession("test-2", "user-1", "Fix auth bug", concepts);

    // Answer all correctly
    const correctAnswers = session.currentRound.questions.map((q) => q.correctIndex) as [
      number,
      number,
      number,
    ];

    const { results, conflicts, allMastered } = evaluateAnswers(session, correctAnswers);

    expect(results).toHaveLength(QUESTIONS_PER_ROUND);
    expect(results.every((r) => r.correct)).toBe(true);
    expect(conflicts).toHaveLength(0);
    // Not all mastered yet — need 2 correct per concept
    expect(allMastered).toBe(false);
  });

  it("detects incorrect answers", async () => {
    const concepts = await generatePlanningConcepts("Refactor module", undefined, undefined);
    const session = createQuizSession("test-3", "user-1", "Refactor module", concepts);

    // Answer all wrong (pick index that's not correct)
    const wrongAnswers = session.currentRound.questions.map((q) => (q.correctIndex + 1) % 4) as [
      number,
      number,
      number,
    ];

    const { results } = evaluateAnswers(session, wrongAnswers);
    expect(results.every((r) => !r.correct)).toBe(true);
  });

  it("achieves mastery after 2 correct answers per concept", async () => {
    const concepts = await generatePlanningConcepts("Deploy service", undefined, undefined);
    const session = createQuizSession("test-4", "user-1", "Deploy service", concepts);

    // Run multiple rounds, answering correctly each time
    let allMastered = false;
    for (let round = 0; round < 20 && !allMastered; round++) {
      const correctAnswers = session.currentRound.questions.map((q) => q.correctIndex) as [
        number,
        number,
        number,
      ];

      const result = evaluateAnswers(session, correctAnswers);
      allMastered = result.allMastered;

      if (!allMastered) {
        session.roundNumber++;
        session.currentRound = generateNextRound(session);
      }
    }

    expect(allMastered).toBe(true);
    const score = computeScore(session);
    expect(score).toBe(100);
  });

  it("sanitizeRound strips correctIndex", async () => {
    const concepts = await generatePlanningConcepts("Write tests", undefined, undefined);
    const session = createQuizSession("test-5", "user-1", "Write tests", concepts);

    const sanitized = sanitizeRound(session.currentRound);
    expect(sanitized.questions).toHaveLength(QUESTIONS_PER_ROUND);
    for (const q of sanitized.questions) {
      expect(q).not.toHaveProperty("correctIndex");
      expect(q).toHaveProperty("question");
      expect(q).toHaveProperty("options");
    }
  });
});

describe("badge tokens", () => {
  it("generates and verifies a badge token", () => {
    const payload = { sid: "s1", topic: "Planning Interview", score: 100, ts: Date.now() };
    const token = generateBadgeToken(payload, "secret");

    expect(token).toContain(".");
    const verified = verifyBadgeToken(token, "secret");
    expect(verified).toEqual(payload);
  });

  it("rejects token with wrong secret", () => {
    const payload = { sid: "s2", topic: "Test", score: 80, ts: Date.now() };
    const token = generateBadgeToken(payload, "secret1");
    const verified = verifyBadgeToken(token, "secret2");
    expect(verified).toBeNull();
  });
});
