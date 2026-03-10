import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { blog, getBlogPostRow, rowToPost, type BlogPostRow } from "../routes/blog.js";
import { hashImagePrompt } from "../../../../core/block-website/core-logic/blog-image-policy.js";
import type { Env } from "../../core-logic/env.js";

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
    draft: 0,
    unlisted: 0,
    hero_image: null,
    hero_prompt: null,
    content: "# Hello World\n\nSome content here.",
    created_at: 1709251200,
    updated_at: 1709251200,
    ...overrides,
  };
}

function makeR2Object(
  body: string,
  contentType = "image/png",
  customMetadata: Record<string, string> = {},
): R2ObjectBody {
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
    customMetadata,
    storageClass: "Standard",
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
    put: vi.fn().mockResolvedValue(undefined),
  } as unknown as R2Bucket;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it("maps hero_prompt to heroPrompt", () => {
    const row = makeRow({ hero_prompt: "Wide cinematic architecture illustration" });
    const post = rowToPost(row);
    expect(post.heroPrompt).toBe("Wide cinematic architecture illustration");
    expect(post).not.toHaveProperty("hero_prompt");
  });

  it("infers heroPrompt from matching inline hero markdown when D1 is missing it", () => {
    const prompt = "A cinematic blueprint of an AI tool network";
    const row = makeRow({
      hero_image: "/blog/test-post/hero.png",
      hero_prompt: null,
      content: `![${prompt}](/blog/test-post/hero.png)\n\nBody content.`,
    });
    const post = rowToPost(row);
    expect(post.heroPrompt).toBe(prompt);
  });

  it("builds a stable fallback heroPrompt from post metadata when no explicit prompt exists", () => {
    const row = makeRow({
      title: "The Grandmother Neuron Fallacy",
      description: "Why deterministic tools become brittle inside LLM tool chains.",
      hero_image: "/blog/test-post/hero.png",
      hero_prompt: null,
      content: "Body content without image metadata.",
    });
    const post = rowToPost(row);
    expect(post.heroPrompt).toBe(
      "The Grandmother Neuron Fallacy. Why deterministic tools become brittle inside LLM tool chains.. Cinematic developer blog hero artwork.",
    );
  });

  it("converts unlisted integer 1 to boolean true", () => {
    const row = makeRow({ unlisted: 1 });
    const post = rowToPost(row);
    expect(post.unlisted).toBe(true);
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
    expect(post).toHaveProperty("heroPrompt");
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
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(2);
    expect(body[0]!.slug).toBe("newer");
    expect(body[1]!.slug).toBe("older");
    expect((db.prepare as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain(
      "unlisted = 0",
    );
  });

  it("returns posts without content field", async () => {
    const rows = [makeRow({ content: "should not appear" })];
    const db = mockDB(rows);

    const res = await app(db).request("/api/blog", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body[0]!).not.toHaveProperty("content");
  });

  it("returns inferred heroPrompt values for prompt-driven hero images", async () => {
    const prompt = "A futuristic control room for AI tooling";
    const rows = [
      makeRow({
        hero_image: "/blog/test-post/hero.png",
        hero_prompt: null,
        content: `![${prompt}](/blog/test-post/hero.png)\n\nBody content.`,
      }),
    ];
    const db = mockDB(rows);

    const res = await app(db).request("/api/blog", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body[0]!.heroPrompt).toBe(prompt);
  });

  it("recovers missing heroPrompt values from the canonical MDX source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `---
title: "Recovered Prompt Post"
slug: "test-post"
description: "Recovered description"
date: "2026-03-08"
author: "Fallback Author"
category: "Architecture"
tags: ["mcp"]
featured: false
heroImage: "/blog/test-post/hero.png"
heroPrompt: "Recovered cinematic prompt"
---

Body from source fallback.`,
          { status: 200, headers: { "Content-Type": "text/plain" } },
        ),
      ),
    );

    const rows = [
      makeRow({
        hero_image: "/blog/test-post/hero.png",
        hero_prompt: null,
        content: "Body content without the original hero markdown.",
      }),
    ];
    const db = mockDB(rows);

    const res = await app(db).request("/api/blog", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body[0]!.heroPrompt).toBe("Recovered cinematic prompt");
  });

  it("uses the canonical source prompt even when the stored hero image path is stale", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `---
title: "Recovered Prompt Post"
slug: "test-post"
description: "Recovered description"
date: "2026-03-08"
author: "Fallback Author"
category: "Architecture"
tags: ["mcp"]
featured: false
heroImage: "/blog/test-post/hero-v2.png"
heroPrompt: "Recovered cinematic prompt"
---

Body from source fallback.`,
          { status: 200, headers: { "Content-Type": "text/plain" } },
        ),
      ),
    );

    const rows = [
      makeRow({
        hero_image: "/blog/test-post/hero.png",
        hero_prompt: null,
        content: "Body content without the original hero markdown.",
      }),
    ];
    const db = mockDB(rows);

    const res = await app(db).request("/api/blog", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body[0]!.heroPrompt).toBe("Recovered cinematic prompt");
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

function app(_db: D1Database) {
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
    const body = (await res.json()) as Record<string, unknown>;
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

  it("falls back to the canonical MDX source when D1 misses the slug", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `---
title: "The Universal Interface Wasn't GraphQL"
slug: "the-universal-interface-wasnt-graphql"
description: "Fallback description"
date: "2026-03-08"
author: "Zoltan Erdos"
category: "Architecture"
tags: ["chat", "mcp"]
featured: true
primer: "Fallback primer"
heroImage: "/blog/the-universal-interface-wasnt-graphql/hero.png"
heroPrompt: "A sleek universal chat interface with glowing data streams"
unlisted: true
---

Body from source fallback.`,
          { status: 200, headers: { "Content-Type": "text/plain" } },
        ),
      ),
    );

    const db = mockDB([], null);
    const testApp = app(db);

    const res = await testApp.request(
      "/api/blog/the-universal-interface-wasnt-graphql",
      undefined,
      {
        DB: db,
        SPA_ASSETS: mockR2(),
      } as unknown as Env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.slug).toBe("the-universal-interface-wasnt-graphql");
    expect(body.title).toBe("The Universal Interface Wasn't GraphQL");
    expect(body.content).toBe("Body from source fallback.");
    expect(body.heroImage).toBe("/blog/the-universal-interface-wasnt-graphql/hero.png");
    expect(body.heroPrompt).toBe("A sleek universal chat interface with glowing data streams");
    expect(body.unlisted).toBe(true);
  });

  it("strips .mdx suffix from slug before querying", async () => {
    const row = makeRow({ slug: "my-post", content: "Full body content" });
    const db = mockDB([], row);
    const testApp = app(db);

    const res = await testApp.request("/api/blog/my-post.mdx", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.slug).toBe("my-post");
  });
});

describe("getBlogPostRow", () => {
  it("uses the source fallback when D1 throws", async () => {
    const db = {
      prepare: vi.fn(() => {
        throw new Error("d1 unavailable");
      }),
    } as unknown as D1Database;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `---
title: "Recovered Post"
slug: "recovered-post"
description: "Recovered description"
date: "2026-03-08"
author: "Fallback Author"
category: "Architecture"
tags: ["chat"]
featured: false
primer: "Recovered primer"
unlisted: true
---

Recovered body.`,
          { status: 200, headers: { "Content-Type": "text/plain" } },
        ),
      ),
    );

    const row = await getBlogPostRow(db, "recovered-post");

    expect(row?.slug).toBe("recovered-post");
    expect(row?.content).toBe("Recovered body.");
    expect(row?.tags).toBe('["chat"]');
    expect(row?.unlisted).toBe(1);
  });

  it("recovers hero_prompt from inline hero markdown when D1 content is stale", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const prompt =
      "A conceptual digital illustration showing a heavy framework and a fast glowing path";
    const row = await getBlogPostRow(
      mockDB(
        [],
        makeRow({
          slug: "nextjs-vs-tanstack-start",
          hero_image: "/blog/nextjs-vs-tanstack-start/hero.jpg",
          hero_prompt: null,
          content: `![${prompt}](/blog/nextjs-vs-tanstack-start/hero.jpg)\n\nBody from stale D1 content.`,
        }),
      ),
      "nextjs-vs-tanstack-start",
    );

    expect(row?.hero_prompt).toBe(prompt);
  });
});

// ---------- GET /api/blog-images/:slug/:filename ----------

describe("GET /api/blog-images/:slug/:filename", () => {
  it("serves a cached hero image when the prompt hash matches", async () => {
    const prompt = "Wide cinematic architecture artwork";
    const r2 = mockR2(
      makeR2Object("PNG_DATA", "image/png", { promptHash: hashImagePrompt(prompt) }),
    );
    const testApp = app(mockDB([]));

    const res = await testApp.request(
      `/api/blog-images/test-post/hero.png?prompt=${encodeURIComponent(prompt)}&v=${hashImagePrompt(prompt)}`,
      undefined,
      {
        DB: mockDB([]),
        SPA_ASSETS: r2,
      } as unknown as Env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    expect(r2.get).toHaveBeenCalledWith("blog-images/test-post/hero.png");
  });

  it("generates and caches a hero image when the tracked prompt changes", async () => {
    const prompt = "A futuristic universal adapter connecting AI tools";
    const db = mockDB(
      [],
      makeRow({
        slug: "test-post",
        hero_image: "/blog/test-post/hero.png",
        hero_prompt: prompt,
      }),
    );
    const r2 = mockR2(makeR2Object("OLD_DATA", "image/png"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              content: [{ type: "text", text: JSON.stringify({ jobId: "job-123" }) }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    status: "COMPLETED",
                    outputUrl: "https://images.example/hero.png",
                  }),
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response("NEW_PNG_DATA", {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const testApp = app(db);

    const res = await testApp.request("/api/blog-images/test-post/hero.png", undefined, {
      DB: db,
      SPA_ASSETS: r2,
    } as unknown as Env);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(
      JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body ?? "{}"))
        .name,
    ).toBe("img_generate");
    expect(
      JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.body ?? "{}"))
        .name,
    ).toBe("img_job_status");
    expect((r2.put as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(
      "blog-images/test-post/hero.png",
    );
    expect((r2.put as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]).toMatchObject({
      customMetadata: { promptHash: hashImagePrompt(prompt), source: "prompt-driven-hero" },
    });
  });

  it("recovers prompt text from stale markdown content and tolerates slower generation jobs", async () => {
    vi.useFakeTimers();
    try {
      const prompt =
        "A conceptual digital illustration showing a heavy, expensive framework contrasted with a fast glowing path";
      const db = mockDB(
        [],
        makeRow({
          slug: "nextjs-vs-tanstack-start",
          hero_image: "/blog/nextjs-vs-tanstack-start/hero.jpg",
          hero_prompt: null,
          content: `![${prompt}](/blog/nextjs-vs-tanstack-start/hero.jpg)\n\nBody from stale D1 content.`,
        }),
      );
      const r2 = mockR2(null);
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              content: [{ type: "text", text: JSON.stringify({ jobId: "job-456" }) }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      for (let attempt = 0; attempt < 7; attempt++) {
        fetchMock.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              result: {
                content: [{ type: "text", text: JSON.stringify({ status: "PENDING" }) }],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }

      fetchMock
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      status: "COMPLETED",
                      outputUrl: "https://images.example/next-vs-start.jpg",
                    }),
                  },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        )
        .mockResolvedValueOnce(
          new Response("NEW_JPEG_DATA", {
            status: 200,
            headers: { "Content-Type": "image/jpeg" },
          }),
        );

      vi.stubGlobal("fetch", fetchMock);

      const testApp = app(db);
      const responsePromise = testApp.request(
        "/api/blog-images/nextjs-vs-tanstack-start/hero.jpg",
        undefined,
        {
          DB: db,
          SPA_ASSETS: r2,
        } as unknown as Env,
      );
      await vi.runAllTimersAsync();
      const res = await responsePromise;

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/jpeg");
      expect((r2.put as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]).toMatchObject({
        customMetadata: { promptHash: hashImagePrompt(prompt), source: "prompt-driven-hero" },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 404 for missing non-hero images", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const r2 = mockR2(null);
    const testApp = app(mockDB([]));

    const res = await testApp.request("/api/blog-images/test-post/missing.png", undefined, {
      DB: mockDB([]),
      SPA_ASSETS: r2,
    } as unknown as Env);

    expect(res.status).toBe(404);
  });

  it("maps .jpg extension to image/jpeg", async () => {
    const prompt = "A wide comparison of two frameworks in a neon corridor";
    const r2 = mockR2(
      makeR2Object("JPG_DATA", "image/jpeg", { promptHash: hashImagePrompt(prompt) }),
    );
    const testApp = app(mockDB([]));

    const res = await testApp.request(
      `/api/blog-images/test-post/photo.jpg?prompt=${encodeURIComponent(prompt)}&v=${hashImagePrompt(prompt)}`,
      undefined,
      {
        DB: mockDB([]),
        SPA_ASSETS: r2,
      } as unknown as Env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });
});

// ---------- GET /blog/:slug/:filename (backward compat) ----------

describe("GET /blog/:slug/:filename (backward compat)", () => {
  it("serves hero images for known image extensions", async () => {
    const prompt = "A glowing dashboard of MCP tools";
    const r2 = mockR2(
      makeR2Object("PNG_DATA", "image/png", { promptHash: hashImagePrompt(prompt) }),
    );
    const testApp = app(mockDB([]));

    const res = await testApp.request(
      `/blog/test-post/hero.png?prompt=${encodeURIComponent(prompt)}&v=${hashImagePrompt(prompt)}`,
      undefined,
      {
        DB: mockDB([]),
        SPA_ASSETS: r2,
      } as unknown as Env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("falls through for non-image extensions", async () => {
    const r2 = mockR2(null);
    const testApp = app(mockDB([]));

    const res = await testApp.request("/blog/test-post/readme.html", undefined, {
      DB: mockDB([]),
      SPA_ASSETS: r2,
    } as unknown as Env);

    expect(res.status).toBe(404);
    expect(r2.get).not.toHaveBeenCalled();
  });

  it("falls through when R2 returns null for valid image extension", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const r2 = mockR2(null);
    const testApp = app(mockDB([]));

    const res = await testApp.request("/blog/test-post/missing.png", undefined, {
      DB: mockDB([]),
      SPA_ASSETS: r2,
    } as unknown as Env);

    // Falls through via next()
    expect(res.status).toBe(404);
  });
});
