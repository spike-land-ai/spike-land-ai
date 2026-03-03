import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gemini-client", () => ({
  generateStructuredResponse: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/try-catch", () => ({
  tryCatch: vi.fn((p: Promise<unknown>) =>
    p.then((data: unknown) => ({ data, error: null })).catch((error: unknown) => ({
      data: null,
      error,
    }))
  ),
}));
vi.mock("diff", () => ({
  diffWords: (a: string, b: string) => {
    if (a === b) return [{ value: a }];
    return [
      { value: a, removed: true },
      { value: b, added: true },
    ];
  },
}));

import {
  computeDiffHunks,
  transformRewriteResult,
} from "./rewrite-content";

describe("computeDiffHunks", () => {
  it("returns single unchanged hunk for identical content", () => {
    const hunks = computeDiffHunks("hello", "hello");
    expect(hunks).toHaveLength(1);
    expect(hunks[0]!.type).toBe("unchanged");
    expect(hunks[0]!.value).toBe("hello");
    expect(hunks[0]!.selected).toBe(true);
  });

  it("returns added and removed hunks for different content", () => {
    const hunks = computeDiffHunks("old content", "new content");
    expect(hunks.length).toBeGreaterThanOrEqual(2);
    const removed = hunks.find(h => h.type === "removed");
    const added = hunks.find(h => h.type === "added");
    expect(removed).toBeDefined();
    expect(added).toBeDefined();
  });

  it("assigns sequential IDs to hunks", () => {
    const hunks = computeDiffHunks("old", "new");
    hunks.forEach((hunk, index) => {
      expect(hunk.id).toBe(`hunk-${index}`);
    });
  });

  it("marks all hunks as selected by default", () => {
    const hunks = computeDiffHunks("foo", "bar");
    for (const hunk of hunks) {
      expect(hunk.selected).toBe(true);
    }
  });
});

describe("transformRewriteResult", () => {
  const mockResult = {
    rewrittenContent: "Brand aligned text",
    changes: [{ id: "hunk-0", type: "unchanged" as const, value: "test", selected: true }],
    toneAnalysis: {
      formalCasual: 60,
      technicalSimple: 40,
      seriousPlayful: 50,
      reservedEnthusiastic: 70,
      alignment: 85,
    },
    characterCount: {
      original: 20,
      rewritten: 18,
      limit: 280,
    },
  };

  it("transforms result to API response format", () => {
    const response = transformRewriteResult(
      "test-id",
      "Original text here",
      mockResult,
      "TWITTER",
      false,
    );
    expect(response.id).toBe("test-id");
    expect(response.original).toBe("Original text here");
    expect(response.rewritten).toBe("Brand aligned text");
    expect(response.platform).toBe("TWITTER");
    expect(response.cached).toBe(false);
    expect(response.cachedAt).toBeUndefined();
  });

  it("includes cached date when provided", () => {
    const date = new Date("2026-01-15T12:00:00Z");
    const response = transformRewriteResult(
      "test-id",
      "Original",
      mockResult,
      "INSTAGRAM",
      true,
      date,
    );
    expect(response.cached).toBe(true);
    expect(response.cachedAt).toBe("2026-01-15T12:00:00.000Z");
  });

  it("preserves changes array", () => {
    const response = transformRewriteResult(
      "id",
      "original",
      mockResult,
      "TWITTER",
      false,
    );
    expect(response.changes).toEqual(mockResult.changes);
  });

  it("preserves character count", () => {
    const response = transformRewriteResult(
      "id",
      "original",
      mockResult,
      "TWITTER",
      false,
    );
    expect(response.characterCount).toEqual(mockResult.characterCount);
  });

  it("preserves tone analysis", () => {
    const response = transformRewriteResult(
      "id",
      "original",
      mockResult,
      "TWITTER",
      false,
    );
    expect(response.toneAnalysis).toEqual(mockResult.toneAnalysis);
  });
});
