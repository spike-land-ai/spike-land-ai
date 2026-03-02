import { describe, expect, it } from "vitest";

import {
  derivePersonaSlugFromTags,
  getPersonaBySlug,
  getPersonaFromAnswers,
  getQuestionSequence,
  ONBOARDING_TREE,
  PERSONAS,
} from "./personas";

describe("onboarding personas", () => {
  describe("PERSONAS data", () => {
    it("has exactly 16 personas", () => {
      expect(PERSONAS).toHaveLength(16);
    });

    it("has unique ids from 1-16", () => {
      const ids = PERSONAS.map((p) => p.id).sort((a, b) => a - b);
      expect(ids).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    });

    it("has unique slugs", () => {
      const slugs = PERSONAS.map((p) => p.slug);
      expect(new Set(slugs).size).toBe(16);
    });

    it("every persona has recommended app slugs", () => {
      for (const p of PERSONAS) {
        expect(p.recommendedAppSlugs.length).toBeGreaterThan(0);
      }
    });
  });

  describe("ONBOARDING_TREE", () => {
    it("starts with q1", () => {
      expect(ONBOARDING_TREE[0]!.id).toBe("q1");
    });

    it("has valid next references", () => {
      const questionIds = new Set(ONBOARDING_TREE.map((q) => q.id));
      const personaIds = new Set(PERSONAS.map((p) => p.id));

      for (const q of ONBOARDING_TREE) {
        for (const next of [q.yesNext, q.noNext]) {
          if (typeof next === "string") {
            expect(questionIds.has(next)).toBe(true);
          } else {
            expect(personaIds.has(next)).toBe(true);
          }
        }
      }
    });
  });

  describe("getPersonaFromAnswers", () => {
    it("returns null for wrong-length answers", () => {
      expect(getPersonaFromAnswers([])).toBeNull();
      expect(getPersonaFromAnswers([true])).toBeNull();
      expect(getPersonaFromAnswers([true, true, true])).toBeNull();
      expect(getPersonaFromAnswers([true, true, true, true, true])).toBeNull();
    });

    // All 16 paths through the tree
    const ALL_PATHS: {
      answers: [boolean, boolean, boolean, boolean];
      expectedId: number;
      expectedSlug: string;
    }[] = [
      // Tech > Apps & products > Myself/startup > AI-powered
      {
        answers: [true, true, true, true],
        expectedId: 1,
        expectedSlug: "ai-indie",
      },
      // Tech > Apps & products > Myself/startup > Traditional
      {
        answers: [true, true, true, false],
        expectedId: 2,
        expectedSlug: "classic-indie",
      },
      // Tech > Apps & products > Client/employer > Multiple clients
      {
        answers: [true, true, false, true],
        expectedId: 3,
        expectedSlug: "agency-dev",
      },
      // Tech > Apps & products > Client/employer > One employer
      {
        answers: [true, true, false, false],
        expectedId: 4,
        expectedSlug: "in-house-dev",
      },
      // Tech > Tools/infra > AI & ML > Production ML
      {
        answers: [true, false, true, true],
        expectedId: 5,
        expectedSlug: "ml-engineer",
      },
      // Tech > Tools/infra > AI & ML > Exploring
      {
        answers: [true, false, true, false],
        expectedId: 6,
        expectedSlug: "ai-hobbyist",
      },
      // Tech > Tools/infra > DevOps > Large team
      {
        answers: [true, false, false, true],
        expectedId: 7,
        expectedSlug: "enterprise-devops",
      },
      // Tech > Tools/infra > DevOps > Small team
      {
        answers: [true, false, false, false],
        expectedId: 8,
        expectedSlug: "startup-devops",
      },
      // Non-tech > Business > Just me > Technical
      {
        answers: [false, true, true, true],
        expectedId: 9,
        expectedSlug: "technical-founder",
      },
      // Non-tech > Business > Just me > Not technical
      {
        answers: [false, true, true, false],
        expectedId: 10,
        expectedSlug: "nontechnical-founder",
      },
      // Non-tech > Business > Have a team > Growth
      {
        answers: [false, true, false, true],
        expectedId: 11,
        expectedSlug: "growth-leader",
      },
      // Non-tech > Business > Have a team > Efficiency
      {
        answers: [false, true, false, false],
        expectedId: 12,
        expectedSlug: "ops-leader",
      },
      // Non-tech > Personal > Content & art > Has audience
      {
        answers: [false, false, true, true],
        expectedId: 13,
        expectedSlug: "content-creator",
      },
      // Non-tech > Personal > Content & art > For myself
      {
        answers: [false, false, true, false],
        expectedId: 14,
        expectedSlug: "hobbyist-creator",
      },
      // Non-tech > Personal > Games/learning > Multiplayer
      {
        answers: [false, false, false, true],
        expectedId: 15,
        expectedSlug: "social-gamer",
      },
      // Non-tech > Personal > Games/learning > Solo
      {
        answers: [false, false, false, false],
        expectedId: 16,
        expectedSlug: "solo-explorer",
      },
    ];

    it.each(ALL_PATHS)("answers $answers -> persona #$expectedId ($expectedSlug)", ({
      answers,
      expectedId,
      expectedSlug,
    }) => {
      const persona = getPersonaFromAnswers(answers);
      expect(persona).not.toBeNull();
      expect(persona!.id).toBe(expectedId);
      expect(persona!.slug).toBe(expectedSlug);
    });

    it("covers all 16 personas", () => {
      const reachedIds = new Set(
        ALL_PATHS.map(({ answers }) => getPersonaFromAnswers(answers)!.id),
      );
      expect(reachedIds.size).toBe(16);
    });
  });

  describe("getQuestionSequence", () => {
    it("returns 4 questions for a full answer path", () => {
      const seq = getQuestionSequence([true, true, true, true]);
      expect(seq).toHaveLength(4);
      expect(seq[0]!.id).toBe("q1");
    });

    it("returns partial sequence for partial answers", () => {
      const seq = getQuestionSequence([true]);
      expect(seq).toHaveLength(2);
      expect(seq[0]!.id).toBe("q1");
      expect(seq[1]!.id).toBe("q2-tech");
    });

    it("returns just q1 for empty answers", () => {
      const seq = getQuestionSequence([]);
      expect(seq).toHaveLength(1);
      expect(seq[0]!.id).toBe("q1");
    });

    it("follows the non-tech business branch", () => {
      const seq = getQuestionSequence([false, true, false, true]);
      expect(seq[0]!.id).toBe("q1");
      expect(seq[1]!.id).toBe("q2-nontech");
      expect(seq[2]!.id).toBe("q3-business");
      expect(seq[3]!.id).toBe("q4-teamlead");
    });
  });

  describe("getPersonaBySlug", () => {
    it("returns persona for valid slug", () => {
      const persona = getPersonaBySlug("agency-dev");
      expect(persona).not.toBeNull();
      expect(persona!.id).toBe(3);
    });

    it("returns null for invalid slug", () => {
      expect(getPersonaBySlug("nonexistent")).toBeNull();
    });

    it("returns null for old slugs that no longer exist", () => {
      expect(getPersonaBySlug("indie-shipper")).toBeNull();
      expect(getPersonaBySlug("enterprise-scout")).toBeNull();
      expect(getPersonaBySlug("traditional-learner")).toBeNull();
    });
  });

  describe("derivePersonaSlugFromTags", () => {
    it("returns null for empty tags", () => {
      expect(derivePersonaSlugFromTags([])).toBeNull();
    });

    it("matches developer + ai tags to ai-indie", () => {
      const slug = derivePersonaSlugFromTags(["developer", "ai", "indie"]);
      expect(slug).toBe("ai-indie");
    });

    it("matches developer + devops + enterprise to enterprise-devops", () => {
      const slug = derivePersonaSlugFromTags([
        "developer",
        "devops",
        "enterprise",
        "infrastructure",
      ]);
      expect(slug).toBe("enterprise-devops");
    });

    it("matches creative + content + audience to content-creator", () => {
      const slug = derivePersonaSlugFromTags(["creative", "content", "audience", "creator"]);
      expect(slug).toBe("content-creator");
    });

    it("matches gaming + multiplayer to social-gamer", () => {
      const slug = derivePersonaSlugFromTags(["gaming", "multiplayer", "social"]);
      expect(slug).toBe("social-gamer");
    });

    it("matches business + growth + marketing to growth-leader", () => {
      const slug = derivePersonaSlugFromTags(["business", "growth", "marketing"]);
      expect(slug).toBe("growth-leader");
    });

    it("is case-insensitive", () => {
      const slug = derivePersonaSlugFromTags(["Developer", "AI", "Indie"]);
      expect(slug).toBe("ai-indie");
    });

    it("returns the best match when multiple tags match different personas", () => {
      // "developer" matches many, but "ai" + "ml" + "production" + "model" narrows to ml-engineer
      const slug = derivePersonaSlugFromTags(["developer", "ai", "ml", "production", "model"]);
      expect(slug).toBe("ml-engineer");
    });

    it("returns a valid persona slug", () => {
      const slug = derivePersonaSlugFromTags(["developer"]);
      expect(slug).not.toBeNull();
      // Should match one of the developer personas
      const persona = getPersonaBySlug(slug!);
      expect(persona).not.toBeNull();
    });
  });
});
