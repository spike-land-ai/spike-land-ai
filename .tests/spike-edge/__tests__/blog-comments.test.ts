import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/edge-api/main/core-logic/env.js";
import { blogComments } from "../../../src/edge-api/main/api/routes/blog-comments.js";
import { clearEloCache } from "../../../src/edge-api/main/core-logic/elo-service.js";

const AUTH_COOKIE = "session=valid-session";

/**
 * blogComments routes use authMiddleware inline on POST/DELETE/vote endpoints.
 * To pass auth we mock AUTH_MCP to return a valid session for the given userId.
 */
function createMockEnv(
  dbFirstImpl?: () => Promise<unknown>,
  dbAllImpl?: () => Promise<unknown>,
  batchImpl?: () => Promise<unknown>,
  userId = "user1",
): Env {
  const prepareMock = vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: dbFirstImpl ? vi.fn().mockImplementation(dbFirstImpl) : vi.fn().mockResolvedValue(null),
    all: dbAllImpl
      ? vi.fn().mockImplementation(dbAllImpl)
      : vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({}),
  });

  return {
    DB: {
      prepare: prepareMock,
      batch: batchImpl ? vi.fn().mockImplementation(batchImpl) : vi.fn().mockResolvedValue([]),
    } as unknown as D1Database,
    AUTH_MCP: {
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ session: { id: "sess1" }, user: { id: userId } }), {
          status: 200,
        }),
      ),
    } as unknown as Fetcher,
    INTERNAL_SERVICE_SECRET: "internal-secret-123",
  } as unknown as Env;
}

function makeApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/", blogComments);
  return app;
}

