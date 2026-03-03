import { describe, expect, it } from "vitest";

import {
  ALLOWED_CATEGORIES,
  BLOCKED_TOPICS,
  ClassificationResultSchema,
  CLASSIFY_SYSTEM_PROMPT,
  validateSlug,
} from "./slug-classifier";

describe("ALLOWED_CATEGORIES", () => {
  it("contains expected categories", () => {
    expect(ALLOWED_CATEGORIES).toContain("games");
    expect(ALLOWED_CATEGORIES).toContain("education");
    expect(ALLOWED_CATEGORIES).toContain("finance");
    expect(ALLOWED_CATEGORIES).toContain("music");
  });

  it("has unique categories", () => {
    const unique = new Set(ALLOWED_CATEGORIES);
    expect(unique.size).toBe(ALLOWED_CATEGORIES.length);
  });
});

describe("BLOCKED_TOPICS", () => {
  it("contains expected blocked topics", () => {
    expect(BLOCKED_TOPICS).toContain("hate-speech");
    expect(BLOCKED_TOPICS).toContain("violence");
    expect(BLOCKED_TOPICS).toContain("self-harm");
  });
});

describe("ClassificationResultSchema", () => {
  it("accepts valid classification", () => {
    const result = ClassificationResultSchema.safeParse({
      status: "ok",
      slug: "games/tetris",
      category: "games",
      reason: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts blocked status", () => {
    const result = ClassificationResultSchema.safeParse({
      status: "blocked",
      slug: "",
      category: "",
      reason: "Not allowed",
    });
    expect(result.success).toBe(true);
  });

  it("accepts unclear status", () => {
    const result = ClassificationResultSchema.safeParse({
      status: "unclear",
      slug: "",
      category: "",
      reason: "Too vague",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = ClassificationResultSchema.safeParse({
      status: "invalid",
      slug: "test",
      category: "test",
      reason: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("CLASSIFY_SYSTEM_PROMPT", () => {
  it("includes categories", () => {
    for (const cat of ALLOWED_CATEGORIES) {
      expect(CLASSIFY_SYSTEM_PROMPT).toContain(cat);
    }
  });

  it("includes blocked topics", () => {
    for (const topic of BLOCKED_TOPICS) {
      expect(CLASSIFY_SYSTEM_PROMPT).toContain(topic);
    }
  });
});

describe("validateSlug", () => {
  it("lowercases the slug", () => {
    expect(validateSlug("GAMES/Tetris")).toBe("games/tetris");
  });

  it("removes invalid characters", () => {
    expect(validateSlug("games/my app!@#$")).toBe("games/myapp");
  });

  it("collapses multiple slashes", () => {
    expect(validateSlug("games///tetris")).toBe("games/tetris");
  });

  it("collapses multiple hyphens", () => {
    expect(validateSlug("games/my---app")).toBe("games/my-app");
  });

  it("trims leading slashes and hyphens", () => {
    expect(validateSlug("/games/tetris")).toBe("games/tetris");
    expect(validateSlug("-games/tetris")).toBe("games/tetris");
  });

  it("trims trailing slashes and hyphens", () => {
    expect(validateSlug("games/tetris/")).toBe("games/tetris");
    expect(validateSlug("games/tetris-")).toBe("games/tetris");
  });

  it("enforces max 3 segments", () => {
    expect(validateSlug("a/b/c/d/e")).toBe("a/b/c");
  });

  it("enforces max 80 characters", () => {
    const longSlug = "games/" + "x".repeat(100);
    const result = validateSlug(longSlug);
    expect(result.length).toBeLessThanOrEqual(80);
  });

  it("preserves valid slugs", () => {
    expect(validateSlug("games/tetris")).toBe("games/tetris");
    expect(validateSlug("health/water-tracker")).toBe("health/water-tracker");
  });
});
