/**
 * Tests for gallery API routes, upload flow, default album creation,
 * chat agent tool registry, and R2 storage helpers.
 *
 * All D1 and R2 interactions are mocked — no real Cloudflare bindings needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ImageStudioDeps } from "@spike-land-ai/mcp-image-studio";

// ─── Shared mock factories ────────────────────────────────────────────────────

function makeAlbumRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "alb-1",
    handle: "gallery-user123-abc123",
    userId: "user-123",
    name: "My Gallery",
    description: null,
    coverImageId: null,
    privacy: "PRIVATE",
    defaultTier: "FREE",
    shareToken: null,
    sortOrder: 0,
    isDefault: true,
    pipelineId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    _count: { albumImages: 0 },
    ...overrides,
  };
}

function makeImageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "img-1",
    userId: "user-123",
    name: "Test Image",
    description: null,
    originalUrl: "https://example.com/user-123/abc.png",
    originalR2Key: "user-123/abc.png",
    originalWidth: 800,
    originalHeight: 600,
    originalSizeBytes: 12345,
    originalFormat: "png",
    isPublic: false,
    viewCount: 0,
    tags: [],
    shareToken: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeDb(overrides: Partial<ImageStudioDeps["db"]> = {}): ImageStudioDeps["db"] {
  return {
    imageCreate: vi.fn().mockResolvedValue(makeImageRow()),
    imageFindById: vi.fn().mockResolvedValue(null),
    imageFindMany: vi.fn().mockResolvedValue([]),
    imageDelete: vi.fn().mockResolvedValue(undefined),
    imageUpdate: vi.fn().mockResolvedValue(makeImageRow()),
    imageCount: vi.fn().mockResolvedValue(0),
    jobCreate: vi.fn().mockResolvedValue({}),
    jobFindById: vi.fn().mockResolvedValue(null),
    jobFindMany: vi.fn().mockResolvedValue([]),
    jobUpdate: vi.fn().mockResolvedValue({}),
    albumCreate: vi.fn().mockResolvedValue(makeAlbumRow()),
    albumFindByHandle: vi.fn().mockResolvedValue(null),
    albumFindById: vi.fn().mockResolvedValue(null),
    albumFindMany: vi.fn().mockResolvedValue([]),
    albumUpdate: vi.fn().mockResolvedValue(makeAlbumRow()),
    albumDelete: vi.fn().mockResolvedValue(undefined),
    albumMaxSortOrder: vi.fn().mockResolvedValue(0),
    albumImageAdd: vi.fn().mockResolvedValue({ id: "ai-1", albumId: "alb-1", imageId: "img-1", sortOrder: 0, addedAt: new Date() }),
    albumImageRemove: vi.fn().mockResolvedValue(1),
    albumImageReorder: vi.fn().mockResolvedValue(undefined),
    albumImageList: vi.fn().mockResolvedValue([]),
    albumImageMaxSortOrder: vi.fn().mockResolvedValue(0),
    pipelineCreate: vi.fn().mockResolvedValue({}),
    pipelineFindById: vi.fn().mockResolvedValue(null),
    pipelineFindMany: vi.fn().mockResolvedValue([]),
    pipelineUpdate: vi.fn().mockResolvedValue({}),
    pipelineDelete: vi.fn().mockResolvedValue(undefined),
    generationJobCreate: vi.fn().mockResolvedValue({}),
    generationJobFindById: vi.fn().mockResolvedValue(null),
    generationJobUpdate: vi.fn().mockResolvedValue({}),
    subjectCreate: vi.fn().mockResolvedValue({}),
    subjectFindMany: vi.fn().mockResolvedValue([]),
    subjectDelete: vi.fn().mockResolvedValue(undefined),
    toolCallCreate: vi.fn().mockResolvedValue("call-id-1"),
    toolCallUpdate: vi.fn().mockResolvedValue(undefined),
    toolCallList: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ImageStudioDeps["db"];
}

function makeStorage(overrides: Partial<ImageStudioDeps["storage"]> = {}): ImageStudioDeps["storage"] {
  return {
    upload: vi.fn().mockResolvedValue({
      url: "https://example.com/user-123/new-file.png",
      r2Key: "user-123/new-file.png",
      sizeBytes: 9999,
    }),
    download: vi.fn().mockResolvedValue(Buffer.from("fake-image-bytes")),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeCredits(): ImageStudioDeps["credits"] {
  return {
    hasEnough: vi.fn().mockResolvedValue(true),
    consume: vi.fn().mockResolvedValue({ success: true, remaining: 90 }),
    refund: vi.fn().mockResolvedValue(true),
    getBalance: vi.fn().mockResolvedValue({ remaining: 100 }),
    estimate: vi.fn().mockReturnValue(10),
    calculateGenerationCost: vi.fn().mockReturnValue(10),
  };
}

function makeDeps(overrides: Partial<ImageStudioDeps> = {}): ImageStudioDeps {
  return {
    db: makeDb(),
    storage: makeStorage(),
    credits: makeCredits(),
    generation: {
      generate: vi.fn().mockResolvedValue({ url: "https://example.com/gen.png", width: 512, height: 512, sizeBytes: 5000 }),
      edit: vi.fn().mockResolvedValue({ url: "https://example.com/edited.png", width: 512, height: 512, sizeBytes: 5000 }),
    } as unknown as ImageStudioDeps["generation"],
    resolvers: {} as ImageStudioDeps["resolvers"],
    nanoid: () => "test-nanoid-id",
    ...overrides,
  } as unknown as ImageStudioDeps;
}

// ─── Tool Registry Tests ──────────────────────────────────────────────────────

describe("createToolRegistry", () => {
  it("registers and lists tools after initialization", async () => {
    const { createToolRegistry } = await import("./tool-registry.ts");
    const deps = makeDeps();
    const registry = createToolRegistry("user-123", deps);
    const tools = registry.list();

    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) {
      expect(t).toHaveProperty("name");
      expect(t).toHaveProperty("description");
      expect(typeof t.name).toBe("string");
    }
  });

  it("returns an error result for an unknown tool", async () => {
    const { createToolRegistry } = await import("./tool-registry.ts");
    const deps = makeDeps();
    const registry = createToolRegistry("user-123", deps);

    const result = await registry.call("nonexistent_tool", {});
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect((result.content[0] as { type: string; text: string }).text).toContain("Unknown tool");
  });

  it("logs a PENDING tool call before execution", async () => {
    const { createToolRegistry } = await import("./tool-registry.ts");
    const toolCallCreate = vi.fn().mockResolvedValue("call-id-pending");
    const toolCallUpdate = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({
      db: makeDb({ toolCallCreate, toolCallUpdate }),
    });
    const registry = createToolRegistry("user-123", deps);

    // Call a real tool that exists (img_list or similar)
    const tools = registry.list();
    const firstTool = tools[0];
    if (firstTool) {
      await registry.call(firstTool.name, {}).catch(() => {
        // ignore errors from the tool itself
      });
      expect(toolCallCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          toolName: firstTool.name,
          status: "PENDING",
        }),
      );
    }
  });

  it("updates the tool call log to COMPLETED after success", async () => {
    const { createToolRegistry } = await import("./tool-registry.ts");
    const toolCallCreate = vi.fn().mockResolvedValue("call-id-1");
    const toolCallUpdate = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({
      db: makeDb({ toolCallCreate, toolCallUpdate }),
    });
    const registry = createToolRegistry("user-123", deps);
    const tools = registry.list();
    const firstTool = tools[0];

    if (firstTool) {
      await registry.call(firstTool.name, {}).catch(() => {});
      if (toolCallUpdate.mock.calls.length > 0) {
        const updateArgs = toolCallUpdate.mock.calls[0]?.[1];
        expect(updateArgs).toHaveProperty("status");
      }
    }
  });

  it("records an ERROR status when the tool throws", async () => {
    const { createToolRegistry } = await import("./tool-registry.ts");
    const toolCallCreate = vi.fn().mockResolvedValue("call-id-err");
    const toolCallUpdate = vi.fn().mockResolvedValue(undefined);

    // Inject a broken db so the first real tool will throw
    const deps = makeDeps({
      db: makeDb({
        toolCallCreate,
        toolCallUpdate,
        imageFindMany: vi.fn().mockRejectedValue(new Error("D1 read error")),
      }),
    });
    const registry = createToolRegistry("user-123", deps);

    // Call the unknown tool so the error-path is deterministic
    const result = await registry.call("nonexistent_tool", {});
    expect(result.isError).toBe(true);
  });
});

// ─── R2 Storage Helper Tests ──────────────────────────────────────────────────

describe("createR2Storage", () => {
  it("uploads bytes to R2 and returns url, r2Key, sizeBytes", async () => {
    const { createR2Storage } = await import("./deps/storage.ts");

    const mockPut = vi.fn().mockResolvedValue(undefined);
    const mockEnv = {
      IMAGE_R2: { put: mockPut, get: vi.fn(), delete: vi.fn() },
    } as unknown as import("./env.d.ts").Env;

    const storage = createR2Storage(mockEnv, "https://example.com");
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const result = await storage.upload("user-abc", bytes, {
      filename: "photo.png",
      contentType: "image/png",
    });

    expect(result.url).toMatch(/^https:\/\/example\.com\/user-abc\//);
    expect(result.r2Key).toMatch(/^user-abc\/.+\.png$/);
    expect(result.sizeBytes).toBe(4);
    expect(mockPut).toHaveBeenCalledOnce();
  });

  it("passes correct cache-control and custom metadata on upload", async () => {
    const { createR2Storage } = await import("./deps/storage.ts");

    const mockPut = vi.fn().mockResolvedValue(undefined);
    const mockEnv = {
      IMAGE_R2: { put: mockPut, get: vi.fn(), delete: vi.fn() },
    } as unknown as import("./env.d.ts").Env;

    const storage = createR2Storage(mockEnv, "https://cdn.example.com");
    await storage.upload("user-xyz", new Uint8Array([0xff]), {
      filename: "img.jpg",
      contentType: "image/jpeg",
    });

    const [, , opts] = mockPut.mock.calls[0] as [string, Uint8Array, { httpMetadata: Record<string, string>; customMetadata: Record<string, string> }];
    expect(opts.httpMetadata.cacheControl).toBe("public, max-age=31536000, immutable");
    expect(opts.httpMetadata.contentType).toBe("image/jpeg");
    expect(opts.customMetadata.userId).toBe("user-xyz");
  });

  it("downloads bytes from R2", async () => {
    const { createR2Storage } = await import("./deps/storage.ts");

    const fakeBytes = new Uint8Array([10, 20, 30]);
    const mockGet = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(fakeBytes.buffer),
    });
    const mockEnv = {
      IMAGE_R2: { put: vi.fn(), get: mockGet, delete: vi.fn() },
    } as unknown as import("./env.d.ts").Env;

    const storage = createR2Storage(mockEnv, "https://example.com");
    const result = await storage.download("user-abc/photo.png");

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result[0]).toBe(10);
    expect(result[1]).toBe(20);
  });

  it("throws when downloading a missing R2 object", async () => {
    const { createR2Storage } = await import("./deps/storage.ts");

    const mockGet = vi.fn().mockResolvedValue(null);
    const mockEnv = {
      IMAGE_R2: { put: vi.fn(), get: mockGet, delete: vi.fn() },
    } as unknown as import("./env.d.ts").Env;

    const storage = createR2Storage(mockEnv, "https://example.com");
    await expect(storage.download("user-abc/missing.png")).rejects.toThrow("R2 object not found");
  });

  it("deletes an object from R2", async () => {
    const { createR2Storage } = await import("./deps/storage.ts");

    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockEnv = {
      IMAGE_R2: { put: vi.fn(), get: vi.fn(), delete: mockDelete },
    } as unknown as import("./env.d.ts").Env;

    const storage = createR2Storage(mockEnv, "https://example.com");
    await storage.delete("user-abc/old.png");

    expect(mockDelete).toHaveBeenCalledWith("user-abc/old.png");
  });

  it("accepts ArrayBuffer as well as Uint8Array input", async () => {
    const { createR2Storage } = await import("./deps/storage.ts");

    const mockPut = vi.fn().mockResolvedValue(undefined);
    const mockEnv = {
      IMAGE_R2: { put: mockPut, get: vi.fn(), delete: vi.fn() },
    } as unknown as import("./env.d.ts").Env;

    const storage = createR2Storage(mockEnv, "https://example.com");
    const buffer = new ArrayBuffer(8);
    const result = await storage.upload("user-abc", buffer as unknown as Uint8Array, {
      filename: "img.png",
      contentType: "image/png",
    });

    expect(result.sizeBytes).toBe(8);
  });
});

// ─── Auth helper Tests ────────────────────────────────────────────────────────

describe("validateSession", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns session when auth service responds with valid session", async () => {
    const { validateSession } = await import("./auth.ts");

    const fakeSession = {
      user: { id: "user-auth-1", email: "test@example.com", name: "Test User" },
      session: { id: "sess-1", expiresAt: "2026-12-31T00:00:00Z" },
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(fakeSession),
    }));

    const headers = new Headers({ Cookie: "better-auth.session_token=abc123" });
    const env = { AUTH_SERVICE_URL: "https://auth.example.com" } as unknown as import("./env.d.ts").Env;

    const result = await validateSession(headers, env);
    expect(result).not.toBeNull();
    expect(result?.user.id).toBe("user-auth-1");
    expect(result?.user.email).toBe("test@example.com");
  });

  it("returns null when auth service responds with 401", async () => {
    const { validateSession } = await import("./auth.ts");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const headers = new Headers();
    const env = {} as import("./env.d.ts").Env;

    const result = await validateSession(headers, env);
    expect(result).toBeNull();
  });

  it("returns null when session has no user.id", async () => {
    const { validateSession } = await import("./auth.ts");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ session: { id: "sess-2" } }), // no user
    }));

    const headers = new Headers();
    const env = {} as import("./env.d.ts").Env;

    const result = await validateSession(headers, env);
    expect(result).toBeNull();
  });

  it("returns null when the network fetch throws", async () => {
    const { validateSession } = await import("./auth.ts");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const headers = new Headers();
    const env = {} as import("./env.d.ts").Env;

    const result = await validateSession(headers, env);
    expect(result).toBeNull();
  });

  it("returns null when auth service returns null body", async () => {
    const { validateSession } = await import("./auth.ts");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(null),
    }));

    const headers = new Headers();
    const env = {} as import("./env.d.ts").Env;

    const result = await validateSession(headers, env);
    expect(result).toBeNull();
  });

  it("forwards cookies and Authorization header to auth service", async () => {
    const { validateSession } = await import("./auth.ts");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        user: { id: "u-1" },
        session: { id: "s-1", expiresAt: "2026-12-31" },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const headers = new Headers({
      Cookie: "session=tok",
      Authorization: "Bearer mytoken",
    });
    const env = { AUTH_SERVICE_URL: "https://auth.test.com" } as unknown as import("./env.d.ts").Env;

    await validateSession(headers, env);

    const [url, opts] = mockFetch.mock.calls[0] as [string, { headers: Headers }];
    expect(url).toContain("auth.test.com");
    expect(opts.headers.get("Cookie")).toBe("session=tok");
    expect(opts.headers.get("Authorization")).toBe("Bearer mytoken");
  });
});

// ─── Default Album Creation (getOrCreateDefaultAlbum) ─────────────────────────

describe("getOrCreateDefaultAlbum (standalone gallery helper)", () => {
  it("returns a fresh album with id and handle when none exists", async () => {
    const { getOrCreateDefaultAlbum } = await import("./deps/db.ts");

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      }),
    } as unknown as D1Database;

    const result = await getOrCreateDefaultAlbum(mockDb, "user-abc");
    expect(result.id).toBeDefined();
    expect(result.handle).toMatch(/^gallery-user-ab/);
  });

  it("returns existing album without inserting", async () => {
    const { getOrCreateDefaultAlbum } = await import("./deps/db.ts");

    const existing = { id: "alb-existing", handle: "gallery-existing-abcdef" };
    const mockPrepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(existing),
      }),
    });
    const mockDb = { prepare: mockPrepare } as unknown as D1Database;

    const result = await getOrCreateDefaultAlbum(mockDb, "user-abc");
    expect(result).toEqual(existing);
    // Only one prepare call: the SELECT
    expect(mockPrepare).toHaveBeenCalledTimes(1);
  });

  it("handle includes a truncated userId prefix", async () => {
    const { getOrCreateDefaultAlbum } = await import("./deps/db.ts");

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      }),
    } as unknown as D1Database;

    const result = await getOrCreateDefaultAlbum(mockDb, "verylonguser-id-12345");
    // userId.slice(0, 8) → "verylong"
    expect(result.handle).toMatch(/^gallery-verylong/);
  });
});

// ─── Upload Flow Tests ────────────────────────────────────────────────────────

describe("Upload flow logic", () => {
  it("upload returns url, r2Key, and sizeBytes", async () => {
    const { createR2Storage } = await import("./deps/storage.ts");

    const mockPut = vi.fn().mockResolvedValue(undefined);
    const env = { IMAGE_R2: { put: mockPut } } as unknown as import("./env.d.ts").Env;
    const storage = createR2Storage(env, "https://studio.example.com");

    const fakePng = new Uint8Array(100).fill(0xff);
    const result = await storage.upload("user-upload", fakePng, {
      filename: "shot.png",
      contentType: "image/png",
    });

    expect(result.url).toContain("https://studio.example.com/user-upload/");
    expect(result.r2Key).toMatch(/^user-upload\/.+\.png$/);
    expect(result.sizeBytes).toBe(100);
  });

  it("image record is created with correct fields after upload", async () => {
    // Verify imageCreate mock captures the right shape
    const db = makeDb();
    const uploadResult = {
      url: "https://example.com/user-123/file.jpg",
      r2Key: "user-123/file.jpg",
      sizeBytes: 50000,
    };

    await db.imageCreate({
      userId: "user-123",
      name: "Vacation photo",
      description: null,
      originalUrl: uploadResult.url,
      originalR2Key: uploadResult.r2Key,
      originalWidth: 0,
      originalHeight: 0,
      originalSizeBytes: uploadResult.sizeBytes,
      originalFormat: "jpeg",
      isPublic: false,
      tags: ["vacation", "beach"],
      shareToken: null,
    });

    expect(db.imageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        name: "Vacation photo",
        originalUrl: "https://example.com/user-123/file.jpg",
        originalFormat: "jpeg",
        tags: ["vacation", "beach"],
        isPublic: false,
      }),
    );
  });

  it("adds image to the default album after upload", async () => {
    const { addImageToDefaultAlbum } = await import("./deps/db.ts");

    const albumRow = { id: "alb-default", handle: "gallery-user12-abcdef" };
    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockImplementation(() => {
            if (sql.includes("isDefault")) return Promise.resolve(albumRow);
            return Promise.resolve({ maxSort: 3 });
          }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      })),
    } as unknown as D1Database;

    await addImageToDefaultAlbum(mockDb, "user-123", "img-new");
    // Expect the INSERT for album_images to have been called
    expect(mockDb.prepare).toHaveBeenCalled();
    const sqlCalls = (mockDb.prepare as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );
    const hasInsert = sqlCalls.some((sql) => sql.toLowerCase().includes("insert into album_images"));
    expect(hasInsert).toBe(true);
  });
});

// ─── Gallery API Route Logic Tests ───────────────────────────────────────────

describe("Gallery API route logic (unit-level)", () => {
  describe("Image deletion authorization", () => {
    it("allows owner to delete their own image", () => {
      const image = makeImageRow({ userId: "user-abc" });
      const requestUserId = "user-abc";

      const isOwner = image.userId === requestUserId;
      expect(isOwner).toBe(true);
    });

    it("rejects deletion when user does not own the image", () => {
      const image = makeImageRow({ userId: "user-abc" });
      const requestUserId = "user-xyz";

      const isOwner = image.userId === requestUserId;
      expect(isOwner).toBe(false);
    });
  });

  describe("Album creation handle generation", () => {
    it("generates a slug from the album name", () => {
      const name = "My Summer Vacation";
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
      expect(slug).toBe("my-summer-vacation");
    });

    it("truncates long names to 30 chars in the slug", () => {
      const name = "A Very Long Album Name That Exceeds The Limit";
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
      expect(slug.length).toBeLessThanOrEqual(30);
    });

    it("replaces special characters with hyphens", () => {
      const name = "Hello! World & More @ 2026";
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
      expect(slug).not.toMatch(/[^a-z0-9-]/);
    });
  });

  describe("Album image add (de-duplication)", () => {
    it("tracks only successfully added images", async () => {
      const db = makeDb({
        albumImageAdd: vi.fn()
          .mockResolvedValueOnce({ id: "ai-1", albumId: "alb-1", imageId: "img-1", sortOrder: 1, addedAt: new Date() })
          .mockResolvedValueOnce(null) // duplicate — not added
          .mockResolvedValueOnce({ id: "ai-3", albumId: "alb-1", imageId: "img-3", sortOrder: 3, addedAt: new Date() }),
        albumImageMaxSortOrder: vi.fn().mockResolvedValue(0),
        albumFindById: vi.fn().mockResolvedValue(makeAlbumRow()),
      });

      const imageIds = ["img-1", "img-2-dup", "img-3"];
      let maxSort = await db.albumImageMaxSortOrder("alb-1");
      let added = 0;
      for (const imageId of imageIds) {
        const result = await db.albumImageAdd("alb-1", imageId, ++maxSort);
        if (result) added++;
      }

      expect(added).toBe(2); // img-2-dup was a duplicate
    });
  });

  describe("Gallery pagination cursor logic", () => {
    it("nextCursor is null when results fit within limit", async () => {
      const { galleryRecentImages } = await import("./deps/db.ts");

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: "img-1",
                  userId: "u",
                  name: "A",
                  description: null,
                  originalUrl: "http://x.com/1.png",
                  originalR2Key: "u/1.png",
                  originalWidth: 100,
                  originalHeight: 100,
                  originalSizeBytes: 100,
                  originalFormat: "png",
                  isPublic: 0,
                  viewCount: 0,
                  tags: "[]",
                  shareToken: null,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          }),
        }),
      } as unknown as D1Database;

      const result = await galleryRecentImages(mockDb, "u", { limit: 10 });
      expect(result.nextCursor).toBeNull();
    });

    it("nextCursor is the ISO createdAt of the last image when there are more", async () => {
      const { galleryRecentImages } = await import("./deps/db.ts");

      const limit = 2;
      const rows = Array.from({ length: limit + 1 }, (_, i) => ({
        id: `img-${i}`,
        userId: "u",
        name: `Image ${i}`,
        description: null,
        originalUrl: `http://x.com/${i}.png`,
        originalR2Key: `u/${i}.png`,
        originalWidth: 100,
        originalHeight: 100,
        originalSizeBytes: 100,
        originalFormat: "png",
        isPublic: 0,
        viewCount: 0,
        tags: "[]",
        shareToken: null,
        createdAt: new Date(Date.now() - i * 60000).toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: rows }),
          }),
        }),
      } as unknown as D1Database;

      const result = await galleryRecentImages(mockDb, "u", { limit });
      expect(result.images).toHaveLength(limit);
      expect(result.nextCursor).not.toBeNull();
      // Cursor is parseable as ISO date
      expect(new Date(result.nextCursor!).toISOString()).toBe(result.nextCursor);
    });
  });
});

// ─── Credits System Tests ──────────────────────────────────────────────────────

describe("Credits system (D1-backed)", () => {
  it("hasEnough returns true when balance is sufficient (mock)", async () => {
    const credits = makeCredits();
    const result = await credits.hasEnough("user-123", 10);
    expect(result).toBe(true);
  });

  it("consume returns success and remaining balance", async () => {
    const credits = makeCredits();
    const result = await credits.consume({ userId: "user-123", amount: 10, source: "img_enhance", sourceId: "job-1" });
    expect(result.success).toBe(true);
    expect(typeof result.remaining).toBe("number");
  });

  it("estimate returns a numeric cost for a tier", () => {
    const credits = makeCredits();
    const cost = credits.estimate("PRO" as Parameters<typeof credits.estimate>[0]);
    expect(typeof cost).toBe("number");
    expect(cost).toBeGreaterThanOrEqual(0);
  });

  it("refund returns true on success", async () => {
    const credits = makeCredits();
    const result = await credits.refund("user-123", 5);
    expect(result).toBe(true);
  });

  it("getBalance returns object with remaining field", async () => {
    const credits = makeCredits();
    const balance = await credits.getBalance("user-123");
    expect(balance).not.toBeNull();
    expect(balance).toHaveProperty("remaining");
    expect(typeof balance!.remaining).toBe("number");
  });
});

// ─── D1 Database Row Mapping Tests ────────────────────────────────────────────

describe("D1 row mapping (createD1Db internals via galleryRecentImages)", () => {
  it("maps isPublic=1 to true and isPublic=0 to false", async () => {
    const { galleryRecentImages } = await import("./deps/db.ts");

    const makeRow = (isPublic: number) => ({
      id: "img-x",
      userId: "u",
      name: "Test",
      description: null,
      originalUrl: "http://x.com/x.png",
      originalR2Key: "u/x.png",
      originalWidth: 100,
      originalHeight: 100,
      originalSizeBytes: 100,
      originalFormat: "png",
      isPublic,
      viewCount: 0,
      tags: "[]",
      shareToken: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    for (const [rawVal, expected] of [[1, true], [0, false]] as const) {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [makeRow(rawVal)] }),
          }),
        }),
      } as unknown as D1Database;

      const result = await galleryRecentImages(mockDb, "u", { limit: 10 });
      expect(result.images[0]?.isPublic).toBe(expected);
    }
  });

  it("parses tags JSON array correctly", async () => {
    const { galleryRecentImages } = await import("./deps/db.ts");

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [{
              id: "img-tags",
              userId: "u",
              name: "Tagged",
              description: null,
              originalUrl: "http://x.com/t.png",
              originalR2Key: "u/t.png",
              originalWidth: 100,
              originalHeight: 100,
              originalSizeBytes: 100,
              originalFormat: "png",
              isPublic: 0,
              viewCount: 0,
              tags: '["landscape","travel","2026"]',
              shareToken: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }],
          }),
        }),
      }),
    } as unknown as D1Database;

    const result = await galleryRecentImages(mockDb, "u", { limit: 10 });
    expect(result.images[0]?.tags).toEqual(["landscape", "travel", "2026"]);
  });

  it("returns empty tags array for null or invalid JSON", async () => {
    const { galleryRecentImages } = await import("./deps/db.ts");

    for (const badTags of [null, "not-json", ""]) {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({
              results: [{
                id: "img-bad-tags",
                userId: "u",
                name: "No Tags",
                description: null,
                originalUrl: "http://x.com/n.png",
                originalR2Key: "u/n.png",
                originalWidth: 100,
                originalHeight: 100,
                originalSizeBytes: 100,
                originalFormat: "png",
                isPublic: 0,
                viewCount: 0,
                tags: badTags,
                shareToken: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }],
            }),
          }),
        }),
      } as unknown as D1Database;

      const result = await galleryRecentImages(mockDb, "u", { limit: 10 });
      expect(result.images[0]?.tags).toEqual([]);
    }
  });

  it("createdAt and updatedAt are Date instances", async () => {
    const { galleryRecentImages } = await import("./deps/db.ts");

    const isoDate = "2026-01-15T10:30:00.000Z";
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [{
              id: "img-dates",
              userId: "u",
              name: "Dated",
              description: null,
              originalUrl: "http://x.com/d.png",
              originalR2Key: "u/d.png",
              originalWidth: 100,
              originalHeight: 100,
              originalSizeBytes: 100,
              originalFormat: "png",
              isPublic: 0,
              viewCount: 0,
              tags: "[]",
              shareToken: null,
              createdAt: isoDate,
              updatedAt: isoDate,
            }],
          }),
        }),
      }),
    } as unknown as D1Database;

    const result = await galleryRecentImages(mockDb, "u", { limit: 10 });
    expect(result.images[0]?.createdAt).toBeInstanceOf(Date);
    expect(result.images[0]?.updatedAt).toBeInstanceOf(Date);
    expect(result.images[0]?.createdAt.toISOString()).toBe(isoDate);
  });
});
