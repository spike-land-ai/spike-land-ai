import { describe, expect, it, vi } from "vitest";

const { mockPrismaUserCount, mockPrismaUserUpdate } = vi.hoisted(() => ({
  mockPrismaUserCount: vi.fn(),
  mockPrismaUserUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      count: mockPrismaUserCount,
      update: mockPrismaUserUpdate,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@prisma/client", () => ({
  UserRole: {
    USER: "USER",
    ADMIN: "ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
  },
}));

import { bootstrapAdminIfNeeded, hasAnyAdmin } from "./bootstrap-admin";

describe("hasAnyAdmin", () => {
  beforeEach(() => {
    mockPrismaUserCount.mockReset();
  });

  it("returns true when admin count is > 0", async () => {
    mockPrismaUserCount.mockResolvedValue(1);
    expect(await hasAnyAdmin()).toBe(true);
  });

  it("returns true when multiple admins exist", async () => {
    mockPrismaUserCount.mockResolvedValue(3);
    expect(await hasAnyAdmin()).toBe(true);
  });

  it("returns false when no admins exist", async () => {
    mockPrismaUserCount.mockResolvedValue(0);
    expect(await hasAnyAdmin()).toBe(false);
  });

  it("queries for both ADMIN and SUPER_ADMIN roles", async () => {
    mockPrismaUserCount.mockResolvedValue(0);
    await hasAnyAdmin();
    expect(mockPrismaUserCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { role: "ADMIN" },
            { role: "SUPER_ADMIN" },
          ]),
        }),
      }),
    );
  });
});

describe("bootstrapAdminIfNeeded", () => {
  beforeEach(() => {
    mockPrismaUserCount.mockReset();
    mockPrismaUserUpdate.mockReset();
  });

  it("returns false when an admin already exists", async () => {
    mockPrismaUserCount.mockResolvedValue(1);
    const result = await bootstrapAdminIfNeeded("user-1");
    expect(result).toBe(false);
    expect(mockPrismaUserUpdate).not.toHaveBeenCalled();
  });

  it("promotes user to ADMIN when no admin exists", async () => {
    mockPrismaUserCount.mockResolvedValue(0);
    mockPrismaUserUpdate.mockResolvedValue({ id: "user-1", role: "ADMIN" });

    const result = await bootstrapAdminIfNeeded("user-1");
    expect(result).toBe(true);
  });

  it("calls prisma.user.update with ADMIN role for the correct userId", async () => {
    mockPrismaUserCount.mockResolvedValue(0);
    mockPrismaUserUpdate.mockResolvedValue({ id: "user-xyz" });

    await bootstrapAdminIfNeeded("user-xyz");

    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-xyz" },
      data: { role: "ADMIN" },
    });
  });

  it("returns false when hasAnyAdmin check throws", async () => {
    mockPrismaUserCount.mockRejectedValue(new Error("DB connection lost"));
    const result = await bootstrapAdminIfNeeded("user-err");
    expect(result).toBe(false);
    expect(mockPrismaUserUpdate).not.toHaveBeenCalled();
  });

  it("returns false when user update throws", async () => {
    mockPrismaUserCount.mockResolvedValue(0);
    mockPrismaUserUpdate.mockRejectedValue(new Error("Update failed"));

    const result = await bootstrapAdminIfNeeded("user-fail");
    expect(result).toBe(false);
  });
});
