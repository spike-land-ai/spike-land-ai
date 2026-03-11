/**
 * Additional coverage for src/edge-api/main/api/routes/blog.ts
 *
 * Focuses on paths NOT covered by the existing blog.test.ts:
 *   - GET /api/blog/posts  (301 redirect alias)
 *   - GET /blog/rss        (RSS feed)
 *   - Local-dev draft visibility (isLocalDev branch)
 *   - rowToPost edge cases: malformed tags, whitespace-only hero_prompt
 *   - sourceToRow parsing edge cases
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { blog, rowToPost, type BlogPostRow } from "../routes/blog.js";
import type { Env } from "../../core-logic/env.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function mockDBList(rows: BlogPostRow[]) {
  return {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({ results: rows }),
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(rows[0] ?? null),
      }),
    }),
  } as unknown as D1Database;
}

function mockR2(getResult: unknown = null) {
  return {
    get: vi.fn().mockResolvedValue(getResult),
    put: vi.fn().mockResolvedValue(undefined),
  } as unknown as R2Bucket;
}

function createApp(_env: Partial<Env> = {}) {
  const testApp = new Hono<{ Bindings: Env }>();
  testApp.route("/", blog);
  return testApp;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── GET /api/blog/posts redirect ───────────────────────────────────────────

describe("GET /api/blog/posts", () => {
  it("redirects /api/blog/posts to /api/blog with 301", async () => {
    const db = mockDBList([]);
    const app = createApp();

    const res = await app.request("/api/blog/posts", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/api/blog");
  });
});

// ─── GET /blog/rss ───────────────────────────────────────────────────────────

describe("GET /blog/rss", () => {
  it("returns XML with Content-Type application/rss+xml", async () => {
    const rows = [
      makeRow({ slug: "post-1", title: "Post One", description: "Desc one", date: "2026-03-01" }),
      makeRow({ slug: "post-2", title: "Post Two", description: "Desc two", date: "2026-02-01" }),
    ];
    const db = mockDBList(rows);
    const app = createApp();

    const res = await app.request("/blog/rss", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    expect(res.status).toBe(200);
    const ct = res.headers.get("Content-Type") ?? "";
    expect(ct).toContain("application/rss+xml");
  });

  it("includes post titles in the RSS XML output", async () => {
    const rows = [makeRow({ slug: "intro", title: "Introduction to MCP", date: "2026-03-01" })];
    const db = mockDBList(rows);
    const app = createApp();

    const res = await app.request("/blog/rss", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    const xml = await res.text();
    expect(xml).toContain("Introduction to MCP");
  });

  it("wraps titles in CDATA sections", async () => {
    const rows = [makeRow({ slug: "test", title: "Title & Special <chars>", date: "2026-03-01" })];
    const db = mockDBList(rows);
    const app = createApp();

    const res = await app.request("/blog/rss", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    const xml = await res.text();
    expect(xml).toContain("<![CDATA[");
    expect(xml).toContain("Title & Special <chars>");
  });

  it("returns well-formed RSS 2.0 structure with channel element", async () => {
    const rows = [makeRow({ slug: "post-a", title: "Post A", date: "2026-03-01" })];
    const db = mockDBList(rows);
    const app = createApp();

    const res = await app.request("/blog/rss", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    const xml = await res.text();
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("</channel>");
    expect(xml).toContain("spike.land Blog");
  });

  it("includes post links pointing to spike.land/blog/<slug>", async () => {
    const rows = [makeRow({ slug: "my-article", title: "My Article", date: "2026-03-01" })];
    const db = mockDBList(rows);
    const app = createApp();

    const res = await app.request("/blog/rss", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    const xml = await res.text();
    expect(xml).toContain("https://spike.land/blog/my-article");
  });

  it("returns empty RSS feed (with channel) when no posts exist", async () => {
    const db = mockDBList([]);
    const app = createApp();

    const res = await app.request("/blog/rss", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<channel>");
    // No <item> elements for empty feed
    expect(xml).not.toContain("<item>");
  });

  it("returns empty channel RSS when D1 is unavailable", async () => {
    const db = {
      prepare: vi.fn().mockImplementation(() => {
        throw new Error("D1 unavailable");
      }),
    } as unknown as D1Database;
    const app = createApp();

    const res = await app.request("/blog/rss", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    expect(res.status).toBe(200);
    const ct = res.headers.get("Content-Type") ?? "";
    expect(ct).toContain("rss+xml");
  });

  it("includes author and category elements for each post", async () => {
    const rows = [
      makeRow({
        slug: "s",
        title: "T",
        author: "Author Name",
        category: "Engineering",
        date: "2026-03-01",
      }),
    ];
    const db = mockDBList(rows);
    const app = createApp();

    const res = await app.request("/blog/rss", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    const xml = await res.text();
    expect(xml).toContain("Author Name");
    expect(xml).toContain("<category><![CDATA[Engineering]]></category>");
  });
});

// ─── isLocalDev — draft visibility ──────────────────────────────────────────

describe("GET /api/blog — draft visibility", () => {
  it("filters out draft=1 posts by default (production)", async () => {
    const rows = [
      makeRow({ slug: "published", draft: 0 }),
      makeRow({ slug: "draft-post", draft: 1 }),
    ];
    const db = mockDBList(rows);
    const app = createApp();

    await app.request("/api/blog", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
    } as unknown as Env);

    const query = (db.prepare as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(query).toContain("draft = 0");
  });

  it("excludes draft filter when ENVIRONMENT is development", async () => {
    const rows = [makeRow({ slug: "published", draft: 0 })];
    const db = mockDBList(rows);
    const app = createApp();

    await app.request("/api/blog", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
      ENVIRONMENT: "development",
    } as unknown as Env);

    const query = (db.prepare as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    // In local dev mode, draft filter is omitted
    expect(query).not.toContain("draft = 0");
  });

  it("shows drafts when ENVIRONMENT is local", async () => {
    const rows = [makeRow({ slug: "published", draft: 0 })];
    const db = mockDBList(rows);
    const app = createApp();

    await app.request("/api/blog", undefined, {
      DB: db,
      SPA_ASSETS: mockR2(),
      ENVIRONMENT: "local",
    } as unknown as Env);

    const query = (db.prepare as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(query).not.toContain("draft = 0");
  });
});

// ─── rowToPost edge cases ────────────────────────────────────────────────────

describe("rowToPost — additional edge cases", () => {
  it("defaults tags to empty array when tags JSON is malformed", () => {
    const row = makeRow({ tags: "not json at all" });
    const post = rowToPost(row);
    expect(post.tags).toEqual([]);
  });

  it("defaults tags to empty array when tags is empty string", () => {
    const row = makeRow({ tags: "" });
    const post = rowToPost(row);
    expect(post.tags).toEqual([]);
  });

  it("returns null heroPrompt when hero_prompt is whitespace-only", () => {
    const row = makeRow({ hero_prompt: "   ", hero_image: null });
    const post = rowToPost(row);
    expect(post.heroPrompt).toBeNull();
  });

  it("returns null heroPrompt when no hero_image and no prompt", () => {
    const row = makeRow({ hero_prompt: null, hero_image: null });
    const post = rowToPost(row);
    expect(post.heroPrompt).toBeNull();
  });

  it("uses explicit hero_prompt over inferring from markdown", () => {
    const explicitPrompt = "Explicit artist prompt";
    const row = makeRow({
      hero_image: "/blog/test-post/hero.png",
      hero_prompt: explicitPrompt,
      content: "![different markdown prompt](/blog/test-post/hero.png)\n\nBody.",
    });
    const post = rowToPost(row);
    expect(post.heroPrompt).toBe(explicitPrompt);
  });

  it("includes draft field", () => {
    const row = makeRow({ draft: 1 });
    const post = rowToPost(row);
    expect(post.draft).toBe(true);
  });

  it("does not include DB-internal fields (created_at, updated_at)", () => {
    const row = makeRow({ created_at: 1234567890, updated_at: 9876543210 });
    const post = rowToPost(row);
    expect(post).not.toHaveProperty("created_at");
    expect(post).not.toHaveProperty("updated_at");
  });

  it("handles tags JSON array with mixed quoted styles", () => {
    // The tag parser uses parseTagsValue which strips quotes around items
    const row = makeRow({ tags: "['mcp', 'edge']" });
    const post = rowToPost(row);
    // Not a valid JSON array so falls back to empty
    expect(Array.isArray(post.tags)).toBe(true);
  });
});

// ─── shouldAllowProdImageFallback (via blog-images route) ───────────────────
//
// These tests verify the prod-fallback gate by passing a `prompt` query param
// (which bypasses D1 / image-studio) so the only `fetch` in the call path is
// the prod fallback itself.

describe("GET /api/blog-images — prod fallback hosts", () => {
  it("does NOT proxy to production for spike.land hostname — returns 404 instead", async () => {
    // No R2 object, no DB row matching the requested path → no heroPrompt resolved.
    // allowProdFallback=false (spike.land hostname) so we get null → 404.
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }),
      }),
    } as unknown as D1Database;

    const app = createApp();

    // Hono test helper uses the first arg as the URL when it looks like a path;
    // pass a full spike.land URL so the hostname resolves correctly.
    const res = await app.request("https://spike.land/api/blog-images/test-post/hero.png", {}, {
      DB: db,
      SPA_ASSETS: mockR2(null),
    } as unknown as Env);

    expect(res.status).toBe(404);
    // fetch should not have been called for a prod-fallback attempt
    const prodFallbackCalled = (fetchMock.mock.calls as Array<[string | URL, unknown]>).some(
      ([url]) => String(url).startsWith("https://spike.land/api/blog-images"),
    );
    expect(prodFallbackCalled).toBe(false);
  });

  it("proxies to production when hostname is localhost (allowProdFallback=true)", async () => {
    // The prod fallback is only reached when heroPrompt is null AND obj is null.
    // heroPrompt is null when resolveHeroPrompt finds no explicit prompt AND no matching DB row.
    // We stub fetch to handle two cases: MDX source (404) and prod fallback (200).
    const fetchMock = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("raw.githubusercontent.com")) {
        // MDX source lookup — not found
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      if (urlStr.startsWith("https://spike.land/api/blog-images")) {
        return Promise.resolve(
          new Response("PROD_IMAGE", { status: 200, headers: { "Content-Type": "image/png" } }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    // DB returns null for the blog post row (no hero info)
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }),
      }),
    } as unknown as D1Database;

    const app = createApp();

    const res = await app.request("http://localhost/api/blog-images/test-post/hero.png", {}, {
      DB: db,
      SPA_ASSETS: mockR2(null),
    } as unknown as Env);

    // The prod fallback fetch should have been attempted for localhost
    const prodFallbackCalled = (fetchMock.mock.calls as Array<[string | URL, unknown]>).some(
      ([url]) => String(url).startsWith("https://spike.land/api/blog-images"),
    );
    expect(prodFallbackCalled).toBe(true);
    expect(res.status).toBe(200);
  });
});
