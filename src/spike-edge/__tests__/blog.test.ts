import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { blog, rowToPost, type BlogPostRow } from "../routes/blog.js";
import type { Env } from "../env.js";

// ---------- helpers ----------

function makeRow(overrides: Partial<BlogPostRow> = {}): BlogPostRow {
  return {
    slug: "test-post",
    title: "Test Post",
    description: "A test description",
    primer: "Short primer",
    date: "2026-03-01",
    author: "Test Author",
    category: "Testing",
    tags: '["vitest","hono"]',
    featured: 0,
    hero_image: null,
    content: "# Hello World\n\nSome content here.",
    created_at: 1709251200,
    updated_at: 1709251200,
    ...overrides,
  };
}

function makeR2Object(body: string, contentType = "image/png"): R2ObjectBody {
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode(body).buffer),
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
    blob: () => Promise.resolve(new Blob([body])),
    key: "blog-images/test/hero.png",
    version: "1",
    size: body.length,
    etag: "abc",
    httpEtag: '"abc"',
    checksums: { toJSON: () => ({}) } as unknown as R2Checksums,
    uploaded: new Date(),
    httpMetadata: { contentType },
    customMetadata: {},
    storageClass: "Standard" as R2StorageClass,
    writeHttpMetadata: () => {},
    range: undefined as unknown as R2Range,
  } as unknown as R2ObjectBody;
}

function createApp(envOverrides: Partial<Env> = {}) {
  const app = new Hono<{ Bindings: Env }>();

  // Minimal middleware to set env
  app.use("*", async (c, next) => {
    // Merge envOverrides into actual bindings (Hono reads c.env from bindings)
    Object.assign(c.env, envOverrides);
    await next();
  });

  app.route("/", blog);
  return app;
}

function mockDB(rows: BlogPostRow[], single?: BlogPostRow | null) {
  return {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({ results: rows }),
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(single ?? null),
      }),
    }),
  } as unknown as D1Database;
}

function mockR2(getResult: R2ObjectBody | null = null) {
  return {
    get: vi.fn().mockResolvedValue(getResult),
  } as unknown as R2Bucket;
}

// ---------- rowToPost unit tests ----------

describe("rowToPost", () => {
  it("parses tags JSON string into array", () => {
    const row = makeRow({ tags: '["a","b","c"]' });
    const post = rowToPost(row);
    expect(post.tags).toEqual(["a", "b", "c"]);
  });

  it("converts featured integer 1 to boolean true", () => {
    const row = makeRow({ featured: 1 });
    const post = rowToPost(row);
    expect(post.featured).toBe(true);
  });

  it("converts featured integer 0 to boolean false", () => {
    const row = makeRow({ featured: 0 });
    const post = rowToPost(row);
    expect(post.featured).toBe(false);
  });

  it("maps hero_image to heroImage", () => {
    const row = makeRow({ hero_image: "/blog/test/hero.png" });
    const post = rowToPost(row);
    expect(post.heroImage).toBe("/blog/test/hero.png");
    expect(post).not.toHaveProperty("hero_image");
  });

  it("sets heroImage to null when hero_image is null", () => {
    const row = makeRow({ hero_image: null });
    const post = rowToPost(row);
    expect(post.heroImage).toBeNull();
  });

  it("excludes content by default", () => {
    const row = makeRow({ content: "some content" });
    const post = rowToPost(row);
    expect(post).not.toHaveProperty("content");
  });

  it("includes content when includeContent is true", () => {
    const row = makeRow({ content: "some content" });
    const post = rowToPost(row, true);
    expect(post.content).toBe("some content");
  });

  it("includes all expected fields", () => {
    const row = makeRow();
    const post = rowToPost(row);
    expect(post).toHaveProperty("slug");
    expect(post).toHaveProperty("title");
    expect(post).toHaveProperty("description");
    expect(post).toHaveProperty("primer");
    expect(post).toHaveProperty("date");
    expect(post).toHaveProperty("author");
    expect(post).toHaveProperty("category");
    expect(post).toHaveProperty("tags");
    expect(post).toHaveProperty("featured");
    expect(post).toHaveProperty("heroImage");
  });
});

// ---------- GET /api/blog ----------

