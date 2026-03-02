import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFailingFetch,
  createMockFetch,
  createMockServer,
  SAMPLE_STORY,
  SAMPLE_STORY_IDS,
} from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import { HNReadClient } from "../clients/hn-read-client.js";
import { registerStoriesTools } from "./stories.js";
import { HN_FIREBASE_BASE } from "../types.js";

describe("stories tools", () => {
  let server: MockMcpServer;
  let readClient: HNReadClient;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    const fetch = createMockFetch([
      {
        url: `${HN_FIREBASE_BASE}/topstories.json`,
        response: {
          body: SAMPLE_STORY_IDS as unknown as Record<string, unknown>,
        },
      },
      {
        url: `${HN_FIREBASE_BASE}/newstories.json`,
        response: {
          body: SAMPLE_STORY_IDS as unknown as Record<string, unknown>,
        },
      },
      { url: /\/item\/\d+\.json$/, response: { body: SAMPLE_STORY } },
    ]);
    readClient = new HNReadClient(fetch);
    registerStoriesTools(
      server as unknown as Parameters<typeof registerStoriesTools>[0],
      readClient,
    );
  });

  it("registers hn_get_stories tool", () => {
    expect(server.tool).toHaveBeenCalledTimes(1);
    expect(server.tool).toHaveBeenCalledWith(
      "hn_get_stories",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );
  });

  describe("hn_get_stories", () => {
    it("returns stories for category", async () => {
      const result = await server.call("hn_get_stories", {
        category: "top",
        limit: 2,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.category).toBe("top");
      expect(parsed.stories.length).toBeGreaterThanOrEqual(1);
    });

    it("returns stories with default limit", async () => {
      const result = await server.call("hn_get_stories", {
        category: "new",
        limit: 5,
      });
      expect(result.isError).toBeUndefined();
    });

    it("handles network errors", async () => {
      const failFetch = createFailingFetch("Connection timeout");
      const failClient = new HNReadClient(failFetch);
      const failServer = createMockServer();
      registerStoriesTools(
        failServer as unknown as Parameters<typeof registerStoriesTools>[0],
        failClient,
      );

      const result = await failServer.call("hn_get_stories", {
        category: "top",
        limit: 10,
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
      expect(parsed.retryable).toBe(true);
    });

    it("handles non-Error thrown values in hn_get_stories", async () => {
      const mockReadClient = {
        getStories: vi.fn().mockRejectedValue("string-fail"),
      } as unknown as HNReadClient;
      const failServer = createMockServer();
      registerStoriesTools(
        failServer as unknown as Parameters<typeof registerStoriesTools>[0],
        mockReadClient,
      );

      const result = await failServer.call("hn_get_stories", {
        category: "top",
        limit: 10,
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NETWORK_ERROR");
      expect(parsed.message).toBe("string-fail");
    });
  });
});
