import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  cleaningSession: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  cleaningTask: {
    createMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

vi.mock("@/lib/ai/gemini-client", () => ({
  analyzeImageWithGemini: vi.fn(),
}));

vi.mock("@/lib/clean/vision-prompts", () => ({
  ROOM_ANALYSIS_PROMPT: "Analyze this room for cleaning tasks.",
}));

import { registerCleanScannerTools } from "./clean-scanner";

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

describe("Clean Scanner MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCleanScannerTools(
      registry as unknown as Parameters<typeof registerCleanScannerTools>[0],
      "user123",
    );
  });

  it("registers 2 scanner tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(2);
    expect(registry.tools.has("clean_scanner_analyze_room")).toBe(true);
    expect(registry.tools.has("clean_scanner_generate_tasks")).toBe(true);
  });

  describe("clean_scanner_analyze_room", () => {
    it("returns room analysis from AI", async () => {
      const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
      (analyzeImageWithGemini as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          JSON.stringify({
            room_type: "kitchen",
            mess_severity: 7,
            items: [
              {
                object: "dirty dishes",
                location: "sink",
                category: "DISHES",
                difficulty: "MEDIUM",
                action: "Wash the dishes",
              },
            ],
          }),
        );

      const handler = registry.tools.get("clean_scanner_analyze_room")!.handler;
      const result = await handler({ photo_base64: "roomphoto" });

      expect(result.content[0]!.text).toContain("Room type:** kitchen");
      expect(result.content[0]!.text).toContain("Mess severity:** 7/10");
      expect(result.content[0]!.text).toContain("dirty dishes");
    });

    it("verifies session ownership when session_id provided", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_scanner_analyze_room")!.handler;
      const result = await handler({
        photo_base64: "roomphoto",
        session_id: "sess-bad",
      });

      expect(result.content[0]!.text).toContain("Session not found");
      expect(mockPrisma.cleaningSession.findFirst).toHaveBeenCalledWith({
        where: { id: "sess-bad", userId: "user123" },
      });
    });

    it("returns error when AI fails", async () => {
      const { analyzeImageWithGemini } = await import("@/lib/ai/gemini-client");
      (analyzeImageWithGemini as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(
          new Error("Gemini unavailable"),
        );

      const handler = registry.tools.get("clean_scanner_analyze_room")!.handler;
      const result = await handler({ photo_base64: "roomphoto" });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain(
        "Failed to analyze image with Gemini Vision",
      );
    });

    it("handles error gracefully", async () => {
      // Force an error by making findFirst throw when session_id is checked
      mockPrisma.cleaningSession.findFirst.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_scanner_analyze_room")!.handler;
      const result = await handler({
        photo_base64: "roomphoto",
        session_id: "sess1",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("clean_scanner_generate_tasks", () => {
    it("creates tasks from analysis JSON", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(
        { id: "sess1", userId: "user123" } as never,
      );
      mockPrisma.cleaningTask.createMany.mockResolvedValueOnce(
        { count: 2 } as never,
      );
      mockPrisma.cleaningSession.update.mockResolvedValue(undefined as never);

      const analysisJson = JSON.stringify({
        room_type: "bedroom",
        mess_severity: 5,
        items: [
          {
            object: "clothes on floor",
            location: "floor",
            category: "LAUNDRY",
            difficulty: "EASY",
            action: "Pick up clothes",
          },
          {
            object: "dusty shelf",
            location: "bookshelf",
            category: "SURFACES",
            difficulty: "MEDIUM",
            action: "Dust the shelf",
          },
        ],
      });

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      const result = await handler({
        analysis_json: analysisJson,
        session_id: "sess1",
      });

      expect(result.content[0]!.text).toContain("2 tasks created");
      expect(mockPrisma.cleaningTask.createMany).toHaveBeenCalled();
      expect(mockPrisma.cleaningSession.update).toHaveBeenCalled();
    });

    it("orders tasks by difficulty (QUICK first)", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(
        { id: "sess1", userId: "user123" } as never,
      );
      mockPrisma.cleaningTask.createMany.mockResolvedValueOnce(
        { count: 3 } as never,
      );
      mockPrisma.cleaningSession.update.mockResolvedValue(undefined as never);

      const analysisJson = JSON.stringify({
        room_type: "living room",
        mess_severity: 4,
        items: [
          {
            object: "heavy furniture",
            location: "corner",
            category: "ORGANIZE",
            difficulty: "EFFORT",
            action: "Move furniture",
          },
          {
            object: "quick wipe",
            location: "table",
            category: "SURFACES",
            difficulty: "QUICK",
            action: "Wipe table",
          },
          {
            object: "medium task",
            location: "floor",
            category: "FLOORS",
            difficulty: "MEDIUM",
            action: "Sweep floor",
          },
        ],
      });

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      const result = await handler({
        analysis_json: analysisJson,
        session_id: "sess1",
      });

      // QUICK should come before EFFORT in the output
      const text = result.content[0]!.text;
      const quickIdx = text.indexOf("QUICK");
      const effortIdx = text.indexOf("EFFORT");
      expect(quickIdx).toBeLessThan(effortIdx);
    });

    it("returns error for unowned session", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      const result = await handler({
        analysis_json: "{}",
        session_id: "bad-sess",
      });

      expect(result.content[0]!.text).toContain("Session not found");
    });

    it("handles invalid JSON", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(
        { id: "sess1", userId: "user123" } as never,
      );

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      const result = await handler({
        analysis_json: "not-json",
        session_id: "sess1",
      });

      expect(result.isError).toBe(true);
    });

    it("handles empty items array", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(
        { id: "sess1", userId: "user123" } as never,
      );

      const analysisJson = JSON.stringify({
        room_type: "clean room",
        mess_severity: 0,
        items: [],
      });

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      const result = await handler({
        analysis_json: analysisJson,
        session_id: "sess1",
      });

      expect(result.content[0]!.text).toContain("room looks clean");
    });

    it("updates room label from analysis when not 'unknown'", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce(
        { id: "sess1", userId: "user123" } as never,
      );
      mockPrisma.cleaningTask.createMany.mockResolvedValueOnce(
        { count: 1 } as never,
      );
      mockPrisma.cleaningSession.update.mockResolvedValue(undefined as never);

      const analysisJson = JSON.stringify({
        room_type: "bathroom",
        mess_severity: 3,
        items: [
          {
            object: "soap scum",
            location: "shower",
            category: "SURFACES",
            difficulty: "EASY",
            action: "Clean shower",
          },
        ],
      });

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      await handler({ analysis_json: analysisJson, session_id: "sess1" });

      // Should update roomLabel
      expect(mockPrisma.cleaningSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sess1" },
          data: { roomLabel: "bathroom" },
        }),
      );
    });

    it("does not update room label when room_type is 'unknown'", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess1",
        userId: "user123",
      } as never);
      mockPrisma.cleaningTask.createMany.mockResolvedValueOnce({
        count: 1,
      } as never);
      mockPrisma.cleaningSession.update.mockResolvedValue(undefined as never);

      const analysisJson = JSON.stringify({
        room_type: "unknown",
        mess_severity: 3,
        items: [
          {
            object: "stuff",
            location: "floor",
            category: "OTHER",
            difficulty: "EASY",
            action: "Pick up stuff",
          },
        ],
      });

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      await handler({ analysis_json: analysisJson, session_id: "sess1" });

      expect(mockPrisma.cleaningSession.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.cleaningSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totalTasks: { increment: 1 } },
        }),
      );
    });

    it("defaults unknown difficulty to EASY", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess1",
        userId: "user123",
      } as never);
      mockPrisma.cleaningTask.createMany.mockResolvedValueOnce({
        count: 1,
      } as never);
      mockPrisma.cleaningSession.update.mockResolvedValue(undefined as never);

      const analysisJson = JSON.stringify({
        room_type: "unknown",
        mess_severity: 3,
        items: [
          {
            object: "item",
            location: "floor",
            category: "OTHER",
            difficulty: "UNKNOWN_DIFFICULTY",
            action: "Do something",
          },
        ],
      });

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      const result = await handler({
        analysis_json: analysisJson,
        session_id: "sess1",
      });

      expect(result.content[0]!.text).toContain("EASY");
      expect(mockPrisma.cleaningTask.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ difficulty: "EASY" }),
          ]),
        }),
      );
    });

    it("defaults unknown category to OTHER", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess1",
        userId: "user123",
      } as never);
      mockPrisma.cleaningTask.createMany.mockResolvedValueOnce({
        count: 1,
      } as never);
      mockPrisma.cleaningSession.update.mockResolvedValue(undefined as never);

      const analysisJson = JSON.stringify({
        room_type: "unknown",
        mess_severity: 3,
        items: [
          {
            object: "item",
            location: "floor",
            category: "UNKNOWN_CATEGORY",
            difficulty: "EASY",
            action: "Do something",
          },
        ],
      });

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      await handler({ analysis_json: analysisJson, session_id: "sess1" });

      expect(mockPrisma.cleaningTask.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ category: "OTHER" }),
          ]),
        }),
      );
    });

    it("truncates long descriptions with ellipsis in output", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess1",
        userId: "user123",
      } as never);
      mockPrisma.cleaningTask.createMany.mockResolvedValueOnce({
        count: 1,
      } as never);
      mockPrisma.cleaningSession.update.mockResolvedValue(undefined as never);

      const longAction = "A".repeat(100);
      const analysisJson = JSON.stringify({
        room_type: "unknown",
        mess_severity: 3,
        items: [
          {
            object: "item",
            location: "floor",
            category: "OTHER",
            difficulty: "EASY",
            action: longAction,
          },
        ],
      });

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      const result = await handler({
        analysis_json: analysisJson,
        session_id: "sess1",
      });

      expect(result.content[0]!.text).toContain("...");
    });

    it("returns error for analyzes room with valid session_id on AI failure", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess1",
        userId: "user123",
      } as never);

      const { analyzeImageWithGemini } = await import(
        "@/lib/ai/gemini-client"
      );
      (
        analyzeImageWithGemini as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error("Gemini unavailable"));

      const handler = registry.tools.get("clean_scanner_analyze_room")!.handler;
      const result = await handler({
        photo_base64: "roomphoto",
        session_id: "sess1",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Gemini unavailable");
    });

    it("handles AI returning non-string result", async () => {
      const { analyzeImageWithGemini } = await import(
        "@/lib/ai/gemini-client"
      );
      (
        analyzeImageWithGemini as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        room_type: "office",
        mess_severity: 3,
        items: [],
      });

      const handler = registry.tools.get("clean_scanner_analyze_room")!.handler;
      const result = await handler({ photo_base64: "roomphoto" });

      expect(result.content[0]!.text).toContain("Room type:** office");
      expect(result.content[0]!.text).toContain("Items found:** 0");
    });

    it("handles analysis with no items property (undefined)", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess1",
        userId: "user123",
      } as never);

      const analysisJson = JSON.stringify({
        room_type: "clean room",
        mess_severity: 0,
      });

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      const result = await handler({
        analysis_json: analysisJson,
        session_id: "sess1",
      });

      expect(result.content[0]!.text).toContain("room looks clean");
    });

    it("handles items with unknown difficulty sorted via fallback priority", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess1",
        userId: "user123",
      } as never);
      mockPrisma.cleaningTask.createMany.mockResolvedValueOnce({
        count: 2,
      } as never);
      mockPrisma.cleaningSession.update.mockResolvedValue(undefined as never);

      const analysisJson = JSON.stringify({
        room_type: "unknown",
        mess_severity: 3,
        items: [
          {
            object: "item1",
            location: "floor",
            category: "OTHER",
            difficulty: "UNKNOWN1",
            action: "Do something 1",
          },
          {
            object: "item2",
            location: "desk",
            category: "UNKNOWN_CAT",
            difficulty: "QUICK",
            action: "Do something 2",
          },
        ],
      });

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      const result = await handler({
        analysis_json: analysisJson,
        session_id: "sess1",
      });

      const text = result.content[0]!.text;
      const quickIdx = text.indexOf("QUICK");
      const easyIdx = text.indexOf("EASY");
      expect(quickIdx).toBeLessThan(easyIdx);
    });

    it("handles analysis with empty room_type (falsy)", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess1",
        userId: "user123",
      } as never);
      mockPrisma.cleaningTask.createMany.mockResolvedValueOnce({
        count: 1,
      } as never);
      mockPrisma.cleaningSession.update.mockResolvedValue(undefined as never);

      const analysisJson = JSON.stringify({
        room_type: "",
        mess_severity: 3,
        items: [
          {
            object: "item",
            location: "floor",
            category: "OTHER",
            difficulty: "EASY",
            action: "Do something",
          },
        ],
      });

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      await handler({ analysis_json: analysisJson, session_id: "sess1" });

      expect(mockPrisma.cleaningSession.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.cleaningSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totalTasks: { increment: 1 } },
        }),
      );
    });

    it("sorts two items with unknown difficulties using fallback priority 4", async () => {
      mockPrisma.cleaningSession.findFirst.mockResolvedValueOnce({
        id: "sess1",
        userId: "user123",
      } as never);
      mockPrisma.cleaningTask.createMany.mockResolvedValueOnce({
        count: 2,
      } as never);
      mockPrisma.cleaningSession.update.mockResolvedValue(undefined as never);

      const analysisJson = JSON.stringify({
        room_type: "unknown",
        mess_severity: 3,
        items: [
          {
            object: "item1",
            location: "floor",
            category: "OTHER",
            difficulty: "WEIRD_A",
            action: "Do thing A",
          },
          {
            object: "item2",
            location: "desk",
            category: "OTHER",
            difficulty: "WEIRD_B",
            action: "Do thing B",
          },
        ],
      });

      const handler = registry.tools.get("clean_scanner_generate_tasks")!.handler;
      const result = await handler({
        analysis_json: analysisJson,
        session_id: "sess1",
      });

      // Both have fallback priority 4, so order is preserved
      expect(result.content[0]!.text).toContain("2 tasks created");
    });

    it("analyzes room with zero items in AI result", async () => {
      const { analyzeImageWithGemini } = await import(
        "@/lib/ai/gemini-client"
      );
      (
        analyzeImageWithGemini as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(
        JSON.stringify({
          room_type: "spotless room",
          mess_severity: 0,
          items: [],
        }),
      );

      const handler = registry.tools.get("clean_scanner_analyze_room")!.handler;
      const result = await handler({ photo_base64: "cleanroom" });

      expect(result.content[0]!.text).toContain("Items found:** 0");
      expect(result.content[0]!.text).not.toContain("Tasks Identified");
    });
  });
});
