import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  cleaningSession: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  cleaningTask: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

vi.mock("@/lib/ai/gemini-client", () => ({
  analyzeImageWithGemini: vi.fn(),
}));

vi.mock("@/lib/clean/vision-prompts", () => ({
  buildVerificationPrompt: vi.fn().mockReturnValue("Verify this task"),
  COMPARISON_PROMPT: "Compare before and after",
}));

import { registerCleanVerifyTools } from "./clean-verify";

interface ToolResult {
  content: Array<{ text: string; }>;
  isError?: boolean;
}

function createMockRegistry() {
  const tools = new Map<
    string,
    {
      handler: (...args: unknown[]) => Promise<ToolResult>;
      inputSchema: Record<string, unknown>;
    }
  >();
  return {
    tools,
    register: vi.fn(
      (
        { name, handler, inputSchema }: {
          name: string;
          handler: (...args: unknown[]) => Promise<ToolResult>;
          inputSchema: Record<string, unknown>;
        },
      ) => {
        tools.set(name, { handler, inputSchema });
      },
    ),
  };
}

describe("Clean Verify MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCleanVerifyTools(
      registry as unknown as Parameters<typeof registerCleanVerifyTools>[0],
      "user123",
    );
  });

  it("registers 2 verify tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(2);
    expect(registry.tools.has("clean_verify_check_completion")).toBe(true);
    expect(registry.tools.has("clean_verify_compare_before_after")).toBe(true);
  });

  describe("clean_verify_check_completion", () => {
    it("verifies task completion and updates to VERIFIED", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce({
        id: "t1",
        description: "Clean the kitchen counter",
        status: "COMPLETED",
        completedAt: new Date(),
        pointsValue: 20,
        session: { userId: "user123", id: "sess-1" },
      } as never);

      const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
      (analyzeImageWithGemini as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          JSON.stringify({
            completed: true,
            confidence: 0.85,
            feedback: "The counter looks spotless!",
          }),
        );

      mockPrisma.cleaningTask.update.mockResolvedValueOnce(undefined as never);

      const handler = registry.tools.get("clean_verify_check_completion")!.handler;
      const result = await handler({
        task_id: "t1",
        photo_base64: "photobytes",
      });

      expect(result.content[0]!.text).toContain("Verification Result");
      expect(result.content[0]!.text).toContain("Completed:** Yes");
      expect(result.content[0]!.text).toContain("85%");
      expect(result.content[0]!.text).toContain("VERIFIED");
      expect(mockPrisma.cleaningTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "t1" },
          data: expect.objectContaining({ status: "VERIFIED" }),
        }),
      );
    });

    it("does not verify when confidence is low", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce({
        id: "t1",
        description: "Clean the floor",
        status: "COMPLETED",
        completedAt: new Date(),
        pointsValue: 10,
        session: { userId: "user123", id: "sess-1" },
      } as never);

      const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
      (analyzeImageWithGemini as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          JSON.stringify({
            completed: false,
            confidence: 0.3,
            feedback: "The floor still looks dirty.",
          }),
        );

      const handler = registry.tools.get("clean_verify_check_completion")!.handler;
      const result = await handler({
        task_id: "t1",
        photo_base64: "photobytes",
      });

      expect(result.content[0]!.text).toContain("30%");
      expect(result.content[0]!.text).toContain("Not verified");
      expect(mockPrisma.cleaningTask.update).not.toHaveBeenCalled();
    });

    it("returns error when AI fails to verify", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce({
        id: "t1",
        description: "Organize shelf",
        status: "PENDING",
        completedAt: null,
        pointsValue: 20,
        session: { userId: "user123", id: "sess-1" },
      } as never);

      const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
      (analyzeImageWithGemini as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(
          new Error("Gemini unavailable"),
        );

      const handler = registry.tools.get("clean_verify_check_completion")!.handler;
      const result = await handler({
        task_id: "t1",
        photo_base64: "photobytes",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain(
        "Failed to verify image with Gemini Vision",
      );
      // Ensure we didn't accidentally update the database on failure
      expect(mockPrisma.cleaningTask.update).not.toHaveBeenCalled();
      expect(mockPrisma.cleaningSession.update).not.toHaveBeenCalled();
    });

    it("returns error and prevents incrementing completedTasks on AI failure", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce({
        id: "t1",
        description: "Pick up items",
        status: "PENDING",
        completedAt: null,
        pointsValue: 5,
        session: { userId: "user123", id: "sess-1" },
      } as never);

      const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
      (analyzeImageWithGemini as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(
          new Error("Gemini API failure"),
        );

      const handler = registry.tools.get("clean_verify_check_completion")!.handler;
      const result = await handler({
        task_id: "t1",
        photo_base64: "photobytes",
      });

      expect(result.isError).toBe(true);
      expect(mockPrisma.cleaningSession.update).not.toHaveBeenCalled();
    });

    it("does not increment completedTasks when task was already COMPLETED", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce({
        id: "t1",
        description: "Already done task",
        status: "COMPLETED",
        completedAt: new Date(),
        pointsValue: 10,
        session: { userId: "user123", id: "sess-1" },
      } as never);

      const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
      (analyzeImageWithGemini as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          JSON.stringify({
            completed: true,
            confidence: 0.8,
            feedback: "Good job",
          }),
        );

      mockPrisma.cleaningTask.update.mockResolvedValueOnce(undefined as never);

      const handler = registry.tools.get("clean_verify_check_completion")!.handler;
      await handler({ task_id: "t1", photo_base64: "photobytes" });

      // Task was already COMPLETED, so completedTasks should NOT be incremented
      expect(mockPrisma.cleaningSession.update).not.toHaveBeenCalled();
    });

    it("does not increment completedTasks when task was already VERIFIED", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce({
        id: "t1",
        description: "Already verified task",
        status: "VERIFIED",
        completedAt: new Date(),
        pointsValue: 10,
        session: { userId: "user123", id: "sess-1" },
      } as never);

      const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
      (analyzeImageWithGemini as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          JSON.stringify({
            completed: true,
            confidence: 0.8,
            feedback: "Good job",
          }),
        );

      mockPrisma.cleaningTask.update.mockResolvedValueOnce(undefined as never);

      const handler = registry.tools.get("clean_verify_check_completion")!.handler;
      await handler({ task_id: "t1", photo_base64: "photobytes" });

      // Task was already VERIFIED, so completedTasks should NOT be incremented
      expect(mockPrisma.cleaningSession.update).not.toHaveBeenCalled();
    });

    it("handles AI returning non-string verification result (object)", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce({
        id: "t1",
        description: "Wipe counter",
        status: "COMPLETED",
        completedAt: new Date(),
        pointsValue: 15,
        session: { userId: "user123", id: "sess-1" },
      } as never);

      const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
      (analyzeImageWithGemini as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          completed: true,
          confidence: 0.9,
          feedback: "Looks great!",
        });

      mockPrisma.cleaningTask.update.mockResolvedValueOnce(undefined as never);

      const handler = registry.tools.get("clean_verify_check_completion")!.handler;
      const result = await handler({
        task_id: "t1",
        photo_base64: "photobytes",
      });

      expect(result.content[0]!.text).toContain("VERIFIED");
      expect(result.content[0]!.text).toContain("90%");
      expect(result.content[0]!.text).toContain("Looks great!");
    });

    it("returns error for unowned task", async () => {
      mockPrisma.cleaningTask.findUnique.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_verify_check_completion")!.handler;
      const result = await handler({ task_id: "bad", photo_base64: "data" });

      expect(result.content[0]!.text).toContain("Task not found");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningTask.findUnique.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_verify_check_completion")!.handler;
      const result = await handler({ task_id: "t1", photo_base64: "data" });

      expect(result.isError).toBe(true);
    });
  });

  describe("clean_verify_compare_before_after", () => {
    it("returns comparison results", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
      } as never);

      const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
      (analyzeImageWithGemini as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          JSON.stringify({
            improvement_score: 80,
            changes_detected: ["Floor is clean", "Desk is organized"],
            remaining_items: ["Closet still messy"],
            encouragement: "Amazing progress!",
          }),
        );

      const handler = registry.tools.get("clean_verify_compare_before_after")!.handler;
      const result = await handler({
        before_photo_base64: "before",
        after_photo_base64: "after",
        session_id: "sess-1",
      });

      expect(result.content[0]!.text).toContain("Before/After Comparison");
      expect(result.content[0]!.text).toContain("80/100");
      expect(result.content[0]!.text).toContain("Floor is clean");
      expect(result.content[0]!.text).toContain("Desk is organized");
      expect(result.content[0]!.text).toContain("Closet still messy");
      expect(result.content[0]!.text).toContain("Amazing progress!");
    });

    it("returns error when AI fails to compare", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
      } as never);

      const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
      (analyzeImageWithGemini as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(
          new Error("Gemini down"),
        );

      const handler = registry.tools.get("clean_verify_compare_before_after")!.handler;
      const result = await handler({
        before_photo_base64: "before",
        after_photo_base64: "after",
        session_id: "sess-1",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain(
        "Failed to compare images with Gemini Vision",
      );
    });

    it("returns error for unowned session", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_verify_compare_before_after")!.handler;
      const result = await handler({
        before_photo_base64: "before",
        after_photo_base64: "after",
        session_id: "bad",
      });

      expect(result.content[0]!.text).toContain("Session not found");
    });

    it("handles comparison with empty changes_detected and remaining_items", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
      } as never);

      const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
      (analyzeImageWithGemini as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          JSON.stringify({
            improvement_score: 10,
            changes_detected: [],
            remaining_items: [],
            encouragement: "Room looks similar.",
          }),
        );

      const handler = registry.tools.get("clean_verify_compare_before_after")!.handler;
      const result = await handler({
        before_photo_base64: "before",
        after_photo_base64: "after",
        session_id: "sess-1",
      });

      const text = result.content[0]!.text;
      expect(text).toContain("10/100");
      // Should NOT contain "Changes Detected" or "Still Needs Attention" sections
      expect(text).not.toContain("Changes Detected");
      expect(text).not.toContain("Still Needs Attention");
      expect(text).toContain("Room looks similar.");
    });

    it("handles AI returning non-string comparison result (object)", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user123",
      } as never);

      const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
      (analyzeImageWithGemini as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          improvement_score: 90,
          changes_detected: ["Everything sparkles"],
          remaining_items: [],
          encouragement: "Perfect!",
        });

      const handler = registry.tools.get("clean_verify_compare_before_after")!.handler;
      const result = await handler({
        before_photo_base64: "before",
        after_photo_base64: "after",
        session_id: "sess-1",
      });

      const text = result.content[0]!.text;
      expect(text).toContain("90/100");
      expect(text).toContain("Everything sparkles");
      expect(text).toContain("Perfect!");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningSession.findFirst.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_verify_compare_before_after")!.handler;
      const result = await handler({
        before_photo_base64: "before",
        after_photo_base64: "after",
        session_id: "sess-1",
      });

      expect(result.isError).toBe(true);
    });
  });
});
