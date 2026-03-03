import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mock fns so they're available inside vi.mock factories
const { mockPrismaUserFindUnique } = vi.hoisted(() => ({
  mockPrismaUserFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: mockPrismaUserFindUnique,
    },
  },
}));

vi.mock("@/lib/try-catch", () => ({
  tryCatch: async <T>(p: Promise<T>) => {
    try {
      return { data: await p, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },
}));

vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockHeadersGet = vi.fn();
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve({ get: mockHeadersGet })),
}));

// Prisma UserRole values
vi.mock("@prisma/client", () => ({
  UserRole: {
    USER: "USER",
    ADMIN: "ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
  },
}));

import {
  isAdmin,
  isAdminByUserId,
  isSuperAdmin,
  requireAdmin,
  requireAdminByUserId,
  verifyAdminAccess,
} from "./admin-middleware";
import type { Session } from "next-auth";

function makeSession(role: string, id = "user_123"): Session {
  return {
    user: { id, role, name: "Test", email: "test@example.com" },
    expires: "2099-01-01",
  } as unknown as Session;
}

describe("admin-middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    mockHeadersGet.mockReturnValue(null);
    mockPrismaUserFindUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isAdmin", () => {
    it("returns false for null session", () => {
      expect(isAdmin(null)).toBe(false);
    });

    it("returns false for USER role", () => {
      expect(isAdmin(makeSession("USER"))).toBe(false);
    });

    it("returns true for ADMIN role", () => {
      expect(isAdmin(makeSession("ADMIN"))).toBe(true);
    });

    it("returns true for SUPER_ADMIN role", () => {
      expect(isAdmin(makeSession("SUPER_ADMIN"))).toBe(true);
    });

    it("returns false when session has no user id", () => {
      const session = { user: { name: "Test" }, expires: "2099-01-01" } as unknown as Session;
      expect(isAdmin(session)).toBe(false);
    });
  });

  describe("isAdminByUserId", () => {
    it("returns false when user not found", async () => {
      mockPrismaUserFindUnique.mockResolvedValue(null);
      expect(await isAdminByUserId("user_123")).toBe(false);
    });

    it("returns false for USER role in DB", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({ role: "USER" });
      expect(await isAdminByUserId("user_123")).toBe(false);
    });

    it("returns true for ADMIN role in DB", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({ role: "ADMIN" });
      expect(await isAdminByUserId("user_123")).toBe(true);
    });

    it("returns true for SUPER_ADMIN role in DB", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({ role: "SUPER_ADMIN" });
      expect(await isAdminByUserId("user_123")).toBe(true);
    });

    it("returns false and logs on DB error", async () => {
      mockPrismaUserFindUnique.mockRejectedValue(new Error("DB down"));
      expect(await isAdminByUserId("user_123")).toBe(false);
    });
  });

  describe("isSuperAdmin", () => {
    it("returns false when user not found", async () => {
      mockPrismaUserFindUnique.mockResolvedValue(null);
      expect(await isSuperAdmin("user_123")).toBe(false);
    });

    it("returns false for ADMIN role in DB", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({ role: "ADMIN" });
      expect(await isSuperAdmin("user_123")).toBe(false);
    });

    it("returns true for SUPER_ADMIN role in DB", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({ role: "SUPER_ADMIN" });
      expect(await isSuperAdmin("user_123")).toBe(true);
    });

    it("returns false and logs on DB error", async () => {
      mockPrismaUserFindUnique.mockRejectedValue(new Error("DB down"));
      expect(await isSuperAdmin("user_123")).toBe(false);
    });
  });

  describe("requireAdmin", () => {
    it("throws when session is null", () => {
      expect(() => requireAdmin(null)).toThrow("Unauthorized");
    });

    it("throws when user is not admin", () => {
      expect(() => requireAdmin(makeSession("USER"))).toThrow("Forbidden");
    });

    it("does not throw for ADMIN role", () => {
      expect(() => requireAdmin(makeSession("ADMIN"))).not.toThrow();
    });

    it("does not throw for SUPER_ADMIN role", () => {
      expect(() => requireAdmin(makeSession("SUPER_ADMIN"))).not.toThrow();
    });
  });

  describe("requireAdminByUserId", () => {
    it("throws when user is not admin in DB", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({ role: "USER" });
      await expect(requireAdminByUserId("user_123")).rejects.toThrow("Forbidden");
    });

    it("resolves when user is admin in DB", async () => {
      mockPrismaUserFindUnique.mockResolvedValue({ role: "ADMIN" });
      await expect(requireAdminByUserId("user_123")).resolves.toBeUndefined();
    });
  });

  describe("verifyAdminAccess", () => {
    it("returns false for null session", async () => {
      expect(await verifyAdminAccess(null)).toBe(false);
    });

    it("returns false for session with no id", async () => {
      const session = { user: { name: "Test" }, expires: "2099-01-01" } as unknown as Session;
      expect(await verifyAdminAccess(session)).toBe(false);
    });

    it("returns true for E2E bypass with ADMIN role in session", async () => {
      vi.stubEnv("NODE_ENV", "development");
      process.env.E2E_BYPASS_AUTH = "true";
      expect(await verifyAdminAccess(makeSession("ADMIN"))).toBe(true);
    });

    it("returns false for E2E bypass with USER role in session", async () => {
      vi.stubEnv("NODE_ENV", "development");
      process.env.E2E_BYPASS_AUTH = "true";
      expect(await verifyAdminAccess(makeSession("USER"))).toBe(false);
    });

    it("returns true for E2E header bypass with SUPER_ADMIN role", async () => {
      vi.stubEnv("NODE_ENV", "development");
      process.env.E2E_BYPASS_SECRET = "secret123";
      mockHeadersGet.mockReturnValue("secret123");
      expect(await verifyAdminAccess(makeSession("SUPER_ADMIN"))).toBe(true);
    });

    it("delegates to isAdminByUserId in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      delete process.env.E2E_BYPASS_AUTH;
      mockPrismaUserFindUnique.mockResolvedValue({ role: "ADMIN" });
      expect(await verifyAdminAccess(makeSession("ADMIN"))).toBe(true);
    });
  });
});
