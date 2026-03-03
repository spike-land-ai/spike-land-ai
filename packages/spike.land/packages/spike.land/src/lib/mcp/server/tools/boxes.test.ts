import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  box: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  boxTier: {
    findUnique: vi.fn(),
  },
  boxAction: {
    create: vi.fn(),
  },
  toolInvocation: {
    create: vi.fn(),
  },
}));

const mockCreditManager = vi.hoisted(() => ({
  hasEnoughCredits: vi.fn(),
  consumeCredits: vi.fn(),
  refundCredits: vi.fn(),
}));

const mockTriggerBoxProvisioning = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/credits/workspace-credit-manager", () => ({
  WorkspaceCreditManager: mockCreditManager,
}));
vi.mock("@/lib/boxes/provisioning", () => ({
  triggerBoxProvisioning: mockTriggerBoxProvisioning,
}));
vi.mock(
  "@/lib/logger",
  () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }),
);

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerBoxesTools } from "./boxes";

describe("boxes tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBoxesTools(registry, userId);
    mockPrisma.toolInvocation.create.mockResolvedValue({});
  });

  it("should register 4 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
  });

  describe("boxes_list", () => {
    it("should return boxes for user", async () => {
      const boxes = [{ id: "box-1", name: "Test Box", userId }];
      mockPrisma.box.findMany.mockResolvedValue(boxes);

      const handler = registry.handlers.get("boxes_list")!;
      const result = await handler({});

      expect(mockPrisma.box.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId, deletedAt: null } }),
      );
      expect(getText(result)).toContain("box-1");
    });
  });

  describe("boxes_create", () => {
    it("should create a box and consume credits", async () => {
      mockPrisma.boxTier.findUnique.mockResolvedValue({
        id: "tier-1",
        pricePerHour: 10,
      });
      mockCreditManager.hasEnoughCredits.mockResolvedValue(true);
      mockCreditManager.consumeCredits.mockResolvedValue(undefined);
      const box = { id: "box-new", name: "New Box", userId };
      mockPrisma.box.create.mockResolvedValue(box);
      mockTriggerBoxProvisioning.mockResolvedValue(undefined);

      const handler = registry.handlers.get("boxes_create")!;
      const result = await handler({ name: "New Box", tierId: "tier-1" });

      expect(getText(result)).toContain("box-new");
      expect(mockCreditManager.consumeCredits).toHaveBeenCalled();
    });

    it("should refund credits when box creation fails", async () => {
      mockPrisma.boxTier.findUnique.mockResolvedValue({
        id: "tier-1",
        pricePerHour: 10,
      });
      mockCreditManager.hasEnoughCredits.mockResolvedValue(true);
      mockCreditManager.consumeCredits.mockResolvedValue(undefined);
      mockPrisma.box.create.mockRejectedValue(new Error("DB error"));
      mockCreditManager.refundCredits.mockResolvedValue(true);

      const handler = registry.handlers.get("boxes_create")!;
      const result = await handler({ name: "Fail Box", tierId: "tier-1" });

      expect(mockCreditManager.refundCredits).toHaveBeenCalledWith(userId, 10);
      expect(isError(result)).toBe(true);
    });

    it("should error when tier is invalid", async () => {
      mockPrisma.boxTier.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("boxes_create")!;
      const result = await handler({ name: "Bad", tierId: "bad-tier" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Invalid tier");
    });

    it("should reject when insufficient credits", async () => {
      mockPrisma.boxTier.findUnique.mockResolvedValue({
        id: "tier-1",
        pricePerHour: 10,
      });
      mockCreditManager.hasEnoughCredits.mockResolvedValue(false);

      const handler = registry.handlers.get("boxes_create")!;
      const result = await handler({ name: "No Credits", tierId: "tier-1" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Insufficient credits");
    });
  });

  describe("boxes_action", () => {
    it("should include userId in update where clause (TOCTOU fix)", async () => {
      const box = { id: "box-1", status: "RUNNING", userId };
      mockPrisma.box.findUnique.mockResolvedValue(box);
      mockPrisma.boxAction.create.mockResolvedValue({});
      mockPrisma.box.update.mockResolvedValue({ ...box, status: "STOPPING" });

      const handler = registry.handlers.get("boxes_action")!;
      await handler({ id: "box-1", action: "STOP" });

      expect(mockPrisma.box.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "box-1", userId },
        }),
      );
    });

    it("should set STARTING status for START action", async () => {
      const box = { id: "box-1", status: "STOPPED", userId };
      mockPrisma.box.findUnique.mockResolvedValue(box);
      mockPrisma.boxAction.create.mockResolvedValue({});
      mockPrisma.box.update.mockResolvedValue({ ...box, status: "STARTING" });

      const handler = registry.handlers.get("boxes_action")!;
      const result = await handler({ id: "box-1", action: "START" });

      expect(isError(result)).toBe(false);
      expect(mockPrisma.box.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "STARTING" },
        }),
      );
    });

    it("should set STARTING status for RESTART action", async () => {
      const box = { id: "box-1", status: "RUNNING", userId };
      mockPrisma.box.findUnique.mockResolvedValue(box);
      mockPrisma.boxAction.create.mockResolvedValue({});
      mockPrisma.box.update.mockResolvedValue({ ...box, status: "STARTING" });

      const handler = registry.handlers.get("boxes_action")!;
      const result = await handler({ id: "box-1", action: "RESTART" });

      expect(isError(result)).toBe(false);
      expect(mockPrisma.box.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "STARTING" },
        }),
      );
    });

    it("should error when box not found", async () => {
      mockPrisma.box.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("boxes_action")!;
      const result = await handler({ id: "nonexistent", action: "STOP" });

      expect(isError(result)).toBe(true);
    });
  });

  describe("boxes_get", () => {
    it("should return box details", async () => {
      const box = {
        id: "box-1",
        name: "Test",
        userId,
        tier: { name: "Basic" },
      };
      mockPrisma.box.findUnique.mockResolvedValue(box);

      const handler = registry.handlers.get("boxes_get")!;
      const result = await handler({ id: "box-1" });

      expect(getText(result)).toContain("box-1");
    });

    it("should error when box not found", async () => {
      mockPrisma.box.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("boxes_get")!;
      const result = await handler({ id: "nonexistent" });

      expect(isError(result)).toBe(true);
    });
  });
});
