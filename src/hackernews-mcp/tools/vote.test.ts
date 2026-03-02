import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFailingFetch,
  createMockFetch,
  createMockServer,
  ITEM_PAGE_WITH_VOTE_HTML,
  VOTE_SUCCESS_HTML,
} from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import { HNWriteClient } from "../clients/hn-write-client.js";
import { SessionManager } from "../session/session-manager.js";
import { registerVoteTools } from "./vote.js";
import { HN_WEB_BASE } from "../types.js";

describe("vote tools", () => {
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
        response: { body: ITEM_PAGE_WITH_VOTE_HTML },
      },
      {
        url: `${HN_WEB_BASE}/vote`,
        response: { status: 302, body: VOTE_SUCCESS_HTML },
      },
    ]);
    writeClient = new HNWriteClient(session, fetch);
    registerVoteTools(server as unknown as Parameters<typeof registerVoteTools>[0], writeClient);
  });

  it("registers 1 tool", () => {
    expect(server.tool).toHaveBeenCalledTimes(1);
  });

  describe("hn_upvote", () => {
    it("upvotes successfully", async () => {
      session.login("testuser", "user=testuser");
      const result = await server.call("hn_upvote", { itemId: 12345 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("upvoted");
      expect(parsed.itemId).toBe(12345);
    });

    it("returns AUTH_REQUIRED when not logged in", async () => {
      const result = await server.call("hn_upvote", { itemId: 12345 });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("AUTH_REQUIRED");
    });

    it("handles network errors", async () => {
      session.login("testuser", "user=testuser");
      const failServer = createMockServer();
      const failClient = new HNWriteClient(session, createFailingFetch("Timeout"));
      registerVoteTools(
        failServer as unknown as Parameters<typeof registerVoteTools>[0],
        failClient,
      );

      const result = await failServer.call("hn_upvote", { itemId: 12345 });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
    });

    it("returns VOTE_FAILED with retryable false", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=12345`,
          response: { body: "<html><body>No vote</body></html>" },
        },
      ]);
      const failServer = createMockServer();
      const client = new HNWriteClient(session, fetch);
      registerVoteTools(failServer as unknown as Parameters<typeof registerVoteTools>[0], client);

      const result = await failServer.call("hn_upvote", { itemId: 12345 });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("VOTE_FAILED");
      expect(parsed.retryable).toBe(false);
    });

    it("returns RATE_LIMITED with retryable true", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/item?id=12345`,
          response: { body: ITEM_PAGE_WITH_VOTE_HTML },
        },
        {
          url: /\/vote/,
          response: { body: "You're submitting too fast. Please slow down." },
        },
      ]);
      const failServer = createMockServer();
      const client = new HNWriteClient(session, fetch);
      registerVoteTools(failServer as unknown as Parameters<typeof registerVoteTools>[0], client);

      const result = await failServer.call("hn_upvote", { itemId: 12345 });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("RATE_LIMITED");
      expect(parsed.retryable).toBe(true);
    });

    it("handles non-Error thrown values in hn_upvote", async () => {
      const mockWriteClient = {
        upvote: vi.fn().mockRejectedValue("string-fail"),
      } as unknown as HNWriteClient;
      const failServer = createMockServer();
      registerVoteTools(
        failServer as unknown as Parameters<typeof registerVoteTools>[0],
        mockWriteClient,
      );

      const result = await failServer.call("hn_upvote", { itemId: 12345 });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
      expect(parsed.message).toBe("string-fail");
    });
  });
});
