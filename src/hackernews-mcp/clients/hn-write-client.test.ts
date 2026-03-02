import { beforeEach, describe, expect, it, vi } from "vitest";
import { HNWriteClient } from "./hn-write-client.js";
import { SessionManager } from "../session/session-manager.js";
import { createFailingFetch, createMockFetch } from "../__test-utils__/index.js";
import {
  COMMENT_SUCCESS_HTML,
  ITEM_PAGE_WITH_COMMENT_FORM_HTML,
  ITEM_PAGE_WITH_VOTE_HTML,
  LOGIN_FAILURE_HTML,
  LOGIN_SUCCESS_HTML,
  RATE_LIMITED_HTML,
  SUBMIT_FAILURE_HTML,
  SUBMIT_PAGE_HTML,
  SUBMIT_SUCCESS_HTML,
  VOTE_SUCCESS_HTML,
} from "../__test-utils__/index.js";
import { HN_WEB_BASE } from "../types.js";

describe("HNWriteClient", () => {
  let session: SessionManager;

  beforeEach(() => {
    session = new SessionManager();
  });

  describe("login", () => {
    it("succeeds with set-cookie header", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/login`,
          method: "POST",
          response: {
            status: 302,
            body: LOGIN_SUCCESS_HTML,
            headers: { "set-cookie": "user=testuser&abc123; HttpOnly" },
          },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.login("testuser", "password123");

      expect(result.success).toBe(true);
      expect(session.isLoggedIn()).toBe(true);
      expect(session.getUsername()).toBe("testuser");
    });

    it("succeeds with redirect meta tag", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/login`,
          method: "POST",
          response: { body: LOGIN_SUCCESS_HTML },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.login("testuser", "password123");

      expect(result.success).toBe(true);
      expect(session.isLoggedIn()).toBe(true);
    });

    it("fails with bad credentials", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/login`,
          method: "POST",
          response: { body: LOGIN_FAILURE_HTML },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.login("wrong", "bad");

      expect(result.success).toBe(false);
      expect(result.error).toBe("AUTH_FAILED");
      expect(session.isLoggedIn()).toBe(false);
    });

    it("fails with unexpected response", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/login`,
          method: "POST",
          response: { body: "<html><body>Something else</body></html>" },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.login("test", "test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("AUTH_FAILED");
    });
  });

  describe("submitStory", () => {
    it("requires auth", async () => {
      const fetch = createMockFetch([]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.submitStory("Title", "https://example.com");

      expect(result.success).toBe(false);
      expect(result.error).toBe("AUTH_REQUIRED");
    });

    it("submits story successfully", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        { url: `${HN_WEB_BASE}/submit`, response: { body: SUBMIT_PAGE_HTML } },
        {
          url: `${HN_WEB_BASE}/r`,
          method: "POST",
          response: { body: SUBMIT_SUCCESS_HTML },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.submitStory("My Title", "https://example.com");

      expect(result.success).toBe(true);
    });

    it("submits text post", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        { url: `${HN_WEB_BASE}/submit`, response: { body: SUBMIT_PAGE_HTML } },
        {
          url: `${HN_WEB_BASE}/r`,
          method: "POST",
          response: { body: SUBMIT_SUCCESS_HTML },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.submitStory("Ask HN: Question?", undefined, "My question text");

      expect(result.success).toBe(true);
    });

    it("detects rate limiting", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        { url: `${HN_WEB_BASE}/submit`, response: { body: SUBMIT_PAGE_HTML } },
        {
          url: `${HN_WEB_BASE}/r`,
          method: "POST",
          response: { body: SUBMIT_FAILURE_HTML },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.submitStory("Spam", "https://spam.com");

      expect(result.success).toBe(false);
      expect(result.error).toBe("RATE_LIMITED");
    });

    it("fails when CSRF token missing", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/submit`,
          response: { body: "<html><body>No form here</body></html>" },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.submitStory("Title", "https://example.com");

      expect(result.success).toBe(false);
      expect(result.error).toBe("CSRF_EXPIRED");
    });

    it("retries on CSRF expiry", async () => {
      session.login("testuser", "user=testuser");
      let submitCallCount = 0;
      const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? "GET";

        if (url.includes("/submit")) {
          return new Response(SUBMIT_PAGE_HTML, { status: 200 });
        }
        if (url.includes("/r") && method === "POST") {
          submitCallCount++;
          if (submitCallCount === 1) {
            return new Response("<html>Unknown or expired link.</html>", {
              status: 200,
            });
          }
          return new Response(SUBMIT_SUCCESS_HTML, { status: 200 });
        }
        return new Response("Not found", { status: 404 });
      }) as unknown as typeof globalThis.fetch;

      const client = new HNWriteClient(session, fetch);
      const result = await client.submitStory("Title", "https://example.com");

      expect(result.success).toBe(true);
      expect(submitCallCount).toBe(2);
    });
  });

  describe("upvote", () => {
    it("requires auth", async () => {
      const fetch = createMockFetch([]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.upvote(12345);

      expect(result.success).toBe(false);
      expect(result.error).toBe("AUTH_REQUIRED");
    });

    it("upvotes successfully", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=12345`,
          response: { body: ITEM_PAGE_WITH_VOTE_HTML },
        },
        {
          url: `${HN_WEB_BASE}/vote`,
          response: { status: 302, body: VOTE_SUCCESS_HTML },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.upvote(12345);

      expect(result.success).toBe(true);
    });

    it("fails when vote link not found", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=12345`,
          response: { body: "<html><body>No vote here</body></html>" },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.upvote(12345);

      expect(result.success).toBe(false);
      expect(result.error).toBe("VOTE_FAILED");
    });

    it("fails on 404 item", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=99999`,
          response: { status: 404, body: "Not found" },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.upvote(99999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("NOT_FOUND");
    });

    it("detects rate limiting on vote", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=12345`,
          response: { body: ITEM_PAGE_WITH_VOTE_HTML },
        },
        { url: `${HN_WEB_BASE}/vote`, response: { body: RATE_LIMITED_HTML } },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.upvote(12345);

      expect(result.success).toBe(false);
      expect(result.error).toBe("RATE_LIMITED");
    });

    it("fails with VOTE_FAILED on generic vote error", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=12345`,
          response: { body: ITEM_PAGE_WITH_VOTE_HTML },
        },
        {
          url: `${HN_WEB_BASE}/vote`,
          response: { status: 400, body: "<html>Some error occured</html>" },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.upvote(12345);

      expect(result.success).toBe(false);
      expect(result.error).toBe("VOTE_FAILED");
    });
  });

  describe("postComment", () => {
    it("requires auth", async () => {
      const fetch = createMockFetch([]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.postComment(12345, "My comment");

      expect(result.success).toBe(false);
      expect(result.error).toBe("AUTH_REQUIRED");
    });

    it("posts comment successfully", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=12345`,
          response: { body: ITEM_PAGE_WITH_COMMENT_FORM_HTML },
        },
        {
          url: `${HN_WEB_BASE}/comment`,
          method: "POST",
          response: { status: 302, body: COMMENT_SUCCESS_HTML },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.postComment(12345, "Great article!");

      expect(result.success).toBe(true);
    });

    it("fails when hmac token missing", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=12345`,
          response: { body: "<html><body>No form</body></html>" },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.postComment(12345, "Comment");

      expect(result.success).toBe(false);
      expect(result.error).toBe("COMMENT_FAILED");
    });

    it("fails on 404 item", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=99999`,
          response: { status: 404, body: "Not found" },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.postComment(99999, "Comment");

      expect(result.success).toBe(false);
      expect(result.error).toBe("NOT_FOUND");
    });

    it("detects rate limiting on comment", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=12345`,
          response: { body: ITEM_PAGE_WITH_COMMENT_FORM_HTML },
        },
        {
          url: `${HN_WEB_BASE}/comment`,
          method: "POST",
          response: { body: RATE_LIMITED_HTML },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.postComment(12345, "Comment");

      expect(result.success).toBe(false);
      expect(result.error).toBe("RATE_LIMITED");
    });

    it("fails with COMMENT_FAILED on generic comment error", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=12345`,
          response: { body: ITEM_PAGE_WITH_COMMENT_FORM_HTML },
        },
        {
          url: `${HN_WEB_BASE}/comment`,
          method: "POST",
          response: { status: 400, body: "<html>Some error occured</html>" },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.postComment(12345, "Comment");

      expect(result.success).toBe(false);
      expect(result.error).toBe("COMMENT_FAILED");
    });

    it("retries on CSRF expiry", async () => {
      session.login("testuser", "user=testuser");
      let commentCallCount = 0;
      const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? "GET";

        if (url.includes("/item?id=12345") && method === "GET") {
          return new Response(ITEM_PAGE_WITH_COMMENT_FORM_HTML, {
            status: 200,
          });
        }
        if (url.includes("/comment") && method === "POST") {
          commentCallCount++;
          if (commentCallCount === 1) {
            return new Response("<html>Unknown or expired link.</html>", {
              status: 200,
            });
          }
          return new Response(COMMENT_SUCCESS_HTML, { status: 302 });
        }
        return new Response("Not found", { status: 404 });
      }) as unknown as typeof globalThis.fetch;

      const client = new HNWriteClient(session, fetch);
      const result = await client.postComment(12345, "Comment");

      expect(result.success).toBe(true);
      expect(commentCallCount).toBe(2);
    });
  });

  describe("network errors", () => {
    it("login throws on network failure", async () => {
      const fetch = createFailingFetch("Connection refused");
      const client = new HNWriteClient(session, fetch);
      await expect(client.login("user", "pass")).rejects.toThrow("Connection refused");
    });

    it("submit throws on network failure", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createFailingFetch("Connection refused");
      const client = new HNWriteClient(session, fetch);
      await expect(client.submitStory("Title", "https://example.com")).rejects.toThrow(
        "Connection refused",
      );
    });
  });

  describe("submitStory additional branches", () => {
    it("succeeds when response is 302 status", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        { url: `${HN_WEB_BASE}/submit`, response: { body: SUBMIT_PAGE_HTML } },
        {
          url: `${HN_WEB_BASE}/r`,
          method: "POST",
          response: { status: 302, body: "<html>redirecting</html>" },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.submitStory("Title", "https://example.com");
      expect(result.success).toBe(true);
    });

    it("fails when CSRF retry also fails to extract fnid", async () => {
      session.login("testuser", "user=testuser");
      let submitCallCount = 0;
      const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? "GET";

        if (url.includes("/submit")) {
          // First call returns valid fnid; second call (retry) returns no fnid
          if (submitCallCount === 0) {
            return new Response(SUBMIT_PAGE_HTML, { status: 200 });
          }
          return new Response("<html>No form here</html>", { status: 200 });
        }
        if (url.includes("/r") && method === "POST") {
          submitCallCount++;
          return new Response("<html>Unknown or expired link.</html>", {
            status: 200,
          });
        }
        return new Response("Not found", { status: 404 });
      }) as unknown as typeof globalThis.fetch;

      const client = new HNWriteClient(session, fetch);
      const result = await client.submitStory("Title", "https://example.com");
      expect(result.success).toBe(false);
      expect(result.error).toBe("CSRF_EXPIRED");
    });

    it("fails with SUBMIT_FAILED on generic failure after CSRF retry", async () => {
      session.login("testuser", "user=testuser");
      let submitCallCount = 0;
      const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? "GET";

        if (url.includes("/submit")) {
          return new Response(SUBMIT_PAGE_HTML, { status: 200 });
        }
        if (url.includes("/r") && method === "POST") {
          submitCallCount++;
          if (submitCallCount === 1) {
            return new Response("<html>Unknown or expired link.</html>", {
              status: 200,
            });
          }
          // Second attempt also fails, no success indicators
          return new Response("<html>Some other error</html>", {
            status: 200,
          });
        }
        return new Response("Not found", { status: 404 });
      }) as unknown as typeof globalThis.fetch;

      const client = new HNWriteClient(session, fetch);
      const result = await client.submitStory("Title", "https://example.com");
      expect(result.success).toBe(false);
      expect(result.error).toBe("SUBMIT_FAILED");
    });

    it("fails with SUBMIT_FAILED on generic submit error", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        { url: `${HN_WEB_BASE}/submit`, response: { body: SUBMIT_PAGE_HTML } },
        {
          url: `${HN_WEB_BASE}/r`,
          method: "POST",
          response: { status: 200, body: "<html>Something went wrong but not expired</html>" },
        },
      ]);
      const client = new HNWriteClient(session, fetch);
      const result = await client.submitStory("Title", "https://example.com");

      expect(result.success).toBe(false);
      expect(result.error).toBe("SUBMIT_FAILED");
    });
  });

  describe("postComment additional branches", () => {
    it("fails when retry hmac extraction fails", async () => {
      session.login("testuser", "user=testuser");
      let commentCallCount = 0;
      const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? "GET";

        if (url.includes("/item?id=12345") && method === "GET") {
          // First GET returns valid form; second GET (retry fetch) returns no hmac
          if (commentCallCount === 0) {
            return new Response(ITEM_PAGE_WITH_COMMENT_FORM_HTML, {
              status: 200,
            });
          }
          return new Response("<html>No form here</html>", { status: 200 });
        }
        if (url.includes("/comment") && method === "POST") {
          commentCallCount++;
          return new Response("<html>Unknown or expired link.</html>", {
            status: 200,
          });
        }
        return new Response("Not found", { status: 404 });
      }) as unknown as typeof globalThis.fetch;

      const client = new HNWriteClient(session, fetch);
      const result = await client.postComment(12345, "My comment");
      expect(result.success).toBe(false);
      expect(result.error).toBe("CSRF_EXPIRED");
    });

    it("fails with COMMENT_FAILED when retry post also fails", async () => {
      session.login("testuser", "user=testuser");
      let commentCallCount = 0;
      const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? "GET";

        if (url.includes("/item?id=12345") && method === "GET") {
          return new Response(ITEM_PAGE_WITH_COMMENT_FORM_HTML, {
            status: 200,
          });
        }
        if (url.includes("/comment") && method === "POST") {
          commentCallCount++;
          if (commentCallCount === 1) {
            return new Response("<html>Unknown or expired link.</html>", {
              status: 200,
            });
          }
          // Second POST fails with no success indicators
          return new Response("<html>Comment failed for another reason</html>", {
            status: 200,
          });
        }
        return new Response("Not found", { status: 404 });
      }) as unknown as typeof globalThis.fetch;

      const client = new HNWriteClient(session, fetch);
      const result = await client.postComment(12345, "My comment");
      expect(result.success).toBe(false);
      expect(result.error).toBe("COMMENT_FAILED");
    });
  });
});
