import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  bazdmegMemory: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { registerBazdmegMemoryTools } from "./bazdmeg-memory";

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

describe("BAZDMEG Memory MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBazdmegMemoryTools(
      registry as unknown as Parameters<typeof registerBazdmegMemoryTools>[0],
      "user123",
    );
  });

  it("registers 2 memory tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(2);
    expect(registry.tools.has("bazdmeg_memory_search")).toBe(true);
    expect(registry.tools.has("bazdmeg_memory_list")).toBe(true);
  });

  describe("bazdmeg_memory_search", () => {
    it("returns matching insights sorted by confidence", async () => {
      mockPrisma.bazdmegMemory.findMany.mockResolvedValueOnce([
        {
          insight: "Always use TypeScript",
          tags: ["typescript", "best-practice"],
          sourceQuestion: "What language should I use?",
          confidence: 0.95,
        },
      ]);

      const handler = registry.tools.get("bazdmeg_memory_search")!.handler;
      const result = await handler({ query: "typescript" });

      expect(result.content[0]!.text).toContain("Always use TypeScript");
      expect(result.content[0]!.text).toContain("typescript, best-practice");
      expect(result.content[0]!.text).toContain("0.95");
      expect(mockPrisma.bazdmegMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { insight: { contains: "typescript", mode: "insensitive" } },
              { tags: { hasSome: ["typescript"] } },
            ],
          },
          orderBy: { confidence: "desc" },
          take: 10,
        }),
      );
    });

    it("respects custom limit", async () => {
      mockPrisma.bazdmegMemory.findMany.mockResolvedValueOnce([]);

      const handler = registry.tools.get("bazdmeg_memory_search")!.handler;
      await handler({ query: "test", limit: 5 });

      expect(mockPrisma.bazdmegMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it("returns message when no results found", async () => {
      mockPrisma.bazdmegMemory.findMany.mockResolvedValueOnce([]);

      const handler = registry.tools.get("bazdmeg_memory_search")!.handler;
      const result = await handler({ query: "nonexistent" });

      expect(result.content[0]!.text).toContain(
        "No BAZDMEG insights found for \"nonexistent\"",
      );
    });

    it("shows singular 'result' when exactly 1 match found", async () => {
      mockPrisma.bazdmegMemory.findMany.mockResolvedValueOnce([
        {
          insight: "Single insight",
          tags: ["solo"],
          sourceQuestion: "One question",
          confidence: 0.9,
        },
      ]);

      const handler = registry.tools.get("bazdmeg_memory_search")!.handler;
      const result = await handler({ query: "single" });

      expect(result.content[0]!.text).toContain("1 result");
      expect(result.content[0]!.text).not.toContain("1 results");
    });

    it("handles database errors gracefully", async () => {
      mockPrisma.bazdmegMemory.findMany.mockRejectedValueOnce(
        new Error("DB connection lost"),
      );

      const handler = registry.tools.get("bazdmeg_memory_search")!.handler;
      const result = await handler({ query: "test" });

      expect(result.isError).toBe(true);
    });

    it("shows empty tags correctly", async () => {
      mockPrisma.bazdmegMemory.findMany.mockResolvedValueOnce([
        {
          insight: "No tags insight",
          tags: [],
          sourceQuestion: "A question",
          confidence: 0.5,
        },
      ]);

      const handler = registry.tools.get("bazdmeg_memory_search")!.handler;
      const result = await handler({ query: "no tags" });

      expect(result.content[0]!.text).toContain("No tags insight");
      expect(result.content[0]!.text).not.toContain("[");
    });
  });

  describe("bazdmeg_memory_list", () => {
    it("returns recent insights sorted by date", async () => {
      mockPrisma.bazdmegMemory.findMany.mockResolvedValueOnce([
        {
          insight: "Recent insight",
          tags: ["new"],
          createdAt: new Date("2026-01-15"),
          confidence: 0.8,
        },
        {
          insight: "Older insight",
          tags: [],
          createdAt: new Date("2026-01-10"),
          confidence: 0.6,
        },
      ]);

      const handler = registry.tools.get("bazdmeg_memory_list")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("Recent insight");
      expect(result.content[0]!.text).toContain("Older insight");
      expect(result.content[0]!.text).toContain("2 most recent");
      expect(mockPrisma.bazdmegMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      );
    });

    it("respects custom limit", async () => {
      mockPrisma.bazdmegMemory.findMany.mockResolvedValueOnce([]);

      const handler = registry.tools.get("bazdmeg_memory_list")!.handler;
      await handler({ limit: 5 });

      expect(mockPrisma.bazdmegMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it("returns message when no insights exist", async () => {
      mockPrisma.bazdmegMemory.findMany.mockResolvedValueOnce([]);

      const handler = registry.tools.get("bazdmeg_memory_list")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain(
        "No BAZDMEG insights saved yet",
      );
    });

    it("handles database errors gracefully", async () => {
      mockPrisma.bazdmegMemory.findMany.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("bazdmeg_memory_list")!.handler;
      const result = await handler({});

      expect(result.isError).toBe(true);
    });

    it("formats date correctly", async () => {
      mockPrisma.bazdmegMemory.findMany.mockResolvedValueOnce([
        {
          insight: "Dated insight",
          tags: [],
          createdAt: new Date("2026-02-17T10:30:00Z"),
          confidence: 0.7,
        },
      ]);

      const handler = registry.tools.get("bazdmeg_memory_list")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("2026-02-17");
    });
  });
});
