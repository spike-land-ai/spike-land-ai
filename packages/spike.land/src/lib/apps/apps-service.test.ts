import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAppFromPrompt,
  ensureUserExists,
  generateAppName,
  generateSlug,
  getApps,
  mapMonetizationModelToEnum,
} from "./apps-service";
import prisma from "@/lib/prisma";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    app: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    appStatusHistory: { create: vi.fn() },
    appMessage: { create: vi.fn() },
    appImage: { updateMany: vi.fn(), findMany: vi.fn() },
    appAttachment: { createMany: vi.fn() },
    workspace: { findFirst: vi.fn() },
    workspaceApp: { create: vi.fn() },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
}));

vi.mock("@/lib/upstash", () => ({
  enqueueMessage: vi.fn().mockResolvedValue({}),
}));

describe("apps-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateAppName", () => {
    it("returns a string in adj-noun-verb format", () => {
      const name = generateAppName();
      expect(typeof name).toBe("string");
      expect(name.split("-")).toHaveLength(3);
    });
  });

  describe("generateSlug", () => {
    it("returns a slug based on app name with suffix", () => {
      const slug = generateSlug();
      expect(typeof slug).toBe("string");
      expect(slug.split("-")).toHaveLength(4);
    });
  });

  describe("mapMonetizationModelToEnum", () => {
    it("maps correctly", () => {
      expect(mapMonetizationModelToEnum("subscription")).toBe("SUBSCRIPTION");
      expect(mapMonetizationModelToEnum("free")).toBe("FREE");
      expect(mapMonetizationModelToEnum("unknown")).toBe("FREE");
    });
  });

  describe("ensureUserExists", () => {
    it("returns existing user id if found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as unknown as Awaited<
        ReturnType<typeof prisma.user.findUnique>
      >);
      const result = await ensureUserExists({ user: { id: "user-1" } });
      expect(result).toEqual({ success: true, userId: "user-1" });
    });

    it("creates new user if not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-1" } as unknown as Awaited<
        ReturnType<typeof prisma.user.create>
      >);
      const result = await ensureUserExists({
        user: { id: "user-1", email: "test@test.com" },
      });
      expect(result).toEqual({ success: true, userId: "user-1" });
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });

  describe("getApps", () => {
    it("fetches curated apps", async () => {
      vi.mocked(prisma.app.findMany).mockResolvedValue([]);
      const result = await getApps("user-1", true);
      expect(result.status).toBe(200);
      expect(prisma.app.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isCurated: true }),
        }),
      );
    });

    it("fetches user apps", async () => {
      vi.mocked(prisma.app.findMany).mockResolvedValue([]);
      const result = await getApps("user-1", false);
      expect(result.status).toBe(200);
      expect(prisma.app.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "user-1" }),
        }),
      );
    });
  });

  describe("createAppFromPrompt", () => {
    it("handles duplicate app name", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        userId: "user-1",
        deletedAt: null,
      } as unknown as Awaited<ReturnType<typeof prisma.app.findFirst>>);
      const result = await createAppFromPrompt("user-1", { prompt: "test" });
      expect(result.status).toBe(409);
      expect(result.error).toContain("already have an app with this name");
    });

    it("creates app successfully", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.app.create).mockResolvedValue({
        id: "app-1",
        name: "Test",
      } as unknown as Awaited<ReturnType<typeof prisma.app.create>>);
      vi.mocked(prisma.appMessage.create).mockResolvedValue({ id: "msg-1" } as unknown as Awaited<
        ReturnType<typeof prisma.appMessage.create>
      >);
      const result = await createAppFromPrompt("user-1", { prompt: "test" });
      expect(result.status).toBe(201);
      expect(result.data).toBeDefined();
    });
  });
});
