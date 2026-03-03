import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { registerReactionsTools } from "./reactions";

const mockPrisma = vi.hoisted(() => ({
  toolReaction: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
  reactionLog: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

type ToolResult = CallToolResult;

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
      ({
        name,
        handler,
        inputSchema,
      }: {
        name: string;
        handler: (...args: unknown[]) => Promise<ToolResult>;
        inputSchema: Record<string, unknown>;
      }) => {
        tools.set(name, { handler, inputSchema });
      },
    ),
  };
}

describe("Reactions MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerReactionsTools(
      registry as unknown as Parameters<typeof registerReactionsTools>[0],
      "user123",
    );
  });

  it("registers 4 reaction tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.tools.has("create_reaction")).toBe(true);
    expect(registry.tools.has("list_reactions")).toBe(true);
    expect(registry.tools.has("delete_reaction")).toBe(true);
    expect(registry.tools.has("reaction_log")).toBe(true);
  });

  describe("create_reaction", () => {
    it("creates a reaction rule and returns confirmation", async () => {
      mockPrisma.toolReaction.create.mockResolvedValue({
        id: "rxn1",
        userId: "user123",
        sourceTool: "arena_submit",
        sourceEvent: "success",
        targetTool: "arena_list_challenges",
        targetInput: {},
        enabled: true,
        description: "Auto-refresh after submit",
      } as never);

      const handler = registry.tools.get("create_reaction")!.handler;
      const result = await handler({
        sourceTool: "arena_submit",
        sourceEvent: "success",
        targetTool: "arena_list_challenges",
        targetInput: {},
        description: "Auto-refresh after submit",
      });

      expect((result.content[0] as { text: string; }).text).toContain("rxn1");
      expect((result.content[0] as { text: string; }).text).toContain(
        "arena_submit:success",
      );
      expect((result.content[0] as { text: string; }).text).toContain(
        "arena_list_challenges",
      );
      expect(mockPrisma.toolReaction.create).toHaveBeenCalledWith({
        data: {
          userId: "user123",
          sourceTool: "arena_submit",
          sourceEvent: "success",
          targetTool: "arena_list_challenges",
          targetInput: {},
          description: "Auto-refresh after submit",
          enabled: true,
        },
      });
    });

    it("creates a reaction without description", async () => {
      mockPrisma.toolReaction.create.mockResolvedValue({
        id: "rxn2",
        userId: "user123",
        sourceTool: "chat_send",
        sourceEvent: "error",
        targetTool: "chat_send",
        targetInput: { retry: true },
        enabled: true,
        description: null,
      } as never);

      const handler = registry.tools.get("create_reaction")!.handler;
      const result = await handler({
        sourceTool: "chat_send",
        sourceEvent: "error",
        targetTool: "chat_send",
        targetInput: { retry: true },
      });

      expect((result.content[0] as { text: string; }).text).toContain("rxn2");
      expect((result.content[0] as { text: string; }).text).not.toContain(
        "Description",
      );
    });
  });

  describe("list_reactions", () => {
    it("returns reactions list", async () => {
      mockPrisma.toolReaction.findMany.mockResolvedValue([
        {
          id: "rxn1",
          sourceTool: "arena_submit",
          sourceEvent: "success",
          targetTool: "arena_list_challenges",
          enabled: true,
          description: "Auto-refresh",
        },
        {
          id: "rxn2",
          sourceTool: "chat_send",
          sourceEvent: "error",
          targetTool: "chat_send",
          enabled: false,
          description: null,
        },
      ] as never);

      const handler = registry.tools.get("list_reactions")!.handler;
      const result = await handler({ limit: 20 });

      expect((result.content[0] as { text: string; }).text).toContain(
        "Reactions (2)",
      );
      expect((result.content[0] as { text: string; }).text).toContain("rxn1");
      expect((result.content[0] as { text: string; }).text).toContain("ON");
      expect((result.content[0] as { text: string; }).text).toContain("OFF");
      expect((result.content[0] as { text: string; }).text).toContain(
        "Auto-refresh",
      );
    });

    it("returns empty message when no reactions", async () => {
      mockPrisma.toolReaction.findMany.mockResolvedValue([] as never);

      const handler = registry.tools.get("list_reactions")!.handler;
      const result = await handler({ limit: 20 });

      expect((result.content[0] as { text: string; }).text).toBe(
        "No reactions found.",
      );
    });

    it("filters by sourceTool", async () => {
      mockPrisma.toolReaction.findMany.mockResolvedValue([] as never);

      const handler = registry.tools.get("list_reactions")!.handler;
      await handler({ sourceTool: "arena_submit", limit: 20 });

      expect(mockPrisma.toolReaction.findMany).toHaveBeenCalledWith({
        where: { userId: "user123", sourceTool: "arena_submit" },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    });

    it("filters by enabled status", async () => {
      mockPrisma.toolReaction.findMany.mockResolvedValue([] as never);

      const handler = registry.tools.get("list_reactions")!.handler;
      await handler({ enabled: true, limit: 10 });

      expect(mockPrisma.toolReaction.findMany).toHaveBeenCalledWith({
        where: { userId: "user123", enabled: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    });
  });

  describe("delete_reaction", () => {
    it("deletes an owned reaction", async () => {
      mockPrisma.toolReaction.findFirst.mockResolvedValue({
        id: "rxn1",
        userId: "user123",
      } as never);
      mockPrisma.toolReaction.delete.mockResolvedValue({} as never);

      const handler = registry.tools.get("delete_reaction")!.handler;
      const result = await handler({ reactionId: "rxn1" });

      expect((result.content[0] as { text: string; }).text).toContain("deleted");
      expect(mockPrisma.toolReaction.delete).toHaveBeenCalledWith({
        where: { id: "rxn1" },
      });
    });

    it("returns error for non-existent reaction", async () => {
      mockPrisma.toolReaction.findFirst.mockResolvedValue(null as never);

      const handler = registry.tools.get("delete_reaction")!.handler;
      const result = await handler({ reactionId: "rxn999" });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string; }).text).toContain(
        "not found",
      );
      expect(mockPrisma.toolReaction.delete).not.toHaveBeenCalled();
    });
  });

  describe("reaction_log", () => {
    it("returns reaction execution logs", async () => {
      mockPrisma.reactionLog.findMany.mockResolvedValue([
        {
          id: "log1",
          sourceTool: "arena_submit",
          sourceEvent: "success",
          targetTool: "arena_list_challenges",
          isError: false,
          durationMs: 42,
          error: null,
          createdAt: new Date("2026-01-15T10:00:00Z"),
        },
        {
          id: "log2",
          sourceTool: "chat_send",
          sourceEvent: "error",
          targetTool: "chat_send",
          isError: true,
          durationMs: 5,
          error: "timeout",
          createdAt: new Date("2026-01-15T11:00:00Z"),
        },
      ] as never);

      const handler = registry.tools.get("reaction_log")!.handler;
      const result = await handler({ limit: 20 });

      expect((result.content[0] as { text: string; }).text).toContain(
        "Reaction Log (2)",
      );
      expect((result.content[0] as { text: string; }).text).toContain("OK");
      expect((result.content[0] as { text: string; }).text).toContain("FAIL");
      expect((result.content[0] as { text: string; }).text).toContain("42ms");
      expect((result.content[0] as { text: string; }).text).toContain("timeout");
    });

    it("should handle null durationMs in logs", async () => {
      mockPrisma.reactionLog.findMany.mockResolvedValue([
        {
          id: "log-null-dur",
          sourceTool: "arena_submit",
          sourceEvent: "success",
          targetTool: "arena_list_challenges",
          isError: false,
          durationMs: null,
          error: null,
          createdAt: new Date("2026-01-15T10:00:00Z"),
        },
      ] as never);

      const handler = registry.tools.get("reaction_log")!.handler;
      const result = await handler({ limit: 20 });

      const text = (result.content[0] as { text: string; }).text;
      expect(text).toContain("Reaction Log (1)");
      expect(text).toContain("OK");
      // Should NOT contain "ms" since durationMs is null
      expect(text).not.toContain("ms)");
      expect(text).toContain("(OK)");
    });

    it("returns empty message when no logs", async () => {
      mockPrisma.reactionLog.findMany.mockResolvedValue([] as never);

      const handler = registry.tools.get("reaction_log")!.handler;
      const result = await handler({ limit: 20 });

      expect((result.content[0] as { text: string; }).text).toBe(
        "No reaction logs found.",
      );
    });

    it("filters by reactionId", async () => {
      mockPrisma.reactionLog.findMany.mockResolvedValue([] as never);

      const handler = registry.tools.get("reaction_log")!.handler;
      await handler({ reactionId: "rxn1", limit: 20 });

      expect(mockPrisma.reactionLog.findMany).toHaveBeenCalledWith({
        where: { userId: "user123", reactionId: "rxn1" },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    });

    it("filters by sourceTool and isError", async () => {
      mockPrisma.reactionLog.findMany.mockResolvedValue([] as never);

      const handler = registry.tools.get("reaction_log")!.handler;
      await handler({ sourceTool: "arena_submit", isError: true, limit: 5 });

      expect(mockPrisma.reactionLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user123",
          sourceTool: "arena_submit",
          isError: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
    });
  });
});
