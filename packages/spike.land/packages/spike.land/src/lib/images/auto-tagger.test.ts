import { describe, expect, it, vi } from "vitest";

const { mockFindFirst, mockEnhancedImageUpdate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockEnhancedImageUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    imageEnhancementJob: {
      findFirst: mockFindFirst,
    },
    enhancedImage: {
      update: mockEnhancedImageUpdate,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@prisma/client", () => ({
  Prisma: {
    DbNull: null,
  },
}));

import { applyAutoTags, extractTagsFromAnalysis } from "./auto-tagger";

describe("extractTagsFromAnalysis", () => {
  it("returns empty array for null input", () => {
    expect(extractTagsFromAnalysis(null)).toEqual([]);
  });

  it("returns empty array for non-object input", () => {
    expect(extractTagsFromAnalysis("not an object")).toEqual([]);
    expect(extractTagsFromAnalysis(42)).toEqual([]);
  });

  it("returns empty array for empty object", () => {
    expect(extractTagsFromAnalysis({})).toEqual([]);
  });

  it("extracts tags from objects array", () => {
    const tags = extractTagsFromAnalysis({ objects: ["Cat", "Dog"] });
    expect(tags).toContain("cat");
    expect(tags).toContain("dog");
  });

  it("extracts tags from colors array", () => {
    const tags = extractTagsFromAnalysis({ colors: ["Red", "Blue"] });
    expect(tags).toContain("red");
    expect(tags).toContain("blue");
  });

  it("extracts style tag", () => {
    const tags = extractTagsFromAnalysis({ style: "Minimalist" });
    expect(tags).toContain("minimalist");
  });

  it("extracts mood tag", () => {
    const tags = extractTagsFromAnalysis({ mood: "Serene" });
    expect(tags).toContain("serene");
  });

  it("extracts tags from visualElements array", () => {
    const tags = extractTagsFromAnalysis({ visualElements: ["Tree", "Sky"] });
    expect(tags).toContain("tree");
    expect(tags).toContain("sky");
  });

  it("lowercases and trims all extracted tags", () => {
    const tags = extractTagsFromAnalysis({
      objects: ["  Fluffy Cat  "],
      style: "  BOLD  ",
    });
    expect(tags).toContain("fluffy cat");
    expect(tags).toContain("bold");
  });

  it("deduplicates tags across different fields", () => {
    const tags = extractTagsFromAnalysis({
      objects: ["cat"],
      visualElements: ["cat"],
    });
    expect(tags.filter(t => t === "cat")).toHaveLength(1);
  });

  it("filters out empty strings", () => {
    const tags = extractTagsFromAnalysis({ objects: ["", "valid"] });
    expect(tags).not.toContain("");
    expect(tags).toContain("valid");
  });

  it("limits output to 15 tags", () => {
    const manyObjects = Array.from({ length: 20 }, (_, i) => `object-${i}`);
    const tags = extractTagsFromAnalysis({ objects: manyObjects });
    expect(tags.length).toBeLessThanOrEqual(15);
  });

  it("ignores non-string items in arrays", () => {
    const tags = extractTagsFromAnalysis({
      objects: [42, null, "valid-string", { nested: true }],
    });
    expect(tags).toContain("valid-string");
    expect(tags).toHaveLength(1);
  });

  it("extracts combined tags from all fields", () => {
    const tags = extractTagsFromAnalysis({
      objects: ["chair"],
      colors: ["blue"],
      style: "modern",
      mood: "calm",
      visualElements: ["window"],
    });
    expect(tags).toContain("chair");
    expect(tags).toContain("blue");
    expect(tags).toContain("modern");
    expect(tags).toContain("calm");
    expect(tags).toContain("window");
  });
});

describe("applyAutoTags", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockEnhancedImageUpdate.mockReset();
  });

  it("does nothing when no job is found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await applyAutoTags("img-1");
    expect(mockEnhancedImageUpdate).not.toHaveBeenCalled();
  });

  it("does nothing when job has no analysisResult", async () => {
    mockFindFirst.mockResolvedValue({ analysisResult: null });
    await applyAutoTags("img-1");
    expect(mockEnhancedImageUpdate).not.toHaveBeenCalled();
  });

  it("updates tags when analysis result has extractable tags", async () => {
    mockFindFirst.mockResolvedValue({
      analysisResult: {
        objects: ["cat", "tree"],
        style: "nature",
      },
    });
    mockEnhancedImageUpdate.mockResolvedValue({});

    await applyAutoTags("img-2");

    expect(mockEnhancedImageUpdate).toHaveBeenCalledWith({
      where: { id: "img-2" },
      data: { tags: expect.arrayContaining(["cat", "tree", "nature"]) },
    });
  });

  it("does not update when extracted tags array is empty", async () => {
    mockFindFirst.mockResolvedValue({ analysisResult: {} });
    await applyAutoTags("img-3");
    expect(mockEnhancedImageUpdate).not.toHaveBeenCalled();
  });

  it("handles errors from findFirst without throwing", async () => {
    mockFindFirst.mockRejectedValue(new Error("DB error"));
    await expect(applyAutoTags("img-err")).resolves.toBeUndefined();
    expect(mockEnhancedImageUpdate).not.toHaveBeenCalled();
  });

  it("handles errors from enhancedImage.update without throwing", async () => {
    mockFindFirst.mockResolvedValue({ analysisResult: { objects: ["cat"] } });
    mockEnhancedImageUpdate.mockRejectedValue(new Error("Update failed"));
    await expect(applyAutoTags("img-fail")).resolves.toBeUndefined();
  });
});
