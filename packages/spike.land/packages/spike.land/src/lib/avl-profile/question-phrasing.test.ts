import { describe, expect, it } from "vitest";
import { rephraseQuestion } from "./question-phrasing";

describe("rephraseQuestion", () => {
  it("rephrases all 7 seed questions with non-canonical text", () => {
    const seeds = [
      "Do you write code as part of your work?",
      "Do you create visual content?",
      "Do you manage social media accounts?",
      "Are you interested in AI and automation?",
      "Do you work in a team of more than 5 people?",
      "Do you primarily use mobile devices?",
      "Are you interested in music or audio production?",
    ];

    for (const q of seeds) {
      const result = rephraseQuestion(q, [], 1);
      expect(result.headline).not.toBe(q);
      expect(result.yesLabel).toBeTruthy();
      expect(result.noLabel).toBeTruthy();
    }
  });

  it("falls back to canonical text for unknown questions", () => {
    const result = rephraseQuestion("Some AI-generated question?", ["ai"], 1);
    expect(result.headline).toBe("Some AI-generated question?");
    expect(result.yesLabel).toBe("Yes");
    expect(result.noLabel).toBe("No");
  });

  it("adds subtext for round 2+", () => {
    const result = rephraseQuestion("Do you create visual content?", [
      "creative",
    ], 2);
    expect(result.subtext).toBe("We're getting to know you better");
  });

  it("does not add subtext for round 1", () => {
    const result = rephraseQuestion("Do you create visual content?", [
      "creative",
    ], 1);
    expect(result.subtext).toBeUndefined();
  });
});
