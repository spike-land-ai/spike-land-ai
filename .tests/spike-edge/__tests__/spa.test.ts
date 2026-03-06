import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/edge-api/main/core-logic/env.js";
import { spa } from "../../../src/edge-api/main/api/routes/spa.js";

function makeR2Object(content: string) {
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(content));
        controller.close();
      },
    }),
    text: () => Promise.resolve(content),
    httpEtag: '"abc123"',
    writeHttpMetadata: vi.fn(),
  };
}

const BASE_HTML = `<!DOCTYPE html><html><head><title>spike.land - AI Platform</title><meta name="description" content="default desc" /></head><body><div id="root"></div></body></html>`;

function createMockEnv(spaAssets: Record<string, ReturnType<typeof makeR2Object> | null> = {}): Env {
  return {
    R2: {} as R2Bucket,
    SPA_ASSETS: {
      get: vi.fn().mockImplementation((key: string) =>
        Promise.resolve(spaAssets[key] ?? null)
      ),
    } as unknown as R2Bucket,
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database,
    AUTH_MCP: { fetch: vi.fn() } as unknown as Fetcher,
    MCP_SERVICE: { fetch: vi.fn() } as unknown as Fetcher,
    LIMITERS: {} as DurableObjectNamespace,
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_WEBHOOK_SECRET: "whsec",
    GEMINI_API_KEY: "key",
    CLAUDE_OAUTH_TOKEN: "token",
    GITHUB_TOKEN: "ghp",
    ALLOWED_ORIGINS: "https://spike.land",
    QUIZ_BADGE_SECRET: "secret",
    GA_MEASUREMENT_ID: "G-TEST",
    CACHE_VERSION: "v1",
    GA_API_SECRET: "ga",
    INTERNAL_SERVICE_SECRET: "internal",
    WHATSAPP_APP_SECRET: "wa",
    WHATSAPP_ACCESS_TOKEN: "token",
    WHATSAPP_PHONE_NUMBER_ID: "phone",
    WHATSAPP_VERIFY_TOKEN: "verify",
    MCP_INTERNAL_SECRET: "mcp",
  };
}

function makeApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/", spa);
  return app;
}

// ─── Static assets ────────────────────────────────────────────────────────────

