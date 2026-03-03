import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  registeredTool: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
  },
  vaultSecret: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}));

// Mock crypto
const mockDecryptSecret = vi.fn();
vi.mock("../crypto/vault", () => ({
  decryptSecret: (...args: unknown[]) => mockDecryptSecret(...args),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { createMockRegistry } from "../__test-utils__";
import { registerToolFactoryTools } from "./tool-factory";

describe("tool factory - lifecycle & error handling", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerToolFactoryTools(registry, userId);
  });

  // ============================================================
  // publish_tool
  // ============================================================

  describe("publish_tool", () => {
    it("should publish a draft tool successfully", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "my_api_tool",
        status: "DRAFT",
        userId,
      });
      mockPrisma.registeredTool.update.mockResolvedValue({
        id: "tool-1",
        status: "PUBLISHED",
      });

      const handler = registry.handlers.get("publish_tool")!;
      const result = await handler({ tool_id: "tool-1" });

      expect(mockPrisma.registeredTool.update).toHaveBeenCalledWith({
        where: { id: "tool-1" },
        data: { status: "PUBLISHED" },
      });
      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Tool Published"),
            }),
          ]),
        }),
      );
    });

    it("should include tool name in publish success message", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "weather_lookup",
        status: "DRAFT",
        userId,
      });
      mockPrisma.registeredTool.update.mockResolvedValue({
        id: "tool-1",
        status: "PUBLISHED",
      });

      const handler = registry.handlers.get("publish_tool")!;
      const result = await handler({ tool_id: "tool-1" });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("weather_lookup");
      expect(text).toContain("PUBLISHED");
    });

    it("should reject publishing a non-draft tool (already published)", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "my_api_tool",
        status: "PUBLISHED",
        userId,
      });

      const handler = registry.handlers.get("publish_tool")!;
      const result = await handler({ tool_id: "tool-1" });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("not DRAFT"),
            }),
          ]),
        }),
      );
      expect(mockPrisma.registeredTool.update).not.toHaveBeenCalled();
    });

    it("should reject publishing a disabled tool", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "my_api_tool",
        status: "DISABLED",
        userId,
      });

      const handler = registry.handlers.get("publish_tool")!;
      const result = await handler({ tool_id: "tool-1" });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("DISABLED"),
            }),
          ]),
        }),
      );
    });

    it("should return error when tool is not found", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("publish_tool")!;
      const result = await handler({ tool_id: "nonexistent" });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Tool not found"),
            }),
          ]),
        }),
      );
    });

    it("should handle database errors", async () => {
      mockPrisma.registeredTool.findFirst.mockRejectedValue(
        new Error("DB error"),
      );

      const handler = registry.handlers.get("publish_tool")!;
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
  });

  // ============================================================
  // list_registered_tools
  // ============================================================

  describe("list_registered_tools", () => {
    it("should list tools with details", async () => {
      const createdAt = new Date("2025-06-01T12:00:00Z");
      mockPrisma.registeredTool.findMany.mockResolvedValue([
        {
          id: "tool-1",
          name: "weather_api",
          description: "Get weather data",
          status: "PUBLISHED",
          installCount: 42,
          createdAt,
        },
        {
          id: "tool-2",
          name: "translate_api",
          description: "Translate text",
          status: "DRAFT",
          installCount: 0,
          createdAt,
        },
      ]);
      mockPrisma.registeredTool.count.mockResolvedValue(2);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("list_registered_tools")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Registered Tools (2/5)");
      expect(text).toContain("weather_api");
      expect(text).toContain("PUBLISHED");
      expect(text).toContain("translate_api");
      expect(text).toContain("DRAFT");
      expect(text).toContain("Get weather data");
      expect(text).toContain("Installs: 42");
    });

    it("should show empty list message", async () => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([]);
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("list_registered_tools")!;
      const result = await handler({});

      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("No tools registered"),
            }),
          ]),
        }),
      );
    });

    it("should show quota for premium users", async () => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([]);
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        tier: "PREMIUM",
      });

      const handler = registry.handlers.get("list_registered_tools")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("0/500");
    });

    it("should handle database errors", async () => {
      mockPrisma.registeredTool.findMany.mockRejectedValue(
        new Error("DB error"),
      );

      const handler = registry.handlers.get("list_registered_tools")!;
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
  });

  // ============================================================
  // disable_tool
  // ============================================================

  describe("disable_tool", () => {
    it("should disable a published tool successfully", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "my_api_tool",
        status: "PUBLISHED",
        userId,
      });
      mockPrisma.registeredTool.update.mockResolvedValue({
        id: "tool-1",
        status: "DISABLED",
      });

      const handler = registry.handlers.get("disable_tool")!;
      const result = await handler({ tool_id: "tool-1" });

      expect(mockPrisma.registeredTool.update).toHaveBeenCalledWith({
        where: { id: "tool-1" },
        data: { status: "DISABLED" },
      });
      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Tool Disabled"),
            }),
          ]),
        }),
      );
    });

    it("should disable a draft tool successfully", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "my_draft_tool",
        status: "DRAFT",
        userId,
      });
      mockPrisma.registeredTool.update.mockResolvedValue({
        id: "tool-1",
        status: "DISABLED",
      });

      const handler = registry.handlers.get("disable_tool")!;
      const result = await handler({ tool_id: "tool-1" });

      expect(mockPrisma.registeredTool.update).toHaveBeenCalledWith({
        where: { id: "tool-1" },
        data: { status: "DISABLED" },
      });
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Tool Disabled");
      expect(text).toContain("my_draft_tool");
    });

    it("should handle already disabled tool without error", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "my_api_tool",
        status: "DISABLED",
        userId,
      });

      const handler = registry.handlers.get("disable_tool")!;
      const result = await handler({ tool_id: "tool-1" });

      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("already disabled"),
            }),
          ]),
        }),
      );
      expect(mockPrisma.registeredTool.update).not.toHaveBeenCalled();
    });

    it("should return error when tool is not found", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("disable_tool")!;
      const result = await handler({ tool_id: "nonexistent" });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Tool not found"),
            }),
          ]),
        }),
      );
    });

    it("should handle database errors", async () => {
      mockPrisma.registeredTool.findFirst.mockRejectedValue(
        new Error("DB error"),
      );

      const handler = registry.handlers.get("disable_tool")!;
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

    it("should handle non-Error throws with 'Unknown error' message", async () => {
      mockPrisma.registeredTool.findFirst.mockRejectedValue("string error");

      const handler = registry.handlers.get("disable_tool")!;
      const result = await handler({ tool_id: "tool-1" });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Unknown error");
      expect((result as { isError: boolean; }).isError).toBe(true);
    });
  });

  // ============================================================
  // Non-Error throw branches (coverage for instanceof Error checks)
  // ============================================================

  describe("non-Error throw branches", () => {
    it("register_tool should handle non-Error throw", async () => {
      mockPrisma.registeredTool.count.mockRejectedValue("string throw");

      const handler = registry.handlers.get("register_tool")!;
      const result = await handler({
        name: "test_tool_name",
        description: "desc",
        input_schema: {},
        handler_spec: {
          url: "https://api.example.com/data",
          method: "GET" as const,
          headers: {},
        },
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Unknown error");
      expect((result as { isError: boolean; }).isError).toBe(true);
    });

    it("test_tool should handle non-Error throw", async () => {
      mockPrisma.registeredTool.findFirst.mockRejectedValue(42);

      const handler = registry.handlers.get("test_tool")!;
      const result = await handler({
        tool_id: "tool-1",
        test_input: {},
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Unknown error");
      expect((result as { isError: boolean; }).isError).toBe(true);
    });

    it("publish_tool should handle non-Error throw", async () => {
      mockPrisma.registeredTool.findFirst.mockRejectedValue("string throw");

      const handler = registry.handlers.get("publish_tool")!;
      const result = await handler({ tool_id: "tool-1" });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Unknown error");
      expect((result as { isError: boolean; }).isError).toBe(true);
    });

    it("list_registered_tools should handle non-Error throw", async () => {
      mockPrisma.registeredTool.findMany.mockRejectedValue("string throw");

      const handler = registry.handlers.get("list_registered_tools")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("Unknown error");
      expect((result as { isError: boolean; }).isError).toBe(true);
    });
  });
});