describe("GET /api/blog", () => {
  it("returns all posts sorted by date DESC", async () => {
    const rows = [
      makeRow({ slug: "newer", date: "2026-03-02" }),
      makeRow({ slug: "older", date: "2026-03-01" }),
    ];
    const db = mockDB(rows);
    const app = createApp({ DB: db, SPA_ASSETS: mockR2() });

    const res = await app.request("/api/blog", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].slug).toBe("newer");
    expect(body[1].slug).toBe("older");
  });

  it("returns posts without content field", async () => {
    const rows = [makeRow({ content: "should not appear" })];
    const db = mockDB(rows);

    const res = await app(db).request("/api/blog", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    const body = await res.json();
    expect(body[0]).not.toHaveProperty("content");
  });

  it("returns 404 when no posts exist", async () => {
    const db = mockDB([]);

    const res = await app(db).request("/api/blog", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    expect(res.status).toBe(404);
  });
});

function app(db: D1Database) {
  const testApp = new Hono<{ Bindings: Env }>();
  testApp.route("/", blog);
  return testApp;
}

// ---------- GET /api/blog/:slug ----------

describe("GET /api/blog/:slug", () => {
  it("returns full post with content for known slug", async () => {
    const row = makeRow({ slug: "my-post", content: "Full body content" });
    const db = mockDB([], row);
    const testApp = app(db);

    const res = await testApp.request("/api/blog/my-post", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("my-post");
    expect(body.content).toBe("Full body content");
  });

  it("returns 404 for unknown slug", async () => {
    const db = mockDB([], null);
    const testApp = app(db);

    const res = await testApp.request("/api/blog/nonexistent", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    expect(res.status).toBe(404);
  });
});

// ---------- GET /api/blog-images/:slug/:filename ----------

describe("GET /api/blog-images/:slug/:filename", () => {
  it("serves image from R2 with correct content type", async () => {
    const r2 = mockR2(makeR2Object("PNG_DATA", "image/png"));
    const testApp = app(mockDB([]));

    const res = await testApp.request(
      "/api/blog-images/test-post/hero.png",
      undefined,
      { DB: mockDB([]), SPA_ASSETS: r2 } as unknown as Env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    expect(r2.get).toHaveBeenCalledWith("blog-images/test-post/hero.png");
  });

  it("returns 404 for missing image", async () => {
    const r2 = mockR2(null);
    const testApp = app(mockDB([]));

    const res = await testApp.request(
      "/api/blog-images/test-post/missing.png",
      undefined,
      { DB: mockDB([]), SPA_ASSETS: r2 } as unknown as Env,
    );

    expect(res.status).toBe(404);
  });

  it("maps .jpg extension to image/jpeg", async () => {
    const r2 = mockR2(makeR2Object("JPG_DATA", "image/jpeg"));
    const testApp = app(mockDB([]));

    const res = await testApp.request(
      "/api/blog-images/test-post/photo.jpg",
      undefined,
      { DB: mockDB([]), SPA_ASSETS: r2 } as unknown as Env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });
});

// ---------- GET /blog/:slug/:filename (backward compat) ----------

describe("GET /blog/:slug/:filename (backward compat)", () => {
  it("serves image for known image extensions", async () => {
    const r2 = mockR2(makeR2Object("PNG_DATA"));
    const testApp = app(mockDB([]));

    const res = await testApp.request(
      "/blog/test-post/hero.png",
      undefined,
      { DB: mockDB([]), SPA_ASSETS: r2 } as unknown as Env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("falls through for non-image extensions", async () => {
    const r2 = mockR2(null);
    const testApp = app(mockDB([]));

    // .html is not in IMAGE_EXTS, should call next()
    const res = await testApp.request(
      "/blog/test-post/readme.html",
      undefined,
      { DB: mockDB([]), SPA_ASSETS: r2 } as unknown as Env,
    );

    // Falls through to 404 since there's no SPA catch-all
    expect(res.status).toBe(404);
    // R2 should NOT have been called
    expect(r2.get).not.toHaveBeenCalled();
  });

  it("falls through when R2 returns null for valid image extension", async () => {
    const r2 = mockR2(null);
    const testApp = app(mockDB([]));

    const res = await testApp.request(
      "/blog/test-post/missing.png",
      undefined,
      { DB: mockDB([]), SPA_ASSETS: r2 } as unknown as Env,
    );

    // Falls through via next()
    expect(res.status).toBe(404);
  });
});