describe("SPA — static asset serving", () => {
  it("serves a .js asset from R2", async () => {
    const jsObj = makeR2Object("console.log('hello');");
    const env = createMockEnv({ "app.abc12345.js": jsObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/app.abc12345.js", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("31536000");
    expect(res.headers.get("Cache-Control")).toContain("immutable");
  });

  it("returns 404 for missing .js asset (never falls back to index.html)", async () => {
    const env = createMockEnv({});
    const app = makeApp();
    const res = await app.request("https://spike.land/missing.abc12345.js", {}, env);
    expect(res.status).toBe(404);
  });

  it("serves a non-hashed .css with shorter TTL", async () => {
    const cssObj = makeR2Object("body {}");
    const env = createMockEnv({ "styles.css": cssObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/styles.css", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("3600");
  });
});

// ─── SPA index.html fallback ─────────────────────────────────────────────────

describe("SPA — index.html fallback", () => {
  it("returns 404 when index.html not found", async () => {
    const env = createMockEnv({});
    const app = makeApp();
    const res = await app.request("https://spike.land/unknown-route", {}, env);
    expect(res.status).toBe(404);
  });

  it("serves index.html for known routes when available", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const env = createMockEnv({ "index.html": htmlObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/settings", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  it("serves prerendered HTML file when it exists", async () => {
    const prerendered = makeR2Object("<html><head><title>Blog</title></head><body>Blog page</body></html>");
    const env = createMockEnv({ "blog.html": prerendered });
    const app = makeApp();
    const res = await app.request("https://spike.land/blog", {}, env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Blog page");
  });

  it("checks /route/index.html as second fallback", async () => {
    const fallback = makeR2Object("<html><body>About</body></html>");
    const env = createMockEnv({ "about/index.html": fallback });
    const app = makeApp();
    const res = await app.request("https://spike.land/about", {}, env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("About");
  });

  it("serves trailing slash with prerendered /route/index.html", async () => {
    const fallback = makeR2Object("<html><body>Docs</body></html>");
    const env = createMockEnv({ "docs/index.html": fallback });
    const app = makeApp();
    const res = await app.request("https://spike.land/docs/", {}, env);
    expect(res.status).toBe(200);
  });
});

// ─── Metadata injection ───────────────────────────────────────────────────────

describe("SPA — route metadata injection", () => {
  it("injects known route title for /pricing", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const env = createMockEnv({ "index.html": htmlObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/pricing", {}, env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Pricing");
  });

  it("injects known route title for /tools", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const env = createMockEnv({ "index.html": htmlObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/tools", {}, env);
    const text = await res.text();
    expect(text).toContain("AI Tools");
  });
});

// ─── /apps/:appId metadata injection ─────────────────────────────────────────

describe("SPA — /apps/:appId metadata injection", () => {
  it("injects app name in title for /apps/:appId", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const env = createMockEnv({ "index.html": htmlObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/apps/my-cool-app", {}, env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("My Cool App");
    expect(text).toContain("spike.land");
  });

  it("uses special casing for qa-studio app", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const env = createMockEnv({ "index.html": htmlObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/apps/qa-studio", {}, env);
    const text = await res.text();
    expect(text).toContain("QA Studio");
  });

  it("uses special casing for mcp-auth app", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const env = createMockEnv({ "index.html": htmlObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/apps/mcp-auth", {}, env);
    const text = await res.text();
    expect(text).toContain("MCP Auth");
  });

  it("does not inject app metadata for /apps/new", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const env = createMockEnv({ "index.html": htmlObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/apps/new", {}, env);
    const text = await res.text();
    // /apps/new is excluded from app metadata injection
    expect(text).not.toContain("New (App)");
  });

  it("injects tab parameter in title", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const env = createMockEnv({ "index.html": htmlObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/apps/my-app?tab=Settings", {}, env);
    const text = await res.text();
    expect(text).toContain("Settings");
  });
});

// ─── /blog/:slug metadata injection ─────────────────────────────────────────

describe("SPA — /blog/:slug metadata injection", () => {
  it("injects blog post metadata when DB returns a row", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const blogRow = {
      slug: "my-post",
      title: "My Great Post",
      description: "A wonderful post",
      primer: "Read more",
      date: "2025-01-01",
      author: "Bob",
      category: "tech",
      tags: "[]",
      featured: 0,
      hero_image: "/images/hero.png",
      content: "# Hello\nContent here",
      created_at: 1000,
      updated_at: 1000,
    };
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(blogRow),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv({ "index.html": htmlObj });
    (env as any).DB = db;
    const app = makeApp();
    const res = await app.request("https://spike.land/blog/my-post", {}, env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("My Great Post");
    expect(text).toContain("A wonderful post");
    expect(text).toContain("article");
    expect(text).toContain("ssr-blog");
  });

  it("serves SPA shell when DB returns no blog post row", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const env = createMockEnv({ "index.html": htmlObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/blog/missing-post", {}, env);
    expect(res.status).toBe(200);
    const text = await res.text();
    // No blog metadata injected, just the shell
    expect(text).not.toContain("ssr-blog");
  });

  it("uses default OG image when hero_image is null", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const blogRow = {
      slug: "no-image",
      title: "Post Without Image",
      description: "No image here",
      primer: "",
      date: "2025-01-01",
      author: "Alice",
      category: "tech",
      tags: "[]",
      featured: 0,
      hero_image: null,
      content: "Content",
      created_at: 1000,
      updated_at: 1000,
    };
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(blogRow),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv({ "index.html": htmlObj });
    (env as any).DB = db;
    const app = makeApp();
    const res = await app.request("https://spike.land/blog/no-image", {}, env);
    const text = await res.text();
    expect(text).toContain("og-image.png");
  });

  it("handles markdown content with headings, lists, and code blocks", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const blogRow = {
      slug: "rich-content",
      title: "Rich Content",
      description: "Test",
      primer: "",
      date: "2025-01-01",
      author: "Alice",
      category: "tech",
      tags: "[]",
      featured: 0,
      hero_image: null,
      content: `---
title: Test
---
# Heading 1

Some paragraph text with **bold** and *italic*.

- Item 1
- Item 2

1. First
2. Second

\`\`\`
code block
\`\`\`

---

![alt text](https://example.com/image.png)

[Link text](https://example.com)
`,
      created_at: 1000,
      updated_at: 1000,
    };
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(blogRow),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv({ "index.html": htmlObj });
    (env as any).DB = db;
    const app = makeApp();
    const res = await app.request("https://spike.land/blog/rich-content", {}, env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<h1>");
    expect(text).toContain("<strong>");
    expect(text).toContain("<ul>");
    expect(text).toContain("<ol>");
    expect(text).toContain("<pre><code>");
    expect(text).toContain("<hr />");
  });
});

// ─── Direct R2 object match (non-extension path) ──────────────────────────────

describe("SPA — direct R2 match for non-extension paths", () => {
  it("serves object when key matches directly in R2", async () => {
    const obj = {
      body: new ReadableStream(),
      httpEtag: '"etag1"',
      writeHttpMetadata: vi.fn(),
    };
    const env = createMockEnv({ "some-resource": obj as unknown as ReturnType<typeof makeR2Object> });
    const app = makeApp();
    const res = await app.request("https://spike.land/some-resource", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("3600");
  });
});

// ─── Cookie consent tracking ──────────────────────────────────────────────────

describe("SPA — cookie consent tracking", () => {
  it("sets spike_client_id cookie when consent given and no existing client id", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const env = createMockEnv({ "index.html": htmlObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/settings", {
      headers: { cookie: "cookie_consent=accepted" },
    }, env);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("spike_client_id=");
  });

  it("does not set cookie when no consent", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const env = createMockEnv({ "index.html": htmlObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/settings", {}, env);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeNull();
  });

  it("does not set cookie when already has spike_client_id", async () => {
    const htmlObj = makeR2Object(BASE_HTML);
    const env = createMockEnv({ "index.html": htmlObj });
    const app = makeApp();
    const res = await app.request("https://spike.land/settings", {
      headers: { cookie: "cookie_consent=accepted; spike_client_id=existing-id" },
    }, env);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeNull();
  });
});
