import { describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    auditLog: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/try-catch", () => ({
  tryCatch: async (promise: Promise<unknown>) => {
    try {
      const data = await promise;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

const { AuditLogger } = await import("./logger");

describe("AuditLogger.log", () => {
  it("creates audit log entry with correct data", async () => {
    mockCreate.mockResolvedValue({ id: "log-1" });
    await AuditLogger.log({
      userId: "admin-1",
      action: "ROLE_CHANGE",
      targetId: "user-1",
      metadata: { oldRole: "USER", newRole: "ADMIN" },
      ipAddress: "1.2.3.4",
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: "admin-1",
        action: "ROLE_CHANGE",
        targetId: "user-1",
        metadata: { oldRole: "USER", newRole: "ADMIN" },
        ipAddress: "1.2.3.4",
      },
    });
  });

  it("does not throw when prisma create fails", async () => {
    mockCreate.mockRejectedValue(new Error("DB error"));
    await expect(
      AuditLogger.log({
        userId: "admin-1",
        action: "ROLE_CHANGE",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("AuditLogger.logRoleChange", () => {
  it("logs role change with metadata", async () => {
    mockCreate.mockResolvedValue({ id: "log-2" });
    await AuditLogger.logRoleChange("admin-1", "user-1", "USER", "ADMIN");
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ROLE_CHANGE",
        metadata: { oldRole: "USER", newRole: "ADMIN" },
      }),
    });
  });
});

describe("AuditLogger.logTokenAdjustment", () => {
  it("logs token adjustment with amount and balance", async () => {
    mockCreate.mockResolvedValue({ id: "log-3" });
    await AuditLogger.logTokenAdjustment("admin-1", "user-1", 100, 500, "Bonus");
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "TOKEN_ADJUSTMENT",
        metadata: {
          amount: 100,
          balanceAfter: 500,
          reason: "Bonus",
        },
      }),
    });
  });

  it("uses default reason when none provided", async () => {
    mockCreate.mockResolvedValue({ id: "log-4" });
    await AuditLogger.logTokenAdjustment("admin-1", "user-1", 50, 150);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          reason: "Manual admin adjustment",
        }),
      }),
    });
  });
});

describe("AuditLogger.logVoucherCreate", () => {
  it("logs voucher creation", async () => {
    mockCreate.mockResolvedValue({ id: "log-5" });
    await AuditLogger.logVoucherCreate("admin-1", "voucher-1", "WELCOME50", "PERCENTAGE", 50);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "VOUCHER_CREATE",
        targetId: "voucher-1",
        metadata: {
          voucherCode: "WELCOME50",
          voucherType: "PERCENTAGE",
          value: 50,
        },
      }),
    });
  });
});

describe("AuditLogger.logVoucherUpdate", () => {
  it("logs voucher update with changes", async () => {
    mockCreate.mockResolvedValue({ id: "log-6" });
    await AuditLogger.logVoucherUpdate("admin-1", "v-1", "CODE1", {
      isActive: false,
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "VOUCHER_UPDATE",
        metadata: expect.objectContaining({
          voucherCode: "CODE1",
          isActive: false,
        }),
      }),
    });
  });
});

describe("AuditLogger.logVoucherDelete", () => {
  it("logs voucher deletion", async () => {
    mockCreate.mockResolvedValue({ id: "log-7" });
    await AuditLogger.logVoucherDelete("admin-1", "v-1", "CODE1");
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "VOUCHER_DELETE",
        metadata: { voucherCode: "CODE1" },
      }),
    });
  });
});

describe("AuditLogger.logUserDelete", () => {
  it("logs user deletion with deleted data", async () => {
    mockCreate.mockResolvedValue({ id: "log-8" });
    await AuditLogger.logUserDelete("admin-1", "user-1", "test@example.com", "Test User", {
      albums: 3,
      images: 10,
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "USER_DELETE",
        metadata: {
          userEmail: "test@example.com",
          userName: "Test User",
          deletedData: { albums: 3, images: 10 },
        },
      }),
    });
  });
});

describe("AuditLogger.getLogsByUser", () => {
  it("queries audit logs for user with default limit", async () => {
    mockFindMany.mockResolvedValue([]);
    await AuditLogger.getLogsByUser("user-1");
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: expect.objectContaining({
        id: true,
        action: true,
      }),
    });
  });

  it("respects custom limit", async () => {
    mockFindMany.mockResolvedValue([]);
    await AuditLogger.getLogsByUser("user-1", 10);
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });
});

describe("AuditLogger.getLogsByTarget", () => {
  it("queries by targetId with user relation", async () => {
    mockFindMany.mockResolvedValue([]);
    await AuditLogger.getLogsByTarget("target-1");
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { targetId: "target-1" },
        select: expect.objectContaining({
          user: { select: { email: true, name: true } },
        }),
      }),
    );
  });
});

describe("AuditLogger.getRecentLogs", () => {
  it("queries recent logs with default limit 100", async () => {
    mockFindMany.mockResolvedValue([]);
    await AuditLogger.getRecentLogs();
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it("respects custom limit", async () => {
    mockFindMany.mockResolvedValue([]);
    await AuditLogger.getRecentLogs(25);
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
  });
});
