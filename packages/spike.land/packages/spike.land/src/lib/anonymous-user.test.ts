import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrismaUserUpsert } = vi.hoisted(() => ({
  mockPrismaUserUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { upsert: mockPrismaUserUpsert },
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

vi.mock("@/lib/errors/structured-logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  ANONYMOUS_USER_ID_CONST,
  getOrCreateAnonymousUser,
  isAnonymousUserId,
} from "./anonymous-user";

describe("anonymous-user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ANONYMOUS_USER_ID_CONST", () => {
    it("is the expected constant string", () => {
      expect(ANONYMOUS_USER_ID_CONST).toBe("anonymous-system-user");
    });
  });

  describe("isAnonymousUserId", () => {
    it("returns true for the anonymous user ID", () => {
      expect(isAnonymousUserId("anonymous-system-user")).toBe(true);
    });

    it("returns false for any other ID", () => {
      expect(isAnonymousUserId("user_abc123")).toBe(false);
      expect(isAnonymousUserId("")).toBe(false);
      expect(isAnonymousUserId("ANONYMOUS-SYSTEM-USER")).toBe(false);
    });
  });

  describe("getOrCreateAnonymousUser", () => {
    it("returns the anonymous user ID on success", async () => {
      mockPrismaUserUpsert.mockResolvedValue({
        id: "anonymous-system-user",
        email: "anonymous@system.spike.land",
        name: "Anonymous User",
      });

      const id = await getOrCreateAnonymousUser();
      expect(id).toBe("anonymous-system-user");
    });

    it("calls prisma.user.upsert with correct args", async () => {
      mockPrismaUserUpsert.mockResolvedValue({ id: "anonymous-system-user" });

      await getOrCreateAnonymousUser();

      expect(mockPrismaUserUpsert).toHaveBeenCalledWith({
        where: { id: "anonymous-system-user" },
        update: {},
        create: {
          id: "anonymous-system-user",
          email: "anonymous@system.spike.land",
          name: "Anonymous User",
        },
      });
    });

    it("throws when upsert fails", async () => {
      mockPrismaUserUpsert.mockRejectedValue(new Error("DB error"));
      await expect(getOrCreateAnonymousUser()).rejects.toThrow(
        "Anonymous user initialization failed",
      );
    });

    it("throws when upsert returns null", async () => {
      mockPrismaUserUpsert.mockResolvedValue(null);
      await expect(getOrCreateAnonymousUser()).rejects.toThrow(
        "Anonymous user initialization failed",
      );
    });
  });
});
