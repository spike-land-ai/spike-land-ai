import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFailingFetch,
  createMockFetch,
  createMockServer,
  SAMPLE_COMMENT,
  SAMPLE_NESTED_COMMENT,
  SAMPLE_STORY,
} from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import { HNReadClient } from "../clients/hn-read-client.js";
import { registerItemTools } from "./item.js";
import { HN_FIREBASE_BASE } from "../types.js";

describe("item tools", () => {
  let server: MockMcpServer;
  let readClient: HNReadClient;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    const fetch = createMockFetch([
      {
        url: `${HN_FIREBASE_BASE}/item/99999.json`,
        response: { body: null as unknown as Record<string, unknown> },
      },
      {
        url: `${HN_FIREBASE_BASE}/item/12345.json`,
        response: { body: SAMPLE_STORY },
      },
      {
        url: `${HN_FIREBASE_BASE}/item/12346.json`,
        response: { body: SAMPLE_COMMENT },
      },
      {
        url: `${HN_FIREBASE_BASE}/item/12347.json`,
        response: { body: { ...SAMPLE_COMMENT, id: 12347, kids: [] } },
      },
      {
        url: `${HN_FIREBASE_BASE}/item/12348.json`,
        response: { body: SAMPLE_NESTED_COMMENT },
      },
    ]);
    readClient = new HNReadClient(fetch);
    registerItemTools(server as unknown as Parameters<typeof registerItemTools>[0], readClient);
  });

  it("registers 2 tools", () => {
    expect(server.tool).toHaveBeenCalledTimes(2);
  });

  describe("hn_get_item", () => {
    it("returns item by ID", async () => {
      const result = await server.call("hn_get_item", { id: 12345 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(12345);
      expect(parsed.title).toBe(SAMPLE_STORY.title);
    });

    it("returns NOT_FOUND for missing item", async () => {
      const result = await server.call("hn_get_item", { id: 99999 });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NOT_FOUND");
    });

    it("handles network errors", async () => {
      const failClient = new HNReadClient(createFailingFetch("Timeout"));
      const failServer = createMockServer();
      registerItemTools(
        failServer as unknown as Parameters<typeof registerItemTools>[0],
        failClient,
      );

      const result = await failServer.call("hn_get_item", { id: 12345 });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
    });
  });

  describe("hn_get_item_with_comments", () => {
    it("returns item with comment tree", async () => {
      const result = await server.call("hn_get_item_with_comments", {
        id: 12345,
        depth: 2,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(12345);
      expect(parsed.comments).toBeDefined();
      expect(parsed.comments.length).toBeGreaterThan(0);
    });

    it("returns NOT_FOUND for missing item", async () => {
      const result = await server.call("hn_get_item_with_comments", {
        id: 99999,
        depth: 2,
      });
      expect(result.isError).toBe(true);
    });

    it("handles network errors", async () => {
      const failClient = new HNReadClient(createFailingFetch("Connection reset"));
      const failServer = createMockServer();
      registerItemTools(
        failServer as unknown as Parameters<typeof registerItemTools>[0],
        failClient,
      );

      const result = await failServer.call("hn_get_item_with_comments", {
        id: 12345,
        depth: 2,
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
    });

    it("handles non-Error thrown values in get_item_with_comments", async () => {
      const mockReadClient = {
        getItemWithComments: vi.fn().mockRejectedValue("string-error"),
      } as unknown as HNReadClient;
      const failServer = createMockServer();
      registerItemTools(
        failServer as unknown as Parameters<typeof registerItemTools>[0],
        mockReadClient,
      );

      const result = await failServer.call("hn_get_item_with_comments", {
        id: 12345,
        depth: 2,
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
      expect(parsed.message).toBe("string-error");
    });
  });

  describe("non-Error thrown values", () => {
    it("handles non-Error thrown values in hn_get_item", async () => {
      const mockReadClient = {
        getItem: vi.fn().mockRejectedValue("string-fail"),
      } as unknown as HNReadClient;
      const failServer = createMockServer();
      registerItemTools(
        failServer as unknown as Parameters<typeof registerItemTools>[0],
        mockReadClient,
      );

      const result = await failServer.call("hn_get_item", { id: 12345 });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
      expect(parsed.message).toBe("string-fail");
    });
  });
});