describe("blogComments — GET /blog/:slug/comments", () => {
  it("returns list of comments", async () => {
    const env = createMockEnv(undefined, () =>
      Promise.resolve({ results: [{ id: "c1", content: "Great post!" }] }),
    );
    const app = makeApp();
    const res = await app.request("/blog/my-post/comments", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<Array<{ id: string }>>();
    expect(body[0].id).toBe("c1");
  });

  it("returns empty array when no comments", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request("/blog/no-comments-post/comments", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<unknown[]>();
    expect(body).toEqual([]);
  });
});

describe("blogComments — POST /blog/:slug/comments", () => {
  it("returns 400 when content or user_name missing", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/blog/my-post/comments",
      {
        method: "POST",
        body: JSON.stringify({ content: "", user_name: "Alice" }),
        headers: { "Content-Type": "application/json", cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("required");
  });

  it("returns 400 when comment too long", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/blog/my-post/comments",
      {
        method: "POST",
        body: JSON.stringify({ content: "a".repeat(5001), user_name: "Alice" }),
        headers: { "Content-Type": "application/json", cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("too long");
  });

  it("returns 404 when parent comment not found", async () => {
    const env = createMockEnv(() => Promise.resolve(null));
    const app = makeApp();
    const res = await app.request(
      "/blog/my-post/comments",
      {
        method: "POST",
        body: JSON.stringify({ content: "Reply", user_name: "Alice", parent_id: "nonexistent" }),
        headers: { "Content-Type": "application/json", cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it("creates comment successfully", async () => {
    const firstMock = vi.fn().mockResolvedValue({ id: "c-new", created_at: Date.now() });
    const env = createMockEnv(() => firstMock());
    const app = makeApp();
    const res = await app.request(
      "/blog/my-post/comments",
      {
        method: "POST",
        body: JSON.stringify({ content: "Nice post!", user_name: "Alice" }),
        headers: { "Content-Type": "application/json", cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(201);
  });

  it("creates reply when parent exists", async () => {
    let callCount = 0;
    const env = createMockEnv(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ id: "parent-id" });
      return Promise.resolve({ id: "c-reply", created_at: Date.now() });
    });
    const app = makeApp();
    const res = await app.request(
      "/blog/my-post/comments",
      {
        method: "POST",
        body: JSON.stringify({ content: "I agree!", user_name: "Bob", parent_id: "parent-id" }),
        headers: { "Content-Type": "application/json", cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(201);
  });
});

describe("blogComments — POST /blog/comments/:commentId/vote", () => {
  it("returns 400 for invalid vote value", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/blog/comments/c1/vote",
      {
        method: "POST",
        body: JSON.stringify({ vote: 0 }),
        headers: { "Content-Type": "application/json", cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when comment not found", async () => {
    const env = createMockEnv(() => Promise.resolve(null));
    const app = makeApp();
    const res = await app.request(
      "/blog/comments/nonexistent/vote",
      {
        method: "POST",
        body: JSON.stringify({ vote: 1 }),
        headers: { "Content-Type": "application/json", cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when user votes on own comment", async () => {
    const env = createMockEnv(() => Promise.resolve({ id: "c1", user_id: "user1", score: 0 }));
    const app = makeApp();
    const res = await app.request(
      "/blog/comments/c1/vote",
      {
        method: "POST",
        body: JSON.stringify({ vote: 1 }),
        headers: { "Content-Type": "application/json", cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when already voted same direction", async () => {
    let callCount = 0;
    const env = createMockEnv(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ id: "c1", user_id: "other-user", score: 5 });
      if (callCount === 2) return Promise.resolve({ id: "v1", vote: 1 });
      return Promise.resolve({ score: 5 });
    });
    const app = makeApp();
    const res = await app.request(
      "/blog/comments/c1/vote",
      {
        method: "POST",
        body: JSON.stringify({ vote: 1 }),
        headers: { "Content-Type": "application/json", cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(409);
  });

  it("changes vote direction when already voted opposite", async () => {
    let callCount = 0;
    const env = createMockEnv(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ id: "c1", user_id: "other-user", score: 2 });
      if (callCount === 2) return Promise.resolve({ id: "v1", vote: -1 });
      return Promise.resolve({ score: 4 });
    });
    const app = makeApp();
    const res = await app.request(
      "/blog/comments/c1/vote",
      {
        method: "POST",
        body: JSON.stringify({ vote: 1 }),
        headers: { "Content-Type": "application/json", cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("adds new upvote", async () => {
    let callCount = 0;
    const env = createMockEnv(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ id: "c1", user_id: "other-user", score: 3 });
      if (callCount === 2) return Promise.resolve(null);
      return Promise.resolve({ score: 4 });
    });
    const app = makeApp();
    const res = await app.request(
      "/blog/comments/c1/vote",
      {
        method: "POST",
        body: JSON.stringify({ vote: 1 }),
        headers: { "Content-Type": "application/json", cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ score: number }>();
    expect(body.score).toBe(4);
  });

  it("applies ELO penalty when comment crosses downvote threshold", async () => {
    beforeEach(() => clearEloCache());
    let callCount = 0;
    const batchMock = vi.fn().mockResolvedValue([]);

    const prepareMock = vi.fn().mockImplementation((_sql: string) => {
      const _localCount = 0;
      return {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1)
            return Promise.resolve({ id: "c1", user_id: "other-user", score: -9 });
          if (callCount === 2) return Promise.resolve(null); // no existing vote
          if (callCount === 3) return Promise.resolve({ score: -10 }); // crossed threshold
          // user_elo for ELO penalty
          return Promise.resolve({
            user_id: "other-user",
            elo: 1200,
            event_count: 0,
            daily_gains: 0,
            daily_reset_at: Date.now(),
            tier: "pro",
          });
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      };
    });

    const env: Env = {
      DB: { prepare: prepareMock, batch: batchMock } as unknown as D1Database,
      AUTH_MCP: {
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ session: { id: "sess1" }, user: { id: "user1" } }), {
            status: 200,
          }),
        ),
      } as unknown as Fetcher,
      INTERNAL_SERVICE_SECRET: "internal-secret-123",
    } as unknown as Env;

    const app = makeApp();
    const res = await app.request(
      "/blog/comments/c1/vote",
      {
        method: "POST",
        body: JSON.stringify({ vote: -1 }),
        headers: { "Content-Type": "application/json", cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ eloPenaltyApplied: boolean }>();
    expect(body.eloPenaltyApplied).toBe(true);
  });
});

describe("blogComments — DELETE /blog/comments/:commentId", () => {
  it("returns 404 when comment not found", async () => {
    const env = createMockEnv(() => Promise.resolve(null));
    const app = makeApp();
    const res = await app.request(
      "/blog/comments/nonexistent",
      {
        method: "DELETE",
        headers: { cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not comment owner", async () => {
    const env = createMockEnv(() => Promise.resolve({ user_id: "other-user" }));
    const app = makeApp();
    const res = await app.request(
      "/blog/comments/c1",
      {
        method: "DELETE",
        headers: { cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  it("deletes own comment", async () => {
    const env = createMockEnv(() => Promise.resolve({ user_id: "user1" }));
    const app = makeApp();
    const res = await app.request(
      "/blog/comments/c1",
      {
        method: "DELETE",
        headers: { cookie: AUTH_COOKIE },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ deleted: boolean }>();
    expect(body.deleted).toBe(true);
  });
});
