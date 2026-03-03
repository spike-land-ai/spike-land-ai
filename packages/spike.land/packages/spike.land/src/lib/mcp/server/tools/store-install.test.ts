import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  storeAppInstall: {
    upsert: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  },
}));

const mockRedis = vi.hoisted(() => ({
  incr: vi.fn().mockResolvedValue(1),
  decr: vi.fn().mockResolvedValue(0),
  get: vi.fn().mockResolvedValue(5),
  expire: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/upstash/client", () => ({ redis: mockRedis }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerStoreInstallTools } from "./store-install";

describe("store-install tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerStoreInstallTools(registry, userId);
  });

  it("should register 5 store-install tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("store_app_install")).toBe(true);
    expect(registry.handlers.has("store_app_uninstall")).toBe(true);
    expect(registry.handlers.has("store_app_install_status")).toBe(true);
    expect(registry.handlers.has("store_app_install_list")).toBe(true);
    expect(registry.handlers.has("store_app_install_count")).toBe(true);
  });

  describe("store_app_install", () => {
    it("should install an existing app and increment counter for new installs", async () => {
      // findUnique returns null = new install
      mockPrisma.storeAppInstall.findUnique.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(42);

      const handler = registry.handlers.get("store_app_install")!;
      const result = await handler({ slug: "codespace" });

      const text = getText(result);
      expect(text).toContain("Installed");
      expect(text).toContain("42");
      expect(mockPrisma.storeAppInstall.findUnique).toHaveBeenCalled();
      expect(mockRedis.incr).toHaveBeenCalledWith("install:count:codespace");
    });

    it("should NOT increment Redis counter on re-install", async () => {
      // findUnique returns existing record = re-install
      mockPrisma.storeAppInstall.findUnique.mockResolvedValue({
        appSlug: "codespace",
        userId: "test-user-123",
      });
      mockRedis.get.mockResolvedValue(10);

      const handler = registry.handlers.get("store_app_install")!;
      const result = await handler({ slug: "codespace" });

      const text = getText(result);
      expect(text).toContain("Installed");
      expect(text).toContain("10");
      expect(mockRedis.incr).not.toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalledWith("install:count:codespace");
    });

    it("should require authentication", async () => {
      const noAuthRegistry = createMockRegistry();
      registerStoreInstallTools(noAuthRegistry, "");

      const handler = noAuthRegistry.handlers.get("store_app_install")!;
      const result = await handler({ slug: "codespace" });

      const text = getText(result);
      expect(text).toContain("Authentication required");
    });

    it("should return not found for invalid slug", async () => {
      const handler = registry.handlers.get("store_app_install")!;
      const result = await handler({ slug: "nonexistent-app-xyz" });

      const text = getText(result);
      expect(text).toContain("not found");
    });

    it("should handle DB errors gracefully", async () => {
      mockPrisma.storeAppInstall.findUnique.mockRejectedValue(
        new Error("relation \"StoreAppInstall\" does not exist"),
      );

      const handler = registry.handlers.get("store_app_install")!;
      const result = await handler({ slug: "codespace" });

      const text = getText(result);
      expect(text).toContain("pending migration");
    });
  });

  describe("store_app_uninstall", () => {
    it("should uninstall an app", async () => {
      const handler = registry.handlers.get("store_app_uninstall")!;
      const result = await handler({ slug: "codespace" });

      const text = getText(result);
      expect(text).toContain("Uninstalled");
      expect(mockPrisma.storeAppInstall.deleteMany).toHaveBeenCalled();
      expect(mockRedis.decr).toHaveBeenCalledWith("install:count:codespace");
    });

    it("should require authentication", async () => {
      const noAuthRegistry = createMockRegistry();
      registerStoreInstallTools(noAuthRegistry, "");

      const handler = noAuthRegistry.handlers.get("store_app_uninstall")!;
      const result = await handler({ slug: "codespace" });

      const text = getText(result);
      expect(text).toContain("Authentication required");
    });

    it("should handle DB errors gracefully", async () => {
      mockPrisma.storeAppInstall.deleteMany.mockRejectedValue(
        new Error("relation \"StoreAppInstall\" does not exist"),
      );

      const handler = registry.handlers.get("store_app_uninstall")!;
      const result = await handler({ slug: "codespace" });

      const text = getText(result);
      expect(text).toContain("pending migration");
    });
  });

  describe("store_app_install_status", () => {
    it("should return count and installed status for known slug", async () => {
      mockRedis.get.mockResolvedValue(10);
      mockPrisma.storeAppInstall.findUnique.mockResolvedValue({ id: "1" });

      const handler = registry.handlers.get("store_app_install_status")!;
      const result = await handler({ slug: "codespace" });

      const text = getText(result);
      expect(text).toContain("10");
      expect(text).toContain("Yes");
    });

    it("should handle unauthenticated user (count only)", async () => {
      mockRedis.get.mockResolvedValue(7);

      const noAuthRegistry = createMockRegistry();
      registerStoreInstallTools(noAuthRegistry, "");

      const handler = noAuthRegistry.handlers.get("store_app_install_status")!;
      const result = await handler({ slug: "codespace" });

      const text = getText(result);
      expect(text).toContain("7");
      expect(text).not.toContain("Installed:");
    });

    it("should handle DB errors gracefully", async () => {
      mockRedis.get.mockRejectedValue(
        new Error("relation \"StoreAppInstall\" does not exist"),
      );

      const handler = registry.handlers.get("store_app_install_status")!;
      const result = await handler({ slug: "codespace" });

      const text = getText(result);
      expect(text).toContain("count unknown");
    });
  });

  describe("store_app_install_list", () => {
    it("should return list when items present", async () => {
      mockPrisma.storeAppInstall.findMany.mockResolvedValue([
        { appSlug: "codespace" },
      ]);

      const handler = registry.handlers.get("store_app_install_list")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Your Installed Apps");
      expect(text).toContain("codespace");
    });

    it("should show empty message when no installs", async () => {
      mockPrisma.storeAppInstall.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("store_app_install_list")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("No apps installed yet");
    });

    it("should require authentication", async () => {
      const noAuthRegistry = createMockRegistry();
      registerStoreInstallTools(noAuthRegistry, "");

      const handler = noAuthRegistry.handlers.get("store_app_install_list")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Authentication required");
    });

    it("should handle DB errors gracefully", async () => {
      mockPrisma.storeAppInstall.findMany.mockRejectedValue(
        new Error("relation \"StoreAppInstall\" does not exist"),
      );

      const handler = registry.handlers.get("store_app_install_list")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("pending migration");
    });
  });

  describe("store_app_install_count", () => {
    it("should return count from Redis", async () => {
      mockRedis.get.mockResolvedValue(99);

      const handler = registry.handlers.get("store_app_install_count")!;
      const result = await handler({ slug: "codespace" });

      const text = getText(result);
      expect(text).toContain("99");
      expect(text).toContain("codespace");
    });

    it("should return 0 on DB error", async () => {
      mockRedis.get.mockRejectedValue(
        new Error("no such table: install_count"),
      );

      const handler = registry.handlers.get("store_app_install_count")!;
      const result = await handler({ slug: "codespace" });

      const text = getText(result);
      expect(text).toContain("0");
    });
  });
});
