import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  avlProfileTree: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  avlProfileNode: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  avlTraversalSession: {
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  avlUserProfile: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const mockAI = vi.hoisted(() => ({
  getClaudeClient: vi.fn(),
  isClaudeConfigured: vi.fn(),
}));
vi.mock("@/lib/ai/claude-client", () => mockAI);

import {
  generateDifferentiatingQuestion,
  getFallbackQuestion,
} from "./question-generator";

describe("question-generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFallbackQuestion", () => {
    it("returns first unused question", () => {
      const result = getFallbackQuestion([]);
      expect(result.question).toBe("Do you analyze data regularly?");
      expect(result.tags).toEqual(["analytics", "technical"]);
    });

    it("returns generic question when all used", () => {
      const allUsed = [
        "Do you analyze data regularly?",
        "Do you create content for an audience?",
        "Do you use design tools like Figma or Photoshop?",
        "Are you involved in project management?",
        "Do you build or maintain websites?",
        "Do you work with APIs or integrations?",
        "Are you interested in gaming?",
        "Do you work in education or training?",
      ];

      const result = getFallbackQuestion(allUsed);
      expect(result.question).toBe(
        `Do you use spike.land feature set #${allUsed.length + 1}?`,
      );
      expect(result.tags).toEqual(["general"]);
    });

    it("skips already used questions", () => {
      const used = ["Do you analyze data regularly?"];
      const result = getFallbackQuestion(used);
      expect(result.question).toBe(
        "Do you create content for an audience?",
      );
    });
  });

  describe("generateDifferentiatingQuestion", () => {
    it("uses AI when configured", async () => {
      mockAI.isClaudeConfigured.mockResolvedValue(true);
      mockAI.getClaudeClient.mockResolvedValue({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [
              {
                type: "text",
                text:
                  "{\"question\": \"Do you use Docker?\", \"tags\": [\"devops\", \"developer\"]}",
              },
            ],
          }),
        },
      });

      const result = await generateDifferentiatingQuestion([], []);
      expect(result.question).toBe("Do you use Docker?");
      expect(result.tags).toEqual(["devops", "developer"]);
    });

    it("falls back when AI not configured", async () => {
      mockAI.isClaudeConfigured.mockResolvedValue(false);

      const result = await generateDifferentiatingQuestion([], []);
      expect(result.question).toBe("Do you analyze data regularly?");
    });

    it("falls back on AI error", async () => {
      mockAI.isClaudeConfigured.mockResolvedValue(true);
      mockAI.getClaudeClient.mockRejectedValue(new Error("API error"));

      const result = await generateDifferentiatingQuestion([], []);
      expect(result.question).toBe("Do you analyze data regularly?");
      expect(result.tags).toEqual(["analytics", "technical"]);
    });

    it("falls back when AI returns invalid JSON", async () => {
      mockAI.isClaudeConfigured.mockResolvedValue(true);
      mockAI.getClaudeClient.mockResolvedValue({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [
              {
                type: "text",
                text: "This is not valid JSON",
              },
            ],
          }),
        },
      });

      const result = await generateDifferentiatingQuestion([], []);
      expect(result.question).toBe("Do you analyze data regularly?");
    });

    it("falls back when AI returns JSON missing required fields", async () => {
      mockAI.isClaudeConfigured.mockResolvedValue(true);
      mockAI.getClaudeClient.mockResolvedValue({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [
              {
                type: "text",
                text: "{\"answer\": \"yes\"}",
              },
            ],
          }),
        },
      });

      const result = await generateDifferentiatingQuestion([], []);
      expect(result.question).toBe("Do you analyze data regularly?");
    });

    it("falls back when AI returns no text block", async () => {
      mockAI.isClaudeConfigured.mockResolvedValue(true);
      mockAI.getClaudeClient.mockResolvedValue({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: "tool_use", id: "test" }],
          }),
        },
      });

      const result = await generateDifferentiatingQuestion([], []);
      expect(result.question).toBe("Do you analyze data regularly?");
    });
  });
});
