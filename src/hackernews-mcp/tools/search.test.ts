import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFailingFetch,
  createMockFetch,
  createMockServer,
  SAMPLE_ALGOLIA_RESULT,
  SAMPLE_UPDATES,
} from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import { HNReadClient } from "../clients/hn-read-client.js";
import { registerSearchTools } from "./search.js";
import { ALGOLIA_BASE, HN_FIREBASE_BASE } from "../types.js";

describe("search tools", () => {
  let server: MockMcpServer;
  let readClient: HNReadClient;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    const fetch = createMockFetch([
      {
        url: `${ALGOLIA_BASE}/search`,
        response: { body: SAMPLE_ALGOLIA_RESULT },
      },
      {
        url: `${ALGOLIA_BASE}/search_by_date`,
        response: { body: SAMPLE_ALGOLIA_RESULT },
      },
      {
        url: `${HN_FIREBASE_BASE}/updates.json`,
        response: { body: SAMPLE_UPDATES },
      },
    ]);
    readClient = new HNReadClient(fetch);
    registerSearchTools(server as unknown as Parameters<typeof registerSearchTools>[0], readClient);
  });

  it("registers 2 tools", () => {
    expect(server.tool).toHaveBeenCalledTimes(2);
  });

  describe("hn_search", () => {
    it("searches by relevance", async () => {
      const result = await server.call("hn_search", {
        query: "react",
        sortBy: "relevance",
        page: 0,
        hitsPerPage: 20,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.query).toBe("react");
      expect(parsed.hits.length).toBeGreaterThan(0);
      expect(parsed.hits[0].author).toBe("pg");
    });

    it("searches by date", async () => {
      const result = await server.call("hn_search", {
        query: "test",
        sortBy: "date",
        page: 0,
        hitsPerPage: 20,
      });
      expect(result.isError).toBeUndefined();
    });

    it("passes optional filters", async () => {
      const result = await server.call("hn_search", {
        query: "rust",
        tags: "story",
        numericFilters: "points>100",
        page: 0,
        hitsPerPage: 20,
        sortBy: "relevance",
      });
      expect(result.isError).toBeUndefined();
    });

    it("handles network errors", async () => {
      const failClient = new HNReadClient(createFailingFetch("Timeout"));
      const failServer = createMockServer();
      registerSearchTools(
        failServer as unknown as Parameters<typeof registerSearchTools>[0],
        failClient,
      );

      const result = await failServer.call("hn_search", {
        query: "test",
        sortBy: "relevance",
        page: 0,
        hitsPerPage: 20,
      });
      expect(result.isError).toBe(true);
    });

    it("handles non-Error thrown values in hn_search", async () => {
      const mockReadClient = {
        search: vi.fn().mockRejectedValue("string-fail"),
      } as unknown as HNReadClient;
      const failServer = createMockServer();
      registerSearchTools(
        failServer as unknown as Parameters<typeof registerSearchTools>[0],
        mockReadClient,
      );

      const result = await failServer.call("hn_search", {
        query: "test",
        sortBy: "relevance",
        page: 0,
        hitsPerPage: 20,
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
      expect(parsed.message).toBe("string-fail");
    });
  });

  describe("hn_get_updates", () => {
    it("returns recent updates", async () => {
      const result = await server.call("hn_get_updates", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.items).toEqual([12345, 12346]);
      expect(parsed.profiles).toEqual(["pg", "dang"]);
    });

    it("handles network errors", async () => {
      const failClient = new HNReadClient(createFailingFetch("Timeout"));
      const failServer = createMockServer();
      registerSearchTools(
        failServer as unknown as Parameters<typeof registerSearchTools>[0],
        failClient,
      );

      const result = await failServer.call("hn_get_updates", {});
      expect(result.isError).toBe(true);
    });

    it("handles non-Error thrown values in get_updates", async () => {
      const mockReadClient = {
        getUpdates: vi.fn().mockRejectedValue("string-fail"),
      } as unknown as HNReadClient;
      const failServer = createMockServer();
      registerSearchTools(
        failServer as unknown as Parameters<typeof registerSearchTools>[0],
        mockReadClient,
      );

      const result = await failServer.call("hn_get_updates", {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("string-fail");
    });
  });
});
