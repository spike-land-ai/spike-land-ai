import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  generatedRoute: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { getOrCreateRoute, getRouteBySlug, incrementViewCount, isRouteCached } from "./route-cache";

describe("route-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRouteBySlug", () => {
    it("returns route when found", async () => {
      const route = { id: "1", slug: "test/route", status: "PUBLISHED" };
      mockPrisma.generatedRoute.findUnique.mockResolvedValue(route);

      const result = await getRouteBySlug("test/route");
      expect(result).toEqual(route);
    });

    it("returns null when not found", async () => {
      mockPrisma.generatedRoute.findUnique.mockResolvedValue(null);
      const result = await getRouteBySlug("missing");
      expect(result).toBeNull();
    });
  });

  describe("isRouteCached", () => {
    it("returns true for PUBLISHED routes", async () => {
      mockPrisma.generatedRoute.findUnique.mockResolvedValue({
        status: "PUBLISHED",
      });
      expect(await isRouteCached("test")).toBe(true);
    });

    it("returns false for non-PUBLISHED routes", async () => {
      mockPrisma.generatedRoute.findUnique.mockResolvedValue({
        status: "CODING",
      });
      expect(await isRouteCached("test")).toBe(false);
    });

    it("returns false when route doesn't exist", async () => {
      mockPrisma.generatedRoute.findUnique.mockResolvedValue(null);
      expect(await isRouteCached("test")).toBe(false);
    });
  });

  describe("getOrCreateRoute", () => {
    it("returns existing route", async () => {
      const route = { id: "1", slug: "test", status: "NEW" };
      mockPrisma.generatedRoute.findUnique.mockResolvedValue(route);

      const result = await getOrCreateRoute("test", "/test");
      expect(result).toEqual(route);
      expect(mockPrisma.generatedRoute.create).not.toHaveBeenCalled();
    });

    it("creates new route when not found", async () => {
      mockPrisma.generatedRoute.findUnique.mockResolvedValue(null);
      mockPrisma.generatedRoute.create.mockResolvedValue({
        id: "new",
        slug: "test",
        status: "NEW",
      });

      await getOrCreateRoute("test", "/test");
      expect(mockPrisma.generatedRoute.create).toHaveBeenCalled();
    });

    it("validates userId before creating", async () => {
      mockPrisma.generatedRoute.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      mockPrisma.generatedRoute.create.mockResolvedValue({
        id: "new",
        slug: "test",
        status: "NEW",
      });

      await getOrCreateRoute("test", "/test", "user-1");
      expect(mockPrisma.generatedRoute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ requestedById: "user-1" }),
        }),
      );
    });
  });

  describe("incrementViewCount", () => {
    it("increments view count", async () => {
      mockPrisma.generatedRoute.update.mockResolvedValue({});
      await incrementViewCount("test");
      expect(mockPrisma.generatedRoute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: "test" },
          data: { viewCount: { increment: 1 } },
        }),
      );
    });

    it("silently handles errors", async () => {
      mockPrisma.generatedRoute.update.mockRejectedValue(new Error("not found"));
      await expect(incrementViewCount("missing")).resolves.toBeUndefined();
    });
  });
});
