import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  permissionRequest: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { registerPermissionsTools } from "./permissions";

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

describe("Permissions MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerPermissionsTools(
      registry as unknown as Parameters<typeof registerPermissionsTools>[0],
      "user123",
    );
  });

  it("registers 2 permissions tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(2);
    expect(registry.tools.has("permissions_list_pending")).toBe(true);
    expect(registry.tools.has("permissions_respond")).toBe(true);
  });

  describe("permissions_list_pending", () => {
    it("returns pending permission requests", async () => {
      mockPrisma.permissionRequest.findMany.mockResolvedValueOnce([
        {
          id: "req-1",
          requestType: "read:data",
          createdAt: new Date("2026-01-15T10:00:00Z"),
          agent: { displayName: "Test Agent" },
          template: { displayName: "Data Reader" },
        },
      ]);

      const handler = registry.tools.get("permissions_list_pending")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("Test Agent");
      expect(result.content[0]!.text).toContain("read:data");
      expect(result.content[0]!.text).toContain("req-1");
      expect(mockPrisma.permissionRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user123", status: "PENDING" },
        }),
      );
    });

    it("returns message when no pending requests", async () => {
      mockPrisma.permissionRequest.findMany.mockResolvedValueOnce([]);

      const handler = registry.tools.get("permissions_list_pending")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain(
        "No pending permission requests",
      );
    });

    it("handles database errors gracefully", async () => {
      mockPrisma.permissionRequest.findMany.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("permissions_list_pending")!.handler;
      const result = await handler({});

      expect(result.isError).toBe(true);
    });
  });

  describe("permissions_respond", () => {
    it("approves a pending request", async () => {
      mockPrisma.permissionRequest.findUnique.mockResolvedValueOnce({
        id: "req-1",
        userId: "user123",
        status: "PENDING",
      });
      mockPrisma.permissionRequest.update.mockResolvedValueOnce({
        id: "req-1",
        status: "APPROVED",
      });

      const handler = registry.tools.get("permissions_respond")!.handler;
      const result = await handler({ requestId: "req-1", action: "APPROVE" });

      expect(result.content[0]!.text).toContain("Approved");
      expect(result.content[0]!.text).toContain("req-1");
      expect(mockPrisma.permissionRequest.update).toHaveBeenCalledWith({
        where: { id: "req-1" },
        data: { status: "APPROVED" },
      });
    });

    it("denies a pending request", async () => {
      mockPrisma.permissionRequest.findUnique.mockResolvedValueOnce({
        id: "req-2",
        userId: "user123",
        status: "PENDING",
      });
      mockPrisma.permissionRequest.update.mockResolvedValueOnce({
        id: "req-2",
        status: "DENIED",
      });

      const handler = registry.tools.get("permissions_respond")!.handler;
      const result = await handler({ requestId: "req-2", action: "DENY" });

      expect(result.content[0]!.text).toContain("Denied");
      expect(mockPrisma.permissionRequest.update).toHaveBeenCalledWith({
        where: { id: "req-2" },
        data: { status: "DENIED" },
      });
    });

    it("returns error for non-existent request", async () => {
      mockPrisma.permissionRequest.findUnique.mockResolvedValueOnce(null);

      const handler = registry.tools.get("permissions_respond")!.handler;
      const result = await handler({ requestId: "bad-id", action: "APPROVE" });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("not found");
    });

    it("returns error for already processed request", async () => {
      mockPrisma.permissionRequest.findUnique.mockResolvedValueOnce({
        id: "req-3",
        userId: "user123",
        status: "APPROVED",
      });

      const handler = registry.tools.get("permissions_respond")!.handler;
      const result = await handler({ requestId: "req-3", action: "DENY" });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("already APPROVED");
    });

    it("handles database errors gracefully", async () => {
      mockPrisma.permissionRequest.findUnique.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("permissions_respond")!.handler;
      const result = await handler({ requestId: "req-1", action: "APPROVE" });

      expect(result.isError).toBe(true);
    });
  });
});
