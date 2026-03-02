import { describe, expect, it, vi } from "vitest";
import { HNReadClient } from "./hn-read-client.js";
import {
  createFailingFetch,
  createMockFetch,
  SAMPLE_ALGOLIA_RESULT,
  SAMPLE_COMMENT,
  SAMPLE_NESTED_COMMENT,
  SAMPLE_STORY,
  SAMPLE_STORY_IDS,
  SAMPLE_UPDATES,
  SAMPLE_USER,
} from "../__test-utils__/index.js";
import { ALGOLIA_BASE, HN_FIREBASE_BASE } from "../types.js";

describe("HNReadClient", () => {
  describe("getItem", () => {
    it("returns item from Firebase API", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/item/12345.json`,
          response: { body: SAMPLE_STORY },
        },
      ]);
      const client = new HNReadClient(fetch);
      const item = await client.getItem(12345);
      expect(item).toEqual(SAMPLE_STORY);
    });

    it("returns null for missing item", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/item/99999.json`,
          response: { body: null as unknown as Record<string, unknown> },
        },
      ]);
      const client = new HNReadClient(fetch);
      const item = await client.getItem(99999);
      expect(item).toBeNull();
    });

    it("returns null on HTTP error", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/item/12345.json`,
          response: { status: 500, body: {} },
        },
      ]);
      const client = new HNReadClient(fetch);
      const item = await client.getItem(12345);
      expect(item).toBeNull();
    });
  });

  describe("getUser", () => {
    it("returns user profile", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/user/pg.json`,
          response: { body: SAMPLE_USER },
        },
      ]);
      const client = new HNReadClient(fetch);
      const user = await client.getUser("pg");
      expect(user).toEqual(SAMPLE_USER);
    });

    it("returns null for unknown user", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/user/nobody.json`,
          response: { body: null as unknown as Record<string, unknown> },
        },
      ]);
      const client = new HNReadClient(fetch);
      const user = await client.getUser("nobody");
      expect(user).toBeNull();
    });
  });

  describe("getStoryIds", () => {
    it("returns story IDs for category", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/topstories.json`,
          response: {
            body: SAMPLE_STORY_IDS as unknown as Record<string, unknown>,
          },
        },
      ]);
      const client = new HNReadClient(fetch);
      const ids = await client.getStoryIds("top");
      expect(ids).toEqual(SAMPLE_STORY_IDS);
    });

    it("returns empty array on error", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/topstories.json`,
          response: { status: 500, body: {} },
        },
      ]);
      const client = new HNReadClient(fetch);
      const ids = await client.getStoryIds("top");
      expect(ids).toEqual([]);
    });
  });

  describe("getStories", () => {
    it("fetches and returns stories with limit", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/topstories.json`,
          response: {
            body: SAMPLE_STORY_IDS as unknown as Record<string, unknown>,
          },
        },
        {
          url: `${HN_FIREBASE_BASE}/item/12345.json`,
          response: { body: SAMPLE_STORY },
        },
        {
          url: `${HN_FIREBASE_BASE}/item/12350.json`,
          response: { body: { ...SAMPLE_STORY, id: 12350 } },
        },
      ]);
      const client = new HNReadClient(fetch);
      const stories = await client.getStories("top", 2);
      expect(stories).toHaveLength(2);
      expect(stories[0].id).toBe(12345);
    });

    it("filters out null items", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/topstories.json`,
          response: {
            body: [12345, 99999] as unknown as Record<string, unknown>,
          },
        },
        {
          url: `${HN_FIREBASE_BASE}/item/12345.json`,
          response: { body: SAMPLE_STORY },
        },
        {
          url: `${HN_FIREBASE_BASE}/item/99999.json`,
          response: { body: null as unknown as Record<string, unknown> },
        },
      ]);
      const client = new HNReadClient(fetch);
      const stories = await client.getStories("top", 2);
      expect(stories).toHaveLength(1);
    });
  });

  describe("getItemWithComments", () => {
    it("builds comment tree to specified depth", async () => {
      const fetch = createMockFetch([
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
      const client = new HNReadClient(fetch);
      const result = await client.getItemWithComments(12345, 2);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(12345);
      expect(result!.comments).toHaveLength(2);
      expect(result!.comments[0].id).toBe(12346);
      expect(result!.comments[0].children).toHaveLength(1);
      expect(result!.comments[0].children[0].id).toBe(12348);
    });

    it("returns null for missing item", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/item/99999.json`,
          response: { body: null as unknown as Record<string, unknown> },
        },
      ]);
      const client = new HNReadClient(fetch);
      const result = await client.getItemWithComments(99999, 2);
      expect(result).toBeNull();
    });

    it("respects depth limit", async () => {
      const fetch = createMockFetch([
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
      ]);
      const client = new HNReadClient(fetch);
      const result = await client.getItemWithComments(12345, 1);

      expect(result!.comments).toHaveLength(2);
      // Depth=1 means no children fetched
      expect(result!.comments[0].children).toHaveLength(0);
    });
  });

  describe("getUpdates", () => {
    it("returns recent updates", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/updates.json`,
          response: { body: SAMPLE_UPDATES },
        },
      ]);
      const client = new HNReadClient(fetch);
      const updates = await client.getUpdates();
      expect(updates).toEqual(SAMPLE_UPDATES);
    });

    it("returns empty on error", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/updates.json`,
          response: { status: 500, body: {} },
        },
      ]);
      const client = new HNReadClient(fetch);
      const updates = await client.getUpdates();
      expect(updates).toEqual({ items: [], profiles: [] });
    });
  });

  describe("search", () => {
    it("searches by relevance", async () => {
      const fetch = createMockFetch([
        {
          url: `${ALGOLIA_BASE}/search`,
          response: { body: SAMPLE_ALGOLIA_RESULT },
        },
      ]);
      const client = new HNReadClient(fetch);
      const result = await client.search({ query: "test" });
      expect(result.hits).toHaveLength(1);
      expect(result.nbHits).toBe(1);
    });

    it("searches by date", async () => {
      const fetch = createMockFetch([
        {
          url: `${ALGOLIA_BASE}/search_by_date`,
          response: { body: SAMPLE_ALGOLIA_RESULT },
        },
      ]);
      const client = new HNReadClient(fetch);
      const result = await client.search({ query: "test", sortBy: "date" });
      expect(result.hits).toHaveLength(1);
    });

    it("passes optional params", async () => {
      const fetch = createMockFetch([
        {
          url: `${ALGOLIA_BASE}/search`,
          response: { body: SAMPLE_ALGOLIA_RESULT },
        },
      ]);
      const client = new HNReadClient(fetch);
      await client.search({
        query: "test",
        tags: "story",
        page: 2,
        hitsPerPage: 10,
        numericFilters: "points>100",
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl).toContain("tags=story");
      expect(calledUrl).toContain("page=2");
      expect(calledUrl).toContain("hitsPerPage=10");
    });

    it("returns empty on error", async () => {
      const fetch = createMockFetch([
        { url: `${ALGOLIA_BASE}/search`, response: { status: 500, body: {} } },
      ]);
      const client = new HNReadClient(fetch);
      const result = await client.search({ query: "test" });
      expect(result.hits).toHaveLength(0);
      expect(result.nbHits).toBe(0);
    });
  });

  describe("network errors", () => {
    it("getItem throws on network failure", async () => {
      const fetch = createFailingFetch("Network error");
      const client = new HNReadClient(fetch);
      await expect(client.getItem(12345)).rejects.toThrow("Network error");
    });

    it("search throws on network failure", async () => {
      const fetch = createFailingFetch("Network error");
      const client = new HNReadClient(fetch);
      await expect(client.search({ query: "test" })).rejects.toThrow("Network error");
    });
  });

  describe("JSON parse error branches", () => {
    it("getItem returns null when response body is not valid JSON", async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new Error("Invalid JSON"); }
      });
      const client = new HNReadClient(fetch as any);
      const item = await client.getItem(12345);
      expect(item).toBeNull();
    });

    it("getUser returns null when response body is not valid JSON", async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new Error("Invalid JSON"); }
      });
      const client = new HNReadClient(fetch as any);
      const user = await client.getUser("pg");
      expect(user).toBeNull();
    });

    it("getStoryIds returns empty array when response body is not valid JSON", async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new Error("Invalid JSON"); }
      });
      const client = new HNReadClient(fetch as any);
      const ids = await client.getStoryIds("top");
      expect(ids).toEqual([]);
    });

    it("getUpdates returns empty on JSON parse error", async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new Error("Invalid JSON"); }
      });
      const client = new HNReadClient(fetch as any);
      const updates = await client.getUpdates();
      expect(updates).toEqual({ items: [], profiles: [] });
    });

    it("search returns empty on JSON parse error", async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new Error("Invalid JSON"); }
      });
      const client = new HNReadClient(fetch as any);
      const result = await client.search({ query: "test" });
      expect(result.hits).toHaveLength(0);
      expect(result.nbHits).toBe(0);
    });

    it("search returns empty on 404", async () => {
      const fetch = createMockFetch([
        {
          url: `${ALGOLIA_BASE}/search`,
          response: { status: 404, body: "not found" },
        },
      ]);
      const client = new HNReadClient(fetch);
      const result = await client.search({ query: "test" });
      expect(result.hits).toHaveLength(0);
      expect(result.nbHits).toBe(0);
    });

    it("getItem returns null on 404", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/item/12345.json`,
          response: { status: 404, body: "not found" },
        },
      ]);
      const client = new HNReadClient(fetch);
      const item = await client.getItem(12345);
      expect(item).toBeNull();
    });

    it("getUser returns null on 404", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/user/pg.json`,
          response: { status: 404, body: "not found" },
        },
      ]);
      const client = new HNReadClient(fetch);
      const user = await client.getUser("pg");
      expect(user).toBeNull();
    });

    it("getStoryIds returns empty array on 404", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/topstories.json`,
          response: { status: 404, body: "not found" },
        },
      ]);
      const client = new HNReadClient(fetch);
      const ids = await client.getStoryIds("top");
      expect(ids).toEqual([]);
    });

    it("getUpdates returns empty on 404", async () => {
      const fetch = createMockFetch([
        {
          url: `${HN_FIREBASE_BASE}/updates.json`,
          response: { status: 404, body: "not found" },
        },
      ]);
      const client = new HNReadClient(fetch);
      const updates = await client.getUpdates();
      expect(updates).toEqual({ items: [], profiles: [] });
    });
  });
});
