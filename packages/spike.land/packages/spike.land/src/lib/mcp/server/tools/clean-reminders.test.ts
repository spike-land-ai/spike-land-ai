import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  cleaningReminder: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { registerCleanRemindersTools } from "./clean-reminders";

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

describe("Clean Reminders MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCleanRemindersTools(
      registry as unknown as Parameters<typeof registerCleanRemindersTools>[0],
      "user123",
    );
  });

  it("registers 4 reminder tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.tools.has("clean_reminders_create")).toBe(true);
    expect(registry.tools.has("clean_reminders_list")).toBe(true);
    expect(registry.tools.has("clean_reminders_update")).toBe(true);
    expect(registry.tools.has("clean_reminders_delete")).toBe(true);
  });

  describe("clean_reminders_create", () => {
    it("creates a reminder", async () => {
      mockPrisma.cleaningReminder.create.mockResolvedValueOnce({
        id: "rem-1",
        time: "09:00",
        days: ["MON", "WED", "FRI"],
        message: "Time to clean!",
        enabled: true,
      } as never);

      const handler = registry.tools.get("clean_reminders_create")!.handler;
      const result = await handler({
        time: "09:00",
        days: ["MON", "WED", "FRI"],
        message: "Time to clean!",
      });

      expect(result.content[0]!.text).toContain("Reminder created");
      expect(result.content[0]!.text).toContain("rem-1");
      expect(result.content[0]!.text).toContain("09:00");
      expect(result.content[0]!.text).toContain("MON, WED, FRI");
      expect(result.content[0]!.text).toContain("Time to clean!");
    });

    it("creates reminder without custom message", async () => {
      mockPrisma.cleaningReminder.create.mockResolvedValueOnce({
        id: "rem-2",
        time: "18:00",
        days: ["SAT"],
        message: null,
        enabled: true,
      } as never);

      const handler = registry.tools.get("clean_reminders_create")!.handler;
      const result = await handler({ time: "18:00", days: ["SAT"] });

      expect(result.content[0]!.text).toContain("Reminder created");
      expect(result.content[0]!.text).not.toContain("Message:");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningReminder.create.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_reminders_create")!.handler;
      const result = await handler({ time: "09:00", days: ["MON"] });

      expect(result.isError).toBe(true);
    });
  });

  describe("clean_reminders_list", () => {
    it("returns reminders", async () => {
      mockPrisma.cleaningReminder.findMany.mockResolvedValueOnce([
        {
          id: "rem-1",
          time: "09:00",
          days: ["MON", "WED", "FRI"],
          message: "Clean!",
          enabled: true,
        },
        {
          id: "rem-2",
          time: "18:00",
          days: ["SAT", "SUN"],
          message: null,
          enabled: false,
        },
      ] as never);

      const handler = registry.tools.get("clean_reminders_list")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("Your Cleaning Reminders (2)");
      expect(result.content[0]!.text).toContain("09:00");
      expect(result.content[0]!.text).toContain("[ON]");
      expect(result.content[0]!.text).toContain("[OFF]");
      expect(result.content[0]!.text).toContain("Clean!");
    });

    it("returns empty message when no reminders", async () => {
      mockPrisma.cleaningReminder.findMany.mockResolvedValueOnce([]);

      const handler = registry.tools.get("clean_reminders_list")!.handler;
      const result = await handler({});

      expect(result.content[0]!.text).toContain("No reminders set");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningReminder.findMany.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_reminders_list")!.handler;
      const result = await handler({});

      expect(result.isError).toBe(true);
    });
  });

  describe("clean_reminders_update", () => {
    it("updates reminder fields", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce({
        id: "rem-1",
        userId: "user123",
      } as never);
      mockPrisma.cleaningReminder.update.mockResolvedValueOnce({
        id: "rem-1",
        time: "10:00",
        days: ["MON", "TUE"],
        enabled: true,
        message: "Updated message",
      } as never);

      const handler = registry.tools.get("clean_reminders_update")!.handler;
      const result = await handler({
        reminder_id: "rem-1",
        time: "10:00",
        days: ["MON", "TUE"],
        message: "Updated message",
      });

      expect(result.content[0]!.text).toContain("Reminder updated");
      expect(result.content[0]!.text).toContain("10:00");
      expect(result.content[0]!.text).toContain("MON, TUE");
    });

    it("returns error for non-owned reminder", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_reminders_update")!.handler;
      const result = await handler({ reminder_id: "bad", time: "10:00" });

      expect(result.content[0]!.text).toContain("Reminder not found");
    });

    it("returns error when no fields to update", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce({
        id: "rem-1",
        userId: "user123",
      } as never);

      const handler = registry.tools.get("clean_reminders_update")!.handler;
      const result = await handler({ reminder_id: "rem-1" });

      expect(result.content[0]!.text).toContain("No fields to update");
    });

    it("updates enabled field and shows disabled status", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce({
        id: "rem-1",
        userId: "user123",
      } as never);
      mockPrisma.cleaningReminder.update.mockResolvedValueOnce({
        id: "rem-1",
        time: "09:00",
        days: ["MON"],
        enabled: false,
        message: null,
      } as never);

      const handler = registry.tools.get("clean_reminders_update")!.handler;
      const result = await handler({
        reminder_id: "rem-1",
        enabled: false,
      });

      expect(result.content[0]!.text).toContain("Reminder updated");
      expect(result.content[0]!.text).toContain("Enabled:** No");
      expect(result.content[0]!.text).not.toContain("Message:");
    });

    it("updates with message and shows it in output", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce({
        id: "rem-1",
        userId: "user123",
      } as never);
      mockPrisma.cleaningReminder.update.mockResolvedValueOnce({
        id: "rem-1",
        time: "09:00",
        days: ["MON"],
        enabled: true,
        message: "Updated msg",
      } as never);

      const handler = registry.tools.get("clean_reminders_update")!.handler;
      const result = await handler({
        reminder_id: "rem-1",
        message: "Updated msg",
      });

      expect(result.content[0]!.text).toContain("Enabled:** Yes");
      expect(result.content[0]!.text).toContain("Message:** Updated msg");
    });

    it("handles database error", async () => {
      mockPrisma.cleaningReminder.findFirst.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_reminders_update")!.handler;
      const result = await handler({ reminder_id: "rem-1", time: "10:00" });

      expect(result.isError).toBe(true);
    });
  });

  describe("clean_reminders_delete", () => {
    it("deletes reminder and verifies ownership", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce({
        id: "rem-1",
        userId: "user123",
        time: "09:00",
        days: ["MON", "WED"],
      } as never);
      mockPrisma.cleaningReminder.delete.mockResolvedValueOnce(
        undefined as never,
      );

      const handler = registry.tools.get("clean_reminders_delete")!.handler;
      const result = await handler({ reminder_id: "rem-1" });

      expect(result.content[0]!.text).toContain("Reminder deleted");
      expect(result.content[0]!.text).toContain("09:00");
      expect(result.content[0]!.text).toContain("MON, WED");
      expect(mockPrisma.cleaningReminder.delete).toHaveBeenCalledWith({
        where: { id: "rem-1" },
      });
    });

    it("returns error for non-owned reminder", async () => {
      mockPrisma.cleaningReminder.findFirst.mockResolvedValueOnce(null);

      const handler = registry.tools.get("clean_reminders_delete")!.handler;
      const result = await handler({ reminder_id: "bad" });

      expect(result.content[0]!.text).toContain("Reminder not found");
      expect(mockPrisma.cleaningReminder.delete).not.toHaveBeenCalled();
    });

    it("handles database error", async () => {
      mockPrisma.cleaningReminder.findFirst.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const handler = registry.tools.get("clean_reminders_delete")!.handler;
      const result = await handler({ reminder_id: "rem-1" });

      expect(result.isError).toBe(true);
    });
  });
});
