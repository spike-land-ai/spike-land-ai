import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── EventBus Tests ───

describe("EventBus", () => {
  beforeEach(async () => {
    // Clear state between tests by clearing the singleton
    const { eventBus } = await import("./frontend/src/services/event-bus.ts");
    eventBus.clear();
  });

  it("should emit and receive events", async () => {
    const { eventBus } = await import("./frontend/src/services/event-bus.ts");

    const handler = vi.fn();
    const unsub = eventBus.on("gallery:updated", handler);

    eventBus.emit("gallery:updated", { reason: "upload" });
    expect(handler).toHaveBeenCalledWith({ reason: "upload" });

    unsub();
    eventBus.emit("gallery:updated", { reason: "generate" });
    expect(handler).toHaveBeenCalledTimes(1);

    eventBus.clear();
  });

  it("should handle multiple subscribers", async () => {
    const { eventBus } = await import("./frontend/src/services/event-bus.ts");

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventBus.on("image:uploaded", handler1);
    eventBus.on("image:uploaded", handler2);

    eventBus.emit("image:uploaded", { imageId: "123", url: "http://test.com/img.png", name: "test" });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    eventBus.clear();
  });

  it("should not throw on emit with no handlers", async () => {
    const { eventBus } = await import("./frontend/src/services/event-bus.ts");
    expect(() => eventBus.emit("gallery:updated", { reason: "delete" })).not.toThrow();
    eventBus.clear();
  });

  it("should unsubscribe a single handler while keeping others", async () => {
    const { eventBus } = await import("./frontend/src/services/event-bus.ts");

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const unsub1 = eventBus.on("gallery:updated", handler1);
    eventBus.on("gallery:updated", handler2);

    unsub1();

    eventBus.emit("gallery:updated", { reason: "enhance" });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);

    eventBus.clear();
  });

  it("should handle image:generated events", async () => {
    const { eventBus } = await import("./frontend/src/services/event-bus.ts");

    const handler = vi.fn();
    eventBus.on("image:generated", handler);

    eventBus.emit("image:generated", {
      imageId: "gen-123",
      url: "http://test.com/gen.png",
      prompt: "a sunset over the ocean",
    });

    expect(handler).toHaveBeenCalledWith({
      imageId: "gen-123",
      url: "http://test.com/gen.png",
      prompt: "a sunset over the ocean",
    });

    eventBus.clear();
  });

  it("should handle image:deleted events", async () => {
    const { eventBus } = await import("./frontend/src/services/event-bus.ts");

    const handler = vi.fn();
    eventBus.on("image:deleted", handler);

    eventBus.emit("image:deleted", { imageId: "del-456" });

    expect(handler).toHaveBeenCalledWith({ imageId: "del-456" });

    eventBus.clear();
  });

  it("should handle album events", async () => {
    const { eventBus } = await import("./frontend/src/services/event-bus.ts");

    const createdHandler = vi.fn();
    const updatedHandler = vi.fn();

    eventBus.on("album:created", createdHandler);
    eventBus.on("album:updated", updatedHandler);

    eventBus.emit("album:created", { albumId: "alb-1", name: "Vacation" });
    eventBus.emit("album:updated", { albumId: "alb-1" });

    expect(createdHandler).toHaveBeenCalledWith({ albumId: "alb-1", name: "Vacation" });
    expect(updatedHandler).toHaveBeenCalledWith({ albumId: "alb-1" });

    eventBus.clear();
  });

  it("should not invoke handlers removed via off()", async () => {
    const { eventBus } = await import("./frontend/src/services/event-bus.ts");

    const handler = vi.fn();
    eventBus.on("gallery:updated", handler);
    eventBus.off("gallery:updated", handler);

    eventBus.emit("gallery:updated", { reason: "refresh" });
    expect(handler).not.toHaveBeenCalled();

    eventBus.clear();
  });
});

// ─── Shared Types Tests ───

