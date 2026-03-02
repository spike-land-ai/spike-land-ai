import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFailingFetch,
  createMockFetch,
  createMockServer,
  LOGIN_FAILURE_HTML,
  LOGIN_SUCCESS_HTML,
} from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import { HNWriteClient } from "../clients/hn-write-client.js";
import { SessionManager } from "../session/session-manager.js";
import { registerAuthTools } from "./auth.js";
import { HN_WEB_BASE } from "../types.js";

describe("auth tools", () => {
  let server: MockMcpServer;
  let session: SessionManager;
  let writeClient: HNWriteClient;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    session = new SessionManager();
  });

  function setup(html: string, headers?: Record<string, string>) {
    const fetch = createMockFetch([
      {
        url: `${HN_WEB_BASE}/login`,
        method: "POST",
        response: { body: html, headers },
      },
    ]);
    writeClient = new HNWriteClient(session, fetch);
    registerAuthTools(
      server as unknown as Parameters<typeof registerAuthTools>[0],
      writeClient,
      session,
    );
  }

  it("registers 2 tools", () => {
    setup(LOGIN_SUCCESS_HTML);
    expect(server.tool).toHaveBeenCalledTimes(2);
  });

  describe("hn_login", () => {
    it("logs in successfully", async () => {
      setup(LOGIN_SUCCESS_HTML, {
        "set-cookie": "user=testuser&abc; HttpOnly",
      });
      const result = await server.call("hn_login", {
        username: "testuser",
        password: "pass123",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("logged_in");
      expect(parsed.username).toBe("testuser");
    });

    it("returns error on bad credentials", async () => {
      setup(LOGIN_FAILURE_HTML);
      const result = await server.call("hn_login", {
        username: "bad",
        password: "bad",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("AUTH_FAILED");
      expect(parsed.message).toBe("Invalid username or password");
    });

    it("returns error on unexpected response", async () => {
      setup("<html><body>Something unexpected</body></html>");
      const result = await server.call("hn_login", {
        username: "test",
        password: "test",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("AUTH_FAILED");
    });

    it("handles network errors", async () => {
      const failFetch = createFailingFetch("Connection refused");
      writeClient = new HNWriteClient(session, failFetch);
      server = createMockServer();
      registerAuthTools(
        server as unknown as Parameters<typeof registerAuthTools>[0],
        writeClient,
        session,
      );

      const result = await server.call("hn_login", {
        username: "test",
        password: "test",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
    });
  });

  describe("hn_auth_status", () => {
    it("returns not logged in initially", async () => {
      setup(LOGIN_SUCCESS_HTML);
      const result = await server.call("hn_auth_status", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.loggedIn).toBe(false);
      expect(parsed.username).toBeNull();
    });

    it("returns logged in after login", async () => {
      setup(LOGIN_SUCCESS_HTML, {
        "set-cookie": "user=testuser&abc; HttpOnly",
      });
      await server.call("hn_login", { username: "testuser", password: "pass" });
      const result = await server.call("hn_auth_status", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.loggedIn).toBe(true);
      expect(parsed.username).toBe("testuser");
      expect(parsed.loggedInAt).toBeTruthy();
    });
  });

  describe("non-Error thrown values", () => {
    it("handles non-Error thrown values in hn_login", async () => {
      const mockWriteClient = {
        login: vi.fn().mockRejectedValue("string-fail"),
      } as unknown as HNWriteClient;
      const failServer = createMockServer();
      registerAuthTools(
        failServer as unknown as Parameters<typeof registerAuthTools>[0],
        mockWriteClient,
        session,
      );

      const result = await failServer.call("hn_login", {
        username: "test",
        password: "test",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
      expect(parsed.message).toBe("string-fail");
    });
  });
});
