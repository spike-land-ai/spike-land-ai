import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  storeAppReview: {
    upsert: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
    aggregate: vi.fn().mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    }),
  },
  storeAppWishlist: {
    upsert: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
  },
  storeAppInstall: {
    findMany: vi.fn().mockResolvedValue([]),
  },
}));

const mockRedis = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(0),
  incr: vi.fn(),
  decr: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/upstash/client", () => ({ redis: mockRedis }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerStoreAppsTools } from "./store-apps";

describe("store-apps tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerStoreAppsTools(registry, userId);
  });

  it("should register 8 store-apps tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(8);
    expect(registry.handlers.has("store_app_rate")).toBe(true);
    expect(registry.handlers.has("store_app_reviews")).toBe(true);
    expect(registry.handlers.has("store_wishlist_add")).toBe(true);
    expect(registry.handlers.has("store_wishlist_remove")).toBe(true);
    expect(registry.handlers.has("store_wishlist_get")).toBe(true);
    expect(registry.handlers.has("store_recommendations_get")).toBe(true);
    expect(registry.handlers.has("store_app_personalized")).toBe(true);
    expect(registry.handlers.has("store_stats")).toBe(true);
  });

  describe("store_app_rate", () => {
    it("should rate an existing app", async () => {
      mockPrisma.storeAppReview.upsert.mockResolvedValue({});
      mockPrisma.storeAppReview.aggregate.mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { rating: 2 },
      });

      const handler = registry.handlers.get("store_app_rate")!;
      const result = await handler({ appSlug: "codespace", rating: 4 });

      const text = getText(result);
      expect(text).toContain("Rated");
      expect(text).toContain("4/5 stars");
      expect(text).toContain("4.5");
      expect(text).toContain("2 ratings");
    });

    it("should return not found for invalid slug", async () => {
      const handler = registry.handlers.get("store_app_rate")!;
      const result = await handler({
        appSlug: "nonexistent-app-xyz",
        rating: 3,
      });

      const text = getText(result);
      expect(text).toContain("not found");
    });

    it("should allow clearing review body with null (stored as empty string)", async () => {
      mockPrisma.storeAppReview.upsert.mockResolvedValue({});
      mockPrisma.storeAppReview.aggregate.mockResolvedValue({
        _avg: { rating: 3.0 },
        _count: { rating: 1 },
      });

      const handler = registry.handlers.get("store_app_rate")!;
      const result = await handler({ appSlug: "codespace", rating: 3, body: null });

      const text = getText(result);
      expect(text).toContain("Rated");
      // body: null ?? "" = "" — Prisma StoreAppReview.body is non-nullable String
      expect(mockPrisma.storeAppReview.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { rating: 3, body: "" },
          create: expect.objectContaining({ body: "" }),
        }),
      );
    });

    it("should always update body field on upsert (not conditionally)", async () => {
      mockPrisma.storeAppReview.upsert.mockResolvedValue({});
      mockPrisma.storeAppReview.aggregate.mockResolvedValue({
        _avg: { rating: 4.0 },
        _count: { rating: 1 },
      });

      const handler = registry.handlers.get("store_app_rate")!;
      await handler({ appSlug: "codespace", rating: 4 });

      // When body is omitted, body: undefined ?? "" = "" (non-nullable String in Prisma)
      expect(mockPrisma.storeAppReview.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { rating: 4, body: "" },
        }),
      );
    });

    it("should handle DB errors gracefully", async () => {
      mockPrisma.storeAppReview.upsert.mockRejectedValue(
        new Error("relation \"StoreAppReview\" does not exist"),
      );

      const handler = registry.handlers.get("store_app_rate")!;
      const result = await handler({ appSlug: "codespace", rating: 5 });

      const text = getText(result);
      expect(text).toContain("pending migration");
    });
  });

  describe("store_app_rate (no auth)", () => {
    it("should require authentication", async () => {
      const noAuthRegistry = createMockRegistry();
      registerStoreAppsTools(noAuthRegistry, "");

      const handler = noAuthRegistry.handlers.get("store_app_rate")!;
      const result = await handler({ appSlug: "codespace", rating: 4 });

      const text = getText(result);
      expect(text).toContain("Authentication required");
    });
  });

  describe("store_app_reviews", () => {
    it("should return reviews for an app", async () => {
      mockPrisma.storeAppReview.findMany.mockResolvedValue([
        { rating: 5, body: "Great app!", createdAt: new Date("2025-01-01") },
        { rating: 3, body: "Decent", createdAt: new Date("2025-01-02") },
      ]);

      const handler = registry.handlers.get("store_app_reviews")!;
      const result = await handler({ appSlug: "codespace", limit: 10 });

      const text = getText(result);
      expect(text).toContain("Reviews for");
      expect(text).toContain("5/5");
      expect(text).toContain("Great app!");
    });

    it("should return not found for invalid slug", async () => {
      const handler = registry.handlers.get("store_app_reviews")!;
      const result = await handler({
        appSlug: "nonexistent-app-xyz",
        limit: 10,
      });

      const text = getText(result);
      expect(text).toContain("not found");
    });

    it("should show empty message when no reviews", async () => {
      mockPrisma.storeAppReview.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("store_app_reviews")!;
      const result = await handler({ appSlug: "codespace", limit: 10 });

      const text = getText(result);
      expect(text).toContain("No reviews yet");
    });

    it("should handle DB errors gracefully", async () => {
      mockPrisma.storeAppReview.findMany.mockRejectedValue(
        new Error("relation \"StoreAppReview\" does not exist"),
      );

      const handler = registry.handlers.get("store_app_reviews")!;
      const result = await handler({ appSlug: "codespace", limit: 10 });

      const text = getText(result);
      expect(text).toContain("No reviews available");
    });
  });

  describe("store_wishlist_add", () => {
    it("should add app to wishlist", async () => {
      const handler = registry.handlers.get("store_wishlist_add")!;
      const result = await handler({ appSlug: "codespace" });

      const text = getText(result);
      expect(text).toContain("Added");
      expect(text).toContain("wishlist");
    });

    it("should return not found for invalid slug", async () => {
      const handler = registry.handlers.get("store_wishlist_add")!;
      const result = await handler({ appSlug: "nonexistent-app-xyz" });

      const text = getText(result);
      expect(text).toContain("not found");
    });

    it("should require authentication", async () => {
      const noAuthRegistry = createMockRegistry();
      registerStoreAppsTools(noAuthRegistry, "");

      const handler = noAuthRegistry.handlers.get("store_wishlist_add")!;
      const result = await handler({ appSlug: "codespace" });

      const text = getText(result);
      expect(text).toContain("Authentication required");
    });

    it("should handle DB errors gracefully", async () => {
      mockPrisma.storeAppWishlist.upsert.mockRejectedValue(
        new Error("relation \"StoreAppReview\" does not exist"),
      );

      const handler = registry.handlers.get("store_wishlist_add")!;
      const result = await handler({ appSlug: "codespace" });

      const text = getText(result);
      expect(text).toContain("pending migration");
    });
  });

  describe("store_wishlist_remove", () => {
    it("should remove app from wishlist", async () => {
      const handler = registry.handlers.get("store_wishlist_remove")!;
      const result = await handler({ appSlug: "codespace" });

      const text = getText(result);
      expect(text).toContain("Removed");
      expect(text).toContain("wishlist");
    });

    it("should require authentication", async () => {
      const noAuthRegistry = createMockRegistry();
      registerStoreAppsTools(noAuthRegistry, "");

      const handler = noAuthRegistry.handlers.get("store_wishlist_remove")!;
      const result = await handler({ appSlug: "codespace" });

      const text = getText(result);
      expect(text).toContain("Authentication required");
    });

    it("should handle DB errors gracefully", async () => {
      mockPrisma.storeAppWishlist.deleteMany.mockRejectedValue(
        new Error("relation \"StoreAppReview\" does not exist"),
      );

      const handler = registry.handlers.get("store_wishlist_remove")!;
      const result = await handler({ appSlug: "codespace" });

      const text = getText(result);
      expect(text).toContain("pending migration");
    });
  });

  describe("store_wishlist_get", () => {
    it("should return wishlisted apps", async () => {
      mockPrisma.storeAppWishlist.findMany.mockResolvedValue([
        { appSlug: "codespace" },
      ]);

      const handler = registry.handlers.get("store_wishlist_get")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Your Wishlist");
      expect(text).toContain("codespace");
    });

    it("should show empty message when no wishlist items", async () => {
      mockPrisma.storeAppWishlist.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("store_wishlist_get")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("empty");
    });

    it("should require authentication", async () => {
      const noAuthRegistry = createMockRegistry();
      registerStoreAppsTools(noAuthRegistry, "");

      const handler = noAuthRegistry.handlers.get("store_wishlist_get")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Authentication required");
    });

    it("should handle DB errors gracefully", async () => {
      mockPrisma.storeAppWishlist.findMany.mockRejectedValue(
        new Error("relation \"StoreAppReview\" does not exist"),
      );

      const handler = registry.handlers.get("store_wishlist_get")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("pending migration");
    });
  });

  describe("store_recommendations_get", () => {
    it("should return recommendations for an existing app", async () => {
      const handler = registry.handlers.get("store_recommendations_get")!;
      const result = await handler({ appSlug: "codespace", limit: 4 });

      const text = getText(result);
      expect(text).toContain("Recommended for");
    });

    it("should return not found for invalid slug", async () => {
      const handler = registry.handlers.get("store_recommendations_get")!;
      const result = await handler({
        appSlug: "nonexistent-app-xyz",
        limit: 4,
      });

      const text = getText(result);
      expect(text).toContain("not found");
    });

    it("should respect the limit parameter", async () => {
      const handler = registry.handlers.get("store_recommendations_get")!;
      const result = await handler({ appSlug: "codespace", limit: 2 });

      const text = getText(result);
      // Count the bullet points
      const bullets = text.match(/^- \*\*/gm);
      if (bullets) {
        expect(bullets.length).toBeLessThanOrEqual(2);
      }
    });

    it("should not recommend the same app", async () => {
      const handler = registry.handlers.get("store_recommendations_get")!;
      const result = await handler({ appSlug: "codespace", limit: 8 });

      const text = getText(result);
      // The recommendations should not include the target app itself in the list
      const lines = text.split("\n").filter(l => l.startsWith("- **"));
      for (const line of lines) {
        expect(line).not.toContain("Codespace");
      }
    });
  });

  describe("store_app_personalized", () => {
    it("should return apps for authenticated user", async () => {
      mockPrisma.storeAppInstall.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("store_app_personalized")!;
      const result = await handler({ limit: 4 });
      const text = getText(result);
      expect(text).toBeTruthy();
    });

    it("should show sign-in prompt for unauthenticated user", async () => {
      const noAuthRegistry = createMockRegistry();
      registerStoreAppsTools(noAuthRegistry, "");
      const handler = noAuthRegistry.handlers.get("store_app_personalized")!;
      const result = await handler({ limit: 4 });
      const text = getText(result);
      expect(text).toContain("Sign in");
    });
  });

  describe("store_stats", () => {
    it("should return store stats", async () => {
      const handler = registry.handlers.get("store_stats")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Store Stats");
      expect(text).toContain("Apps");
      expect(text).toContain("Tools");
      expect(text).toContain("Installs");
      expect(text).not.toContain("sample");
    });

    it("should query Redis for all apps, not just a sample", async () => {
      mockRedis.get.mockResolvedValue(10);
      const handler = registry.handlers.get("store_stats")!;
      await handler({});
      // Redis.get should be called once per app in STORE_APPS, not just 5
      const { STORE_APPS: apps } = await import("@/app/store/data/store-apps");
      expect(mockRedis.get).toHaveBeenCalledTimes(apps.length);
    });

    it("should handle Redis error gracefully", async () => {
      mockRedis.get.mockRejectedValue(new Error("Redis down"));
      const handler = registry.handlers.get("store_stats")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Store Stats");
    });
  });
});