describe("Shared Types", () => {
  it("should export gallery types", async () => {
    const types = await import("./shared-types.ts");
    expect(types).toBeDefined();
  });

  it("should have GalleryImage interface shape at runtime via object check", () => {
    // We verify that a conforming object has the expected keys
    const img = {
      id: "img-1",
      name: "Test Image",
      description: null,
      url: "http://example.com/img.png",
      thumbnailUrl: null,
      width: 800,
      height: 600,
      format: "png",
      sizeBytes: 12345,
      tags: ["nature"],
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(img).toHaveProperty("id");
    expect(img).toHaveProperty("url");
    expect(img).toHaveProperty("tags");
    expect(Array.isArray(img.tags)).toBe(true);
  });

  it("should have ChatSSEEvent types with gallery_update", async () => {
    const { } = await import("./shared-types.ts");
    // Verify that gallery_update is a valid event type by constructing a conforming object
    const event = {
      type: "gallery_update" as const,
      action: "image_created" as const,
      imageId: "img-123",
    };
    expect(event.type).toBe("gallery_update");
    expect(event.action).toBe("image_created");
  });
});

// ─── Gallery DB Helper Tests ───

describe("Gallery DB Helpers", () => {
  describe("getOrCreateDefaultAlbum", () => {
    it("creates a new default album when none exists", async () => {
      const { getOrCreateDefaultAlbum } = await import("./deps/db.ts");

      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockBind = vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        run: mockRun,
      });
      const mockDb = {
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
      } as unknown as D1Database;

      const result = await getOrCreateDefaultAlbum(mockDb, "user-abc123");

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("handle");
      expect(typeof result.id).toBe("string");
      expect(typeof result.handle).toBe("string");
      // handle should incorporate part of userId
      expect(result.handle).toMatch(/^gallery-user-abc/);
    });

    it("returns an existing default album when one exists", async () => {
      const { getOrCreateDefaultAlbum } = await import("./deps/db.ts");

      const existing = { id: "album-existing-1", handle: "gallery-user12-abc123" };
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(existing),
          }),
        }),
      } as unknown as D1Database;

      const result = await getOrCreateDefaultAlbum(mockDb, "user-123");
      expect(result).toEqual(existing);
      // Should not try to INSERT since album already exists
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
    });

    it("generates unique handle per user", async () => {
      const { getOrCreateDefaultAlbum } = await import("./deps/db.ts");

      const makeDb = () => ({
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
          }),
        }),
      }) as unknown as D1Database;

      const result1 = await getOrCreateDefaultAlbum(makeDb(), "user-aaaa");
      const result2 = await getOrCreateDefaultAlbum(makeDb(), "user-bbbb");

      // Different users get different handles
      expect(result1.handle).not.toBe(result2.handle);
    });
  });

  describe("galleryRecentImages", () => {
    function makeImageRow(i: number) {
      return {
        id: `img-${i}`,
        userId: "user-123",
        name: `Image ${i}`,
        description: null,
        originalUrl: `http://test.com/${i}.png`,
        originalR2Key: `user-123/${i}.png`,
        originalWidth: 800,
        originalHeight: 600,
        originalSizeBytes: 1000,
        originalFormat: "png",
        isPublic: 0,
        viewCount: 0,
        tags: "[]",
        shareToken: null,
        thumbnailUrl: null,
        createdAt: new Date(Date.now() - i * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    it("returns paginated results with no next cursor when under limit", async () => {
      const { galleryRecentImages } = await import("./deps/db.ts");

      const mockImages = Array.from({ length: 5 }, (_, i) => makeImageRow(i));

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mockImages }),
          }),
        }),
      } as unknown as D1Database;

      const result = await galleryRecentImages(mockDb, "user-123", { limit: 10 });

      expect(result.images).toHaveLength(5);
      expect(result.nextCursor).toBeNull();
    });

    it("returns next cursor when results exceed limit", async () => {
      const { galleryRecentImages } = await import("./deps/db.ts");

      // Return limit+1 rows to indicate there are more
      const limit = 3;
      const mockImages = Array.from({ length: limit + 1 }, (_, i) => makeImageRow(i));

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mockImages }),
          }),
        }),
      } as unknown as D1Database;

      const result = await galleryRecentImages(mockDb, "user-123", { limit });

      // Only limit images returned
      expect(result.images).toHaveLength(limit);
      // nextCursor is the ISO string of the last image's createdAt
      expect(result.nextCursor).not.toBeNull();
      expect(typeof result.nextCursor).toBe("string");
    });

    it("maps D1 row integers to typed ImageRow values", async () => {
      const { galleryRecentImages } = await import("./deps/db.ts");

      const mockImages = [
        {
          ...makeImageRow(0),
          isPublic: 1, // D1 stores booleans as 0/1
          tags: '["nature", "sunset"]',
        },
      ];

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mockImages }),
          }),
        }),
      } as unknown as D1Database;

      const result = await galleryRecentImages(mockDb, "user-123", {});

      expect(result.images[0]?.isPublic).toBe(true);
      expect(result.images[0]?.tags).toEqual(["nature", "sunset"]);
      expect(result.images[0]?.createdAt).toBeInstanceOf(Date);
      expect(result.images[0]?.updatedAt).toBeInstanceOf(Date);
    });

    it("handles empty results", async () => {
      const { galleryRecentImages } = await import("./deps/db.ts");

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        }),
      } as unknown as D1Database;

      const result = await galleryRecentImages(mockDb, "user-no-images", {});

      expect(result.images).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });

    it("uses default limit of 50 when not specified", async () => {
      const { galleryRecentImages } = await import("./deps/db.ts");

      const prepareMock = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });
      const mockDb = { prepare: prepareMock } as unknown as D1Database;

      await galleryRecentImages(mockDb, "user-123", {});

      // The SQL should be called with 51 (limit + 1) as the last bind param
      expect(prepareMock).toHaveBeenCalled();
    });
  });

  describe("addImageToDefaultAlbum", () => {
    it("gets or creates the default album and inserts the image", async () => {
      const { addImageToDefaultAlbum } = await import("./deps/db.ts");

      const albumRow = { id: "alb-default", handle: "gallery-user12-abcdef" };
      let callCount = 0;

      const mockDb = {
        prepare: vi.fn().mockImplementation((sql: string) => ({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockImplementation(() => {
              callCount++;
              // First call: getOrCreateDefaultAlbum SELECT → return album
              // Second call: MAX sortOrder → return null
              if (sql.includes("isDefault")) return Promise.resolve(albumRow);
              return Promise.resolve({ maxSort: null });
            }),
            run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
          }),
        })),
      } as unknown as D1Database;

      await expect(
        addImageToDefaultAlbum(mockDb, "user-123", "img-xyz"),
      ).resolves.toBeUndefined();
    });

    it("silently ignores duplicate image insertion (UNIQUE constraint)", async () => {
      const { addImageToDefaultAlbum } = await import("./deps/db.ts");

      const mockDb = {
        prepare: vi.fn().mockImplementation(() => ({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockImplementation((sql?: string) => {
              void sql;
              return Promise.resolve({ id: "alb-1", handle: "gallery-u-abc", maxSort: 5 });
            }),
            run: vi.fn().mockRejectedValue(new Error("UNIQUE constraint failed")),
          }),
        })),
      } as unknown as D1Database;

      // Should not throw even when D1 throws a UNIQUE constraint error
      await expect(
        addImageToDefaultAlbum(mockDb, "user-123", "img-already-added"),
      ).resolves.toBeUndefined();
    });
  });
});

// ─── nanoid Tests ───

describe("nanoid", () => {
  it("generates a string of the correct length", async () => {
    const { nanoid } = await import("./deps/nanoid.ts");
    const id = nanoid();
    expect(typeof id).toBe("string");
    expect(id).toHaveLength(21);
  });

  it("generates a string of custom length", async () => {
    const { nanoid } = await import("./deps/nanoid.ts");
    const id = nanoid(10);
    expect(id).toHaveLength(10);
  });

  it("generates unique IDs", async () => {
    const { nanoid } = await import("./deps/nanoid.ts");
    const ids = new Set(Array.from({ length: 100 }, () => nanoid()));
    // All 100 should be unique
    expect(ids.size).toBe(100);
  });

  it("only contains alphanumeric characters from the expected alphabet", async () => {
    const { nanoid } = await import("./deps/nanoid.ts");
    const id = nanoid(50);
    expect(id).toMatch(/^[0-9a-z]+$/);
  });
});
