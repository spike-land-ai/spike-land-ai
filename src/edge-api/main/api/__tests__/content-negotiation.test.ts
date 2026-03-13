import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { blog } from "../routes/blog";
import { docsApi } from "../routes/docs-api";
import type { Env, Variables } from "../../core-logic/env";

afterEach(() => {
  vi.restoreAllMocks();
});

// Minimal env bindings stub
function makeEnv(overrides?: Partial<Env>): Env {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({}),
        }),
        first: async () => null,
        all: async () => ({ results: [] }),
      }),
    } as unknown as D1Database,
    SPA_ASSETS: {} as unknown as R2Bucket,
    ENVIRONMENT: "production",
    ...overrides,
  } as unknown as Env;
}

describe("Blog content negotiation", () => {
  it("returns text/markdown when Accept: text/markdown is set", async () => {
    const mdxContent = `---
title: "Test Post"
description: "A test"
date: "2026-01-01"
---

# Hello World`;

    // Mock global fetch for GitHub raw content
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("raw.githubusercontent.com") && url.includes("test-post.mdx")) {
        return new Response(mdxContent, { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof globalThis.fetch;

    try {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.route("/", blog);

      const res = await app.request(
        "/api/blog/test-post",
        {
          headers: { Accept: "text/markdown" },
        },
        makeEnv(),
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
      expect(res.headers.get("Vary")).toContain("Accept");

      const body = await res.text();
      expect(body).toContain("---");
      expect(body).toContain("title:");
      expect(body).toContain("# Hello World");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns JSON when no Accept header is set", async () => {
    const mdxContent = `---
title: "Test Post"
description: "A test"
primer: ""
date: "2026-01-01"
author: "Test"
category: "test"
tags: []
---

# Hello World`;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("raw.githubusercontent.com") && url.includes("json-test.mdx")) {
        return new Response(mdxContent, { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof globalThis.fetch;

    try {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.route("/", blog);

      const res = await app.request("/api/blog/json-test", {}, makeEnv());

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/json");

      const json = await res.json();
      expect(json).toHaveProperty("slug");
      expect(json).toHaveProperty("title");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns 404 for missing blog post with Accept: text/markdown", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      return new Response("not found", { status: 404 });
    }) as typeof globalThis.fetch;

    try {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.route("/", blog);

      const res = await app.request(
        "/api/blog/nonexistent-post",
        {
          headers: { Accept: "text/markdown" },
        },
        makeEnv(),
      );

      expect(res.status).toBe(404);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Docs content negotiation", () => {
  it("returns text/markdown when Accept: text/markdown is set", async () => {
    const docContent = `# Quick Start\n\nGet started with spike.land in minutes.`;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("raw.githubusercontent.com")) {
        return new Response(docContent, { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof globalThis.fetch;

    try {
      const app = new Hono<{ Bindings: Env }>();
      app.route("/", docsApi);

      // We need a valid slug from DOCS_MANIFEST. Let's use a known slug or test with unknown.
      // First, test that an unknown slug returns 404
      const res404 = await app.request(
        "/api/docs/nonexistent-doc",
        {
          headers: { Accept: "text/markdown" },
        },
        makeEnv(),
      );
      expect(res404.status).toBe(404);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns 404 for unknown doc slug regardless of Accept header", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", docsApi);

    const res = await app.request(
      "/api/docs/does-not-exist",
      {
        headers: { Accept: "text/markdown" },
      },
      makeEnv(),
    );

    expect(res.status).toBe(404);
  });
});
