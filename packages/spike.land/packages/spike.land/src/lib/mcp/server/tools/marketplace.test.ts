import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  registeredTool: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  toolInstallation: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  toolEarning: {
    create: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}));

import { createMockRegistry } from "../__test-utils__";
import { registerMarketplaceTools } from "./marketplace";

describe("marketplace tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerMarketplaceTools(registry, userId);
  });

  it("should register 4 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("marketplace_search")).toBe(true);
    expect(registry.handlers.has("marketplace_install")).toBe(true);
    expect(registry.handlers.has("marketplace_uninstall")).toBe(true);
    expect(registry.handlers.has("marketplace_my_earnings")).toBe(true);
  });

  // ============================================================
  // marketplace_search
  // ============================================================

  describe("marketplace_search", () => {
    it("should return matching published tools", async () => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([
        {
          id: "tool-1",
          name: "weather_api",
          description: "Get weather data",
          category: "custom",
          installCount: 42,
          user: { name: "Alice" },
        },
      ]);
      mockPrisma.toolInstallation.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("marketplace_search")!;
      const result = await handler({ query: "weather", limit: 10 });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("weather_api");
      expect(text).toContain("Alice");
      expect(text).toContain("Installs: 42");
      expect(text).not.toContain("[installed]");
    });

    it("should mark installed tools", async () => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([
        {
          id: "tool-1",
          name: "weather_api",
          description: "Get weather data",
          category: "custom",
          installCount: 42,
          user: { name: "Alice" },
        },
      ]);
      mockPrisma.toolInstallation.findMany.mockResolvedValue([
        { toolId: "tool-1" },
      ]);

      const handler = registry.handlers.get("marketplace_search")!;
      const result = await handler({ query: "weather", limit: 10 });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("[installed]");
    });

    it("should return no results message", async () => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("marketplace_search")!;
      const result = await handler({ query: "nonexistent", limit: 10 });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("No marketplace tools found");
    });

    it("should handle unknown author name", async () => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([
        {
          id: "tool-2",
          name: "anon_tool",
          description: "A tool",
          category: "custom",
          installCount: 0,
          user: { name: null },
        },
      ]);
      mockPrisma.toolInstallation.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("marketplace_search")!;
      const result = await handler({ query: "anon", limit: 10 });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Author: Unknown");
    });

    it("should handle database errors", async () => {
      mockPrisma.registeredTool.findMany.mockRejectedValue(
        new Error("DB error"),
      );

      const handler = registry.handlers.get("marketplace_search")!;
      const result = await handler({ query: "test", limit: 10 });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("DB error"),
            }),
          ]),
        }),
      );
    });

    it("should handle non-Error throws", async () => {
      mockPrisma.registeredTool.findMany.mockRejectedValue("string error");

      const handler = registry.handlers.get("marketplace_search")!;
      const result = await handler({ query: "test", limit: 10 });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Unknown error");
      expect((result as { isError: boolean; }).isError).toBe(true);
    });
  });

  // ============================================================
  // marketplace_install
  // ============================================================

  describe("marketplace_install", () => {
    it("should install a published tool successfully", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "weather_api",
        userId: "author-user",
      });
      mockPrisma.toolInstallation.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);

      const handler = registry.handlers.get("marketplace_install")!;
      const result = await handler({ tool_id: "tool-1" });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Tool Installed");
      expect(text).toContain("weather_api");
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("should return error when tool is not found or not published", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("marketplace_install")!;
      const result = await handler({ tool_id: "nonexistent" });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("not found or not published"),
            }),
          ]),
        }),
      );
    });

    it("should handle already installed tool", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "weather_api",
        userId: "author-user",
      });
      mockPrisma.toolInstallation.findUnique.mockResolvedValue({
        id: "install-1",
        userId,
        toolId: "tool-1",
      });

      const handler = registry.handlers.get("marketplace_install")!;
      const result = await handler({ tool_id: "tool-1" });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("already installed");
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("should handle database errors", async () => {
      mockPrisma.registeredTool.findFirst.mockRejectedValue(
        new Error("DB error"),
      );

      const handler = registry.handlers.get("marketplace_install")!;
      const result = await handler({ tool_id: "tool-1" });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("DB error"),
            }),
          ]),
        }),
      );
    });

    it("should handle non-Error throws", async () => {
      mockPrisma.registeredTool.findFirst.mockRejectedValue("string error");

      const handler = registry.handlers.get("marketplace_install")!;
      const result = await handler({ tool_id: "tool-1" });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Unknown error");
      expect((result as { isError: boolean; }).isError).toBe(true);
    });
  });

  // ============================================================
  // marketplace_uninstall
  // ============================================================

  describe("marketplace_uninstall", () => {
    it("should uninstall a tool successfully", async () => {
      mockPrisma.toolInstallation.findUnique.mockResolvedValue({
        id: "install-1",
        userId,
        toolId: "tool-1",
        tool: { name: "weather_api" },
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const handler = registry.handlers.get("marketplace_uninstall")!;
      const result = await handler({ tool_id: "tool-1" });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Tool Uninstalled");
      expect(text).toContain("weather_api");
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("should return error when tool is not installed", async () => {
      mockPrisma.toolInstallation.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("marketplace_uninstall")!;
      const result = await handler({ tool_id: "nonexistent" });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("not installed"),
            }),
          ]),
        }),
      );
    });

    it("should handle database errors", async () => {
      mockPrisma.toolInstallation.findUnique.mockRejectedValue(
        new Error("DB error"),
      );

      const handler = registry.handlers.get("marketplace_uninstall")!;
      const result = await handler({ tool_id: "tool-1" });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("DB error"),
            }),
          ]),
        }),
      );
    });

    it("should handle non-Error throws", async () => {
      mockPrisma.toolInstallation.findUnique.mockRejectedValue("string error");

      const handler = registry.handlers.get("marketplace_uninstall")!;
      const result = await handler({ tool_id: "tool-1" });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Unknown error");
      expect((result as { isError: boolean; }).isError).toBe(true);
    });
  });

  // ============================================================
  // marketplace_my_earnings
  // ============================================================

  describe("marketplace_my_earnings", () => {
    it("should show earnings dashboard for published tools", async () => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([
        { id: "tool-1", name: "weather_api", installCount: 42 },
        { id: "tool-2", name: "translate_api", installCount: 5 },
      ]);
      mockPrisma.toolEarning.aggregate.mockResolvedValue({
        _sum: { tokens: 47 },
      });
      mockPrisma.toolEarning.groupBy.mockResolvedValue([
        { toolId: "tool-1", _sum: { tokens: 42 } },
        { toolId: "tool-2", _sum: { tokens: 5 } },
      ]);

      const handler = registry.handlers.get("marketplace_my_earnings")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Marketplace Earnings Dashboard");
      expect(text).toContain("Total Earnings:** 47 tokens");
      expect(text).toContain("Published Tools:** 2");
      expect(text).toContain("weather_api");
      expect(text).toContain("Earned: 42 tokens");
      expect(text).toContain("translate_api");
      expect(text).toContain("Earned: 5 tokens");
    });

    it("should show message when no published tools", async () => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("marketplace_my_earnings")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("no published tools");
      expect(text).toContain("register_tool");
    });

    it("should handle tools with zero earnings", async () => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([
        { id: "tool-1", name: "new_tool", installCount: 0 },
      ]);
      mockPrisma.toolEarning.aggregate.mockResolvedValue({
        _sum: { tokens: null },
      });
      mockPrisma.toolEarning.groupBy.mockResolvedValue([]);

      const handler = registry.handlers.get("marketplace_my_earnings")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Total Earnings:** 0 tokens");
      expect(text).toContain("Earned: 0 tokens");
    });

    it("should handle null tokens in per-tool groupBy result", async () => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([
        { id: "tool-1", name: "null_earnings_tool", installCount: 3 },
      ]);
      mockPrisma.toolEarning.aggregate.mockResolvedValue({
        _sum: { tokens: 0 },
      });
      mockPrisma.toolEarning.groupBy.mockResolvedValue([
        { toolId: "tool-1", _sum: { tokens: null } },
      ]);

      const handler = registry.handlers.get("marketplace_my_earnings")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("null_earnings_tool");
      expect(text).toContain("Earned: 0 tokens");
    });

    it("should handle database errors", async () => {
      mockPrisma.registeredTool.findMany.mockRejectedValue(
        new Error("DB error"),
      );

      const handler = registry.handlers.get("marketplace_my_earnings")!;
      const result = await handler({});

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("DB error"),
            }),
          ]),
        }),
      );
    });

    it("should handle non-Error throws", async () => {
      mockPrisma.registeredTool.findMany.mockRejectedValue("string error");

      const handler = registry.handlers.get("marketplace_my_earnings")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Unknown error");
      expect((result as { isError: boolean; }).isError).toBe(true);
    });
  });
});
