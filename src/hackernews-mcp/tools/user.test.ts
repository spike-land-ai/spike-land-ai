import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFailingFetch,
  createMockFetch,
  createMockServer,
  SAMPLE_USER,
} from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import { HNReadClient } from "../clients/hn-read-client.js";
import { registerUserTools } from "./user.js";
import { HN_FIREBASE_BASE } from "../types.js";

describe("user tools", () => {
  let server: MockMcpServer;
  let readClient: HNReadClient;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    const fetch = createMockFetch([
      {
        url: `${HN_FIREBASE_BASE}/user/nobody.json`,
        response: { body: null as unknown as Record<string, unknown> },
      },
      {
        url: `${HN_FIREBASE_BASE}/user/pg.json`,
        response: { body: SAMPLE_USER },
      },
    ]);
    readClient = new HNReadClient(fetch);
    registerUserTools(server as unknown as Parameters<typeof registerUserTools>[0], readClient);
  });

  it("registers 1 tool", () => {
    expect(server.tool).toHaveBeenCalledTimes(1);
    expect(server.tool).toHaveBeenCalledWith(
      "hn_get_user",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );
  });

  describe("hn_get_user", () => {
    it("returns user profile", async () => {
      const result = await server.call("hn_get_user", { username: "pg" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe("pg");
      expect(parsed.karma).toBe(157236);
    });

    it("returns NOT_FOUND for unknown user", async () => {
      const result = await server.call("hn_get_user", { username: "nobody" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NOT_FOUND");
    });

    it("handles network errors", async () => {
      const failClient = new HNReadClient(createFailingFetch("DNS failure"));
      const failServer = createMockServer();
      registerUserTools(
        failServer as unknown as Parameters<typeof registerUserTools>[0],
        failClient,
      );

      const result = await failServer.call("hn_get_user", { username: "pg" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
    });

    it("handles non-Error thrown values in hn_get_user", async () => {
      const mockReadClient = {
        getUser: vi.fn().mockRejectedValue("string-fail"),
      } as unknown as HNReadClient;
      const failServer = createMockServer();
      registerUserTools(
        failServer as unknown as Parameters<typeof registerUserTools>[0],
        mockReadClient,
      );

      const result = await failServer.call("hn_get_user", { username: "pg" });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
      expect(parsed.message).toBe("string-fail");
    });
  });
});
