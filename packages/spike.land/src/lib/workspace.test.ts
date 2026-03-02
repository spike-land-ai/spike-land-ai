import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    workspace: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { getPersonalWorkspaceId } from "./workspace";

const mockAuth = vi.mocked(auth);

describe("workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPersonalWorkspaceId", () => {
    it("should return null when no session", async () => {
      mockAuth.mockResolvedValue(null);
      expect(await getPersonalWorkspaceId()).toBeNull();
    });

    it("should return null when session has no user id", async () => {
      mockAuth.mockResolvedValue({ user: {} } as ReturnType<typeof auth> extends Promise<infer T>
        ? T
        : never);
      expect(await getPersonalWorkspaceId()).toBeNull();
    });

    it("should return workspace id when found", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user-1" },
      } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
      mockPrisma.workspace.findFirst.mockResolvedValue({ id: "ws-personal" });

      const result = await getPersonalWorkspaceId();

      expect(result).toBe("ws-personal");
      expect(mockPrisma.workspace.findFirst).toHaveBeenCalledWith({
        where: {
          isPersonal: true,
          members: { some: { userId: "user-1" } },
        },
        select: { id: true },
      });
    });

    it("should return null when no personal workspace exists", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user-1" },
      } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
      mockPrisma.workspace.findFirst.mockResolvedValue(null);

      expect(await getPersonalWorkspaceId()).toBeNull();
    });
  });
});
