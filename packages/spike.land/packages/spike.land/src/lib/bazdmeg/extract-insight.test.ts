import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
vi.mock("@/lib/ai/claude-client", () => ({
  getClaudeClient: vi.fn().mockResolvedValue({
    messages: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  }),
}));

const mockPrismaFindFirst = vi.fn();
const mockPrismaUpdate = vi.fn();
const mockPrismaCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    bazdmegMemory: {
      findFirst: (...args: unknown[]) => mockPrismaFindFirst(...args),
      update: (...args: unknown[]) => mockPrismaUpdate(...args),
      create: (...args: unknown[]) => mockPrismaCreate(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { extractAndSaveInsight } = await import("./extract-insight");

describe("extractAndSaveInsight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts insight and saves new memory entry", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text:
            "{\"insight\": \"Testing is crucial for AI code\", \"tags\": [\"testing\", \"quality\"], \"skip\": false}",
        },
      ],
    });
    mockPrismaFindFirst.mockResolvedValue(null);
    mockPrismaCreate.mockResolvedValue({ id: "mem-1" });

    await extractAndSaveInsight({
      question: "Why test?",
      answer: "Because code quality matters.",
    });

    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        insight: "Testing is crucial for AI code",
        tags: ["testing", "quality"],
        confidence: 0.5,
      }),
    });
  });

  it("boosts confidence of existing duplicate insight", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "{\"insight\": \"Existing insight\", \"tags\": [\"tag\"], \"skip\": false}",
        },
      ],
    });
    mockPrismaFindFirst.mockResolvedValue({ id: "mem-2", confidence: 0.6 });
    mockPrismaUpdate.mockResolvedValue({});

    await extractAndSaveInsight({
      question: "Q",
      answer: "A",
    });

    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: "mem-2" },
      data: { confidence: 0.7 },
    });
    expect(mockPrismaCreate).not.toHaveBeenCalled();
  });

  it("caps confidence at 1.0", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "{\"insight\": \"Known insight\", \"tags\": [], \"skip\": false}",
        },
      ],
    });
    mockPrismaFindFirst.mockResolvedValue({ id: "mem-3", confidence: 0.95 });
    mockPrismaUpdate.mockResolvedValue({});

    await extractAndSaveInsight({ question: "Q", answer: "A" });

    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: "mem-3" },
      data: { confidence: 1.0 },
    });
  });

  it("skips when AI returns skip=true", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "{\"insight\": \"\", \"tags\": [], \"skip\": true}",
        },
      ],
    });

    await extractAndSaveInsight({ question: "Hi", answer: "Hello" });

    expect(mockPrismaFindFirst).not.toHaveBeenCalled();
    expect(mockPrismaCreate).not.toHaveBeenCalled();
  });

  it("does not throw on AI client error", async () => {
    mockCreate.mockRejectedValue(new Error("API rate limited"));

    await expect(
      extractAndSaveInsight({ question: "Q", answer: "A" }),
    ).resolves.toBeUndefined();
  });

  it("does not throw on invalid JSON response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Not valid JSON at all" }],
    });

    await expect(
      extractAndSaveInsight({ question: "Q", answer: "A" }),
    ).resolves.toBeUndefined();
  });

  it("truncates sourceQuestion to 500 chars", async () => {
    const longQuestion = "x".repeat(1000);
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "{\"insight\": \"Good insight\", \"tags\": [\"test\"], \"skip\": false}",
        },
      ],
    });
    mockPrismaFindFirst.mockResolvedValue(null);
    mockPrismaCreate.mockResolvedValue({ id: "mem-4" });

    await extractAndSaveInsight({ question: longQuestion, answer: "A" });

    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceQuestion: "x".repeat(500),
      }),
    });
  });
});
