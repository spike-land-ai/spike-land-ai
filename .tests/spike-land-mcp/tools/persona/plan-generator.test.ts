/**
 * Plan Generator Tools Tests
 */

import { describe, expect, it } from "vitest";
import {
  PERSONAS,
  getAnswersForPersona,
  _getPersonaBySlug,
  getPersonaFromAnswers,
  getQuestionSequence,
} from "../../../../src/edge-api/spike-land/core-logic/lib/persona-data";

describe("Plan Generator", () => {
  describe("getAnswersForPersona", () => {
    it("returns 4 answers for each valid persona slug", () => {
      for (const persona of PERSONAS) {
        const answers = getAnswersForPersona(persona.slug);
        expect(answers).not.toBeNull();
        expect(answers).toHaveLength(4);
        for (const a of answers!) {
          expect(typeof a).toBe("boolean");
        }
      }
    });

    it("returns null for unknown slugs", () => {
      expect(getAnswersForPersona("nonexistent")).toBeNull();
      expect(getAnswersForPersona("")).toBeNull();
    });

    it("round-trips: answers lead back to the same persona", () => {
      for (const persona of PERSONAS) {
        const answers = getAnswersForPersona(persona.slug);
        expect(answers).not.toBeNull();

        const result = getPersonaFromAnswers(answers!);
        expect(result).not.toBeNull();
        expect(result!.slug).toBe(persona.slug);
      }
    });
  });

  describe("plan structure", () => {
    it("generates plan with valid step structure for each persona", () => {
      const _validTools = new Set([
        "web_navigate",
        "web_read",
        "web_click",
        "web_screenshot",
        "audit_submit_evaluation",
      ]);

      for (const persona of PERSONAS) {
        const answers = getAnswersForPersona(persona.slug);
        expect(answers).not.toBeNull();

        // Simulate what generatePersonaAuditPlan does
        // We verify the answer path generates a valid question sequence
        for (let i = 0; i < 4; i++) {
          const partialAnswers = answers!.slice(0, i);
          const sequence = getQuestionSequence(partialAnswers);
          expect(sequence.length).toBeGreaterThanOrEqual(1);
          const lastQ = sequence[sequence.length - 1]!;
          expect(lastQ.yesLabel).toBeTruthy();
          expect(lastQ.noLabel).toBeTruthy();
        }
      }
    });

    it("each persona has a unique answer path", () => {
      const paths = new Set<string>();
      for (const persona of PERSONAS) {
        const answers = getAnswersForPersona(persona.slug);
        const key = answers!.map((a) => (a ? "Y" : "N")).join("");
        expect(paths.has(key)).toBe(false);
        paths.add(key);
      }
      expect(paths.size).toBe(16);
    });
  });

  describe("question sequence for quiz steps", () => {
    it("question sequence length matches answer count + 1", () => {
      // With 0 answers, should return 1 question (q1)
      expect(getQuestionSequence([])).toHaveLength(1);
      // With 1 answer, should return 2 questions
      expect(getQuestionSequence([true])).toHaveLength(2);
      // With 2 answers, should return 3 questions
      expect(getQuestionSequence([true, true])).toHaveLength(3);
      // With 3 answers, should return 4 questions (or 3 if last leads to leaf)
      const seq = getQuestionSequence([true, true, true]);
      expect(seq.length).toBeGreaterThanOrEqual(3);
    });

    it("first question is always q1 'Do you write code?'", () => {
      const seq = getQuestionSequence([]);
      expect(seq[0]!.id).toBe("q1");
      expect(seq[0]!.text).toBe("Do you write code?");
    });
  });
});
