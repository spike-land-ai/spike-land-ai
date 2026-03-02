import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFailingFetch,
  createMockFetch,
  createMockServer,
  SUBMIT_PAGE_HTML,
  SUBMIT_SUCCESS_HTML,
} from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import { HNWriteClient } from "../clients/hn-write-client.js";
import { SessionManager } from "../session/session-manager.js";
import { registerSubmitTools } from "./submit.js";
import { HN_WEB_BASE } from "../types.js";

describe("submit tools", () => {
  let server: MockMcpServer;
  let session: SessionManager;
  let writeClient: HNWriteClient;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    session = new SessionManager();
    const fetch = createMockFetch([
      { url: `${HN_WEB_BASE}/submit`, response: { body: SUBMIT_PAGE_HTML } },
      {
        url: `${HN_WEB_BASE}/r`,
        method: "POST",
        response: { body: SUBMIT_SUCCESS_HTML },
      },
    ]);
    writeClient = new HNWriteClient(session, fetch);
    registerSubmitTools(
      server as unknown as Parameters<typeof registerSubmitTools>[0],
      writeClient,
    );
  });

  it("registers 1 tool", () => {
    expect(server.tool).toHaveBeenCalledTimes(1);
  });

  describe("hn_submit_story", () => {
    it("returns error when neither url nor text provided", async () => {
      session.login("testuser", "user=testuser");
      const result = await server.call("hn_submit_story", { title: "Title" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("INVALID_INPUT");
    });

    it("submits url story successfully", async () => {
      session.login("testuser", "user=testuser");
      const result = await server.call("hn_submit_story", {
        title: "My Story",
        url: "https://example.com",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("submitted");
    });

    it("submits text post successfully", async () => {
      session.login("testuser", "user=testuser");
      const result = await server.call("hn_submit_story", {
        title: "Ask HN: Question?",
        text: "Body text",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("submitted");
    });

    it("returns AUTH_REQUIRED when not logged in", async () => {
      const result = await server.call("hn_submit_story", {
        title: "Title",
        url: "https://example.com",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("AUTH_REQUIRED");
    });

    it("handles network errors", async () => {
      session.login("testuser", "user=testuser");
      const failServer = createMockServer();
      const failClient = new HNWriteClient(session, createFailingFetch("Timeout"));
      registerSubmitTools(
        failServer as unknown as Parameters<typeof registerSubmitTools>[0],
        failClient,
      );

      const result = await failServer.call("hn_submit_story", {
        title: "Title",
        url: "https://example.com",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
    });

    it("returns RATE_LIMITED retryable", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        { url: `${HN_WEB_BASE}/submit`, response: { body: SUBMIT_PAGE_HTML } },
        {
          url: `${HN_WEB_BASE}/r`,
          method: "POST",
          response: { body: "Please limit submissions to 4 per hour." },
        },
      ]);
      const failServer = createMockServer();
      const client = new HNWriteClient(session, fetch);
      registerSubmitTools(
        failServer as unknown as Parameters<typeof registerSubmitTools>[0],
        client,
      );

      const result = await failServer.call("hn_submit_story", {
        title: "Spam",
        url: "https://spam.com",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("RATE_LIMITED");
      expect(parsed.retryable).toBe(true);
    });

    it("returns CSRF_EXPIRED retryable", async () => {
      session.login("testuser", "user=testuser");
      const fetch = createMockFetch([
        {
          url: `${HN_WEB_BASE}/submit`,
          response: { body: "<html><body>No form</body></html>" },
        },
      ]);
      const failServer = createMockServer();
      const client = new HNWriteClient(session, fetch);
      registerSubmitTools(
        failServer as unknown as Parameters<typeof registerSubmitTools>[0],
        client,
      );

      const result = await failServer.call("hn_submit_story", {
        title: "Title",
        url: "https://example.com",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("CSRF_EXPIRED");
      expect(parsed.retryable).toBe(true);
    });
  });
});
