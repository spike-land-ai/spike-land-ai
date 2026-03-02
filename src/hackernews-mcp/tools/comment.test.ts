import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMMENT_SUCCESS_HTML,
  createFailingFetch,
  createMockFetch,
  createMockServer,
  ITEM_PAGE_WITH_COMMENT_FORM_HTML,
} from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import { HNWriteClient } from "../clients/hn-write-client.js";
import { SessionManager } from "../session/session-manager.js";
import { registerCommentTools } from "./comment.js";
import { HN_WEB_BASE } from "../types.js";

describe("comment tools", () => {
  let server: MockMcpServer;
  let session: SessionManager;
  let writeClient: HNWriteClient;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    session = new SessionManager();
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
    writeClient = new HNWriteClient(session, fetch);
    registerCommentTools(
      server as unknown as Parameters<typeof registerCommentTools>[0],
      writeClient,
    );
  });

  it("registers 1 tool", () => {
    expect(server.tool).toHaveBeenCalledTimes(1);
  });

  describe("hn_post_comment", () => {
    it("posts comment successfully", async () => {
      session.login("testuser", "user=testuser");
      const result = await server.call("hn_post_comment", {
        parentId: 12345,
        text: "Great article!",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("commented");
      expect(parsed.parentId).toBe(12345);
    });

    it("returns AUTH_REQUIRED when not logged in", async () => {
      const result = await server.call("hn_post_comment", {
        parentId: 12345,
        text: "Comment",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("AUTH_REQUIRED");
    });

    it("handles network errors", async () => {
      session.login("testuser", "user=testuser");
      const failServer = createMockServer();
      const failClient = new HNWriteClient(session, createFailingFetch("Timeout"));
      registerCommentTools(
        failServer as unknown as Parameters<typeof registerCommentTools>[0],
        failClient,
      );

      const result = await failServer.call("hn_post_comment", {
        parentId: 12345,
        text: "Comment",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
    });

    it("returns COMMENT_FAILED with retryable info", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=12345`,
          response: { body: "<html><body>No form</body></html>" },
        },
      ]);
      const failServer = createMockServer();
      const client = new HNWriteClient(session, fetch);
      registerCommentTools(
        failServer as unknown as Parameters<typeof registerCommentTools>[0],
        client,
      );

      const result = await failServer.call("hn_post_comment", {
        parentId: 12345,
        text: "Comment",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("COMMENT_FAILED");
      expect(parsed.retryable).toBe(false);
    });

    it("returns RATE_LIMITED retryable", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=12345`,
          response: { body: ITEM_PAGE_WITH_COMMENT_FORM_HTML },
        },
        {
          url: `${HN_WEB_BASE}/comment`,
          method: "POST",
          response: { body: "You're submitting too fast. Please slow down." },
        },
      ]);
      const failServer = createMockServer();
      const client = new HNWriteClient(session, fetch);
      registerCommentTools(
        failServer as unknown as Parameters<typeof registerCommentTools>[0],
        client,
      );

      const result = await failServer.call("hn_post_comment", {
        parentId: 12345,
        text: "Comment",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("RATE_LIMITED");
      expect(parsed.retryable).toBe(true);
    });

    it("returns CSRF_EXPIRED retryable true", async () => {
      session.login("testuser", "user=testuser");
      const mockWriteClient = {
        postComment: vi.fn().mockResolvedValue({
          success: false,
          error: "CSRF_EXPIRED",
          message: "CSRF token expired and retry failed",
        }),
      } as unknown as HNWriteClient;
      const failServer = createMockServer();
      registerCommentTools(
        failServer as unknown as Parameters<typeof registerCommentTools>[0],
        mockWriteClient,
      );

      const result = await failServer.call("hn_post_comment", {
        parentId: 12345,
        text: "Comment",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("CSRF_EXPIRED");
      expect(parsed.retryable).toBe(true);
    });

    it("handles non-Error thrown values in hn_post_comment", async () => {
      const mockWriteClient = {
        postComment: vi.fn().mockRejectedValue("string-fail"),
      } as unknown as HNWriteClient;
      const failServer = createMockServer();
      registerCommentTools(
        failServer as unknown as Parameters<typeof registerCommentTools>[0],
        mockWriteClient,
      );

      const result = await failServer.call("hn_post_comment", {
        parentId: 12345,
        text: "Comment",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
      expect(parsed.message).toBe("string-fail");
    });
  });
});
