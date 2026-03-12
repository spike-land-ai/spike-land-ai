import { describe, expect, it } from "vitest";
import {
  getPersonaFromAnswers,
  getQuestionSequence,
  ONBOARDING_TREE,
  PERSONAS,
} from "../../../../src/cli/spike-cli/core-logic/onboarding/wizard.js";

describe("onboarding wizard — decision tree", () => {
  describe("getPersonaFromAnswers", () => {
    it("returns null for fewer than 4 answers", () => {
      expect(getPersonaFromAnswers([true, false])).toBeNull();
    });

    it("returns null for more than 4 answers", () => {
      expect(getPersonaFromAnswers([true, true, true, true, true])).toBeNull();
    });

    // All-yes path: q1(y) → q2-tech(y) → q3-product(y) → q4-indie(y) → persona 1 (AI Indie)
    it("returns AI Indie for all-yes path", () => {
      const persona = getPersonaFromAnswers([true, true, true, true]);
      expect(persona).not.toBeNull();
      expect(persona!.id).toBe(1);
      expect(persona!.slug).toBe("ai-indie");
    });

    // All-no path: q1(n) → q2-nontech(n) → q3-personal(n) → q4-casual(n) → persona 16 (Solo Explorer)
    it("returns Solo Explorer for all-no path", () => {
      const persona = getPersonaFromAnswers([false, false, false, false]);
      expect(persona).not.toBeNull();
      expect(persona!.id).toBe(16);
      expect(persona!.slug).toBe("solo-explorer");
    });

    // q1(y) → q2-tech(n) → q3-platform(y) → q4-ai(y) → persona 5 (ML Engineer)
    it("returns ML Engineer for [y, n, y, y]", () => {
      const persona = getPersonaFromAnswers([true, false, true, true]);
      expect(persona).not.toBeNull();
      expect(persona!.id).toBe(5);
      expect(persona!.slug).toBe("ml-engineer");
    });

    // q1(n) → q2-nontech(y) → q3-business(n) → q4-teamlead(y) → persona 11 (Growth Leader)
    it("returns Growth Leader for [n, y, n, y]", () => {
      const persona = getPersonaFromAnswers([false, true, false, true]);
      expect(persona).not.toBeNull();
      expect(persona!.id).toBe(11);
      expect(persona!.slug).toBe("growth-leader");
    });
  });

  describe("all 16 persona paths", () => {
    // Enumerate all 16 paths through the binary tree
    const allPaths: [boolean[], number, string][] = [
      [[true, true, true, true], 1, "ai-indie"],
      [[true, true, true, false], 2, "classic-indie"],
      [[true, true, false, true], 3, "agency-dev"],
      [[true, true, false, false], 4, "in-house-dev"],
      [[true, false, true, true], 5, "ml-engineer"],
      [[true, false, true, false], 6, "ai-hobbyist"],
      [[true, false, false, true], 7, "enterprise-devops"],
      [[true, false, false, false], 8, "startup-devops"],
      [[false, true, true, true], 9, "technical-founder"],
      [[false, true, true, false], 10, "nontechnical-founder"],
      [[false, true, false, true], 11, "growth-leader"],
      [[false, true, false, false], 12, "ops-leader"],
      [[false, false, true, true], 13, "content-creator"],
      [[false, false, true, false], 14, "hobbyist-creator"],
      [[false, false, false, true], 15, "social-gamer"],
      [[false, false, false, false], 16, "solo-explorer"],
    ];

    for (const [answers, expectedId, expectedSlug] of allPaths) {
      const label = answers.map((a) => (a ? "y" : "n")).join(",");
      it(`[${label}] → persona ${expectedId} (${expectedSlug})`, () => {
        const persona = getPersonaFromAnswers(answers);
        expect(persona).not.toBeNull();
        expect(persona!.id).toBe(expectedId);
        expect(persona!.slug).toBe(expectedSlug);
      });
    }

    it("covers all 16 personas", () => {
      const reachedIds = new Set(allPaths.map(([answers]) => getPersonaFromAnswers(answers)!.id));
      expect(reachedIds.size).toBe(16);
      for (let i = 1; i <= 16; i++) {
        expect(reachedIds.has(i)).toBe(true);
      }
    });
  });

  describe("getQuestionSequence", () => {
    it("returns q1 when no answers given", () => {
      const seq = getQuestionSequence([]);
      expect(seq).toHaveLength(1);
      expect(seq[0].id).toBe("q1");
    });

    it("follows yes branch after first answer", () => {
      const seq = getQuestionSequence([true]);
      expect(seq).toHaveLength(2);
      expect(seq[0].id).toBe("q1");
      expect(seq[1].id).toBe("q2-tech");
    });

    it("follows no branch after first answer", () => {
      const seq = getQuestionSequence([false]);
      expect(seq).toHaveLength(2);
      expect(seq[0].id).toBe("q1");
      expect(seq[1].id).toBe("q2-nontech");
    });

    it("returns full 4-question path", () => {
      const seq = getQuestionSequence([true, true, true]);
      expect(seq).toHaveLength(4);
      expect(seq.map((q) => q.id)).toEqual(["q1", "q2-tech", "q3-product", "q4-indie"]);
    });
  });

  describe("data integrity", () => {
    it("has 15 questions in the tree", () => {
      expect(ONBOARDING_TREE).toHaveLength(15);
    });

    it("has 16 personas", () => {
      expect(PERSONAS).toHaveLength(16);
    });

    it("persona IDs are 1-16", () => {
      const ids = PERSONAS.map((p) => p.id).sort((a, b) => a - b);
      expect(ids).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    });

    it("all persona slugs are unique", () => {
      const slugs = new Set(PERSONAS.map((p) => p.slug));
      expect(slugs.size).toBe(16);
    });
  });
});
