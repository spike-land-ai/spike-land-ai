import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("@/lib/upstash/client", () => ({
  redis: mockRedis,
}));

vi.mock("../constants", () => ({
  SMITHERY_API_BASE: "https://smithery.test/api/v1",
  OFFICIAL_MCP_REGISTRY_BASE: "https://official.test/v0.1/servers",
  GLAMA_API_BASE: "https://glama.test/api/mcp/v1/servers",
  MCP_REGISTRY_CACHE_TTL: 3600,
  MCP_REGISTRY_CACHE_PREFIX: "mcp-registry:",
}));

const mockFetch = vi.hoisted(() => vi.fn());

import {
  searchAllRegistries,
  searchGlama,
  searchOfficialRegistry,
  searchSmithery,
} from "./registry-client";

describe("registry-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("searchSmithery", () => {
    it("should return cached results on cache hit", async () => {
      const cachedData = [
        {
          id: "cached-server",
          name: "Cached Server",
          description: "from cache",
          source: "smithery",
          url: "https://smithery.ai/server/cached-server",
          transport: "stdio",
          envVarsRequired: [],
        },
      ];
      mockRedis.get.mockResolvedValue(cachedData);

      const results = await searchSmithery("test", 5);

      expect(results).toEqual(cachedData);
      expect(mockRedis.get).toHaveBeenCalledWith("mcp-registry:smithery:test:5");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should fetch from API on cache miss and cache the results", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          servers: [
            {
              qualifiedName: "org/my-server",
              displayName: "My Server",
              description: "A test server",
              homepage: "https://example.com",
              connections: [{ type: "sse" }],
            },
          ],
        }),
      });

      const results = await searchSmithery("test", 5);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://smithery.test/api/v1/servers?q=test&limit=5",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: "org/my-server",
        name: "My Server",
        description: "A test server",
        source: "smithery",
        url: "https://smithery.ai/server/org/my-server",
        transport: "sse",
        envVarsRequired: [],
        homepage: "https://example.com",
      });

      expect(mockRedis.set).toHaveBeenCalledWith("mcp-registry:smithery:test:5", results, {
        ex: 3600,
      });
    });

    it("should include Authorization header when SMITHERY_API_KEY is set", async () => {
      mockRedis.get.mockResolvedValue(null);
      vi.stubEnv("SMITHERY_API_KEY", "test-key-123");

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ servers: [] }),
      });

      await searchSmithery("test", 5);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-key-123",
          }),
        }),
      );
    });

    it("should not include Authorization header when SMITHERY_API_KEY is not set", async () => {
      mockRedis.get.mockResolvedValue(null);
      delete process.env.SMITHERY_API_KEY;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ servers: [] }),
      });

      await searchSmithery("test", 5);

      const callArgs = mockFetch.mock.calls[0]![1] as {
        headers: Record<string, string>;
      };
      expect(callArgs.headers.Authorization).toBeUndefined();
    });

    it("should return empty array when API returns non-ok response", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const results = await searchSmithery("test", 5);

      expect(results).toEqual([]);
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it("should default transport to stdio when no connections provided", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          servers: [
            {
              qualifiedName: "bare-server",
              displayName: "Bare Server",
              description: "No connections",
            },
          ],
        }),
      });

      const results = await searchSmithery("test", 5);

      expect(results[0]!.transport).toBe("stdio");
    });

    it("should handle missing description gracefully", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          servers: [
            {
              qualifiedName: "no-desc",
              displayName: "No Desc",
            },
          ],
        }),
      });

      const results = await searchSmithery("test", 5);

      expect(results[0]!.description).toBe("");
    });

    it("should handle empty servers array from API", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ servers: [] }),
      });

      const results = await searchSmithery("test", 5);

      expect(results).toEqual([]);
    });

    it("should handle missing servers field from API", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const results = await searchSmithery("test", 5);

      expect(results).toEqual([]);
    });

    it("should return empty array when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      const result = await searchSmithery("query", 10);
      expect(result).toEqual([]);
    });

    it("should encode query parameter", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ servers: [] }),
      });

      await searchSmithery("hello world", 10);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://smithery.test/api/v1/servers?q=hello%20world&limit=10",
        expect.any(Object),
      );
    });
  });

  describe("searchOfficialRegistry", () => {
    it("should return cached results on cache hit", async () => {
      const cachedData = [
        {
          id: "official-cached",
          name: "Official Cached",
          description: "from cache",
          source: "official",
          url: "https://example.com",
          transport: "stdio",
          envVarsRequired: [],
        },
      ];
      mockRedis.get.mockResolvedValue(cachedData);

      const results = await searchOfficialRegistry("test", 5);

      expect(results).toEqual(cachedData);
      expect(mockRedis.get).toHaveBeenCalledWith("mcp-registry:official:test:5");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should fetch from API on cache miss and cache results", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          servers: [
            {
              id: "server-1",
              name: "Official Server",
              description: "An official server",
              url: "https://server.test",
              transport: "streamable-http",
            },
          ],
        }),
      });

      const results = await searchOfficialRegistry("test", 10);

      expect(mockFetch).toHaveBeenCalledWith("https://official.test/v0.1/servers?q=test&count=10");

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: "server-1",
        name: "Official Server",
        description: "An official server",
        source: "official",
        url: "https://server.test",
        transport: "streamable-http",
        envVarsRequired: [],
      });

      expect(mockRedis.set).toHaveBeenCalledWith("mcp-registry:official:test:10", results, {
        ex: 3600,
      });
    });

    it("should return empty array on API error", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
      });

      const results = await searchOfficialRegistry("test", 5);

      expect(results).toEqual([]);
    });

    it("should default transport to stdio and url to empty string when missing", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          servers: [
            {
              id: "bare",
              name: "Bare",
              description: "No transport or url",
            },
          ],
        }),
      });

      const results = await searchOfficialRegistry("test", 5);

      expect(results[0]!.transport).toBe("stdio");
      expect(results[0]!.url).toBe("");
    });

    it("should handle missing description gracefully", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          servers: [{ id: "x", name: "X" }],
        }),
      });

      const results = await searchOfficialRegistry("test", 5);

      expect(results[0]!.description).toBe("");
    });

    it("should handle missing servers field from API", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const results = await searchOfficialRegistry("test", 5);

      expect(results).toEqual([]);
    });
  });

  describe("searchGlama", () => {
    it("should return cached results on cache hit", async () => {
      const cachedData = [
        {
          id: "glama-cached",
          name: "Glama Cached",
          description: "from cache",
          source: "glama",
          url: "https://glama.test",
          transport: "stdio",
          envVarsRequired: [],
          stars: 100,
        },
      ];
      mockRedis.get.mockResolvedValue(cachedData);

      const results = await searchGlama("test", 5);

      expect(results).toEqual(cachedData);
      expect(mockRedis.get).toHaveBeenCalledWith("mcp-registry:glama:test:5");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should fetch from API on cache miss and cache results", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          servers: [
            {
              id: "glama-1",
              name: "Glama Server",
              description: "A Glama server",
              url: "https://glama-server.test",
              transport: "sse",
              stars: 42,
            },
          ],
        }),
      });

      const results = await searchGlama("query", 3);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://glama.test/api/mcp/v1/servers?search=query&limit=3",
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: "glama-1",
        name: "Glama Server",
        description: "A Glama server",
        source: "glama",
        url: "https://glama-server.test",
        transport: "sse",
        envVarsRequired: [],
        stars: 42,
      });

      expect(mockRedis.set).toHaveBeenCalledWith("mcp-registry:glama:query:3", results, {
        ex: 3600,
      });
    });

    it("should return empty array on API error", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
      });

      const results = await searchGlama("test", 5);

      expect(results).toEqual([]);
    });

    it("should default transport to stdio and url to empty string when missing", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          servers: [
            {
              id: "bare",
              name: "Bare",
              description: "No transport or url",
            },
          ],
        }),
      });

      const results = await searchGlama("test", 5);

      expect(results[0]!.transport).toBe("stdio");
      expect(results[0]!.url).toBe("");
    });

    it("should include stars when present", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          servers: [
            {
              id: "starred",
              name: "Starred",
              description: "popular",
              stars: 999,
            },
          ],
        }),
      });

      const results = await searchGlama("test", 5);

      expect(results[0]!.stars).toBe(999);
    });

    it("should handle missing description gracefully", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          servers: [{ id: "x", name: "X" }],
        }),
      });

      const results = await searchGlama("test", 5);

      expect(results[0]!.description).toBe("");
    });

    it("should handle missing servers field from API", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const results = await searchGlama("test", 5);

      expect(results).toEqual([]);
    });
  });

  describe("searchAllRegistries", () => {
    it("should combine results from all three registries", async () => {
      // All caches miss
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      // Set up three different API responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            servers: [
              {
                qualifiedName: "smithery/s1",
                displayName: "Smithery One",
                description: "from smithery",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            servers: [
              {
                id: "official-1",
                name: "Official One",
                description: "from official",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            servers: [
              {
                id: "glama-1",
                name: "Glama One",
                description: "from glama",
              },
            ],
          }),
        });

      const results = await searchAllRegistries("test", 10);

      expect(results).toHaveLength(3);
      expect(results.map((r) => r.source)).toEqual(["smithery", "official", "glama"]);
    });

    it("should deduplicate by name (case-insensitive)", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            servers: [
              {
                qualifiedName: "s1",
                displayName: "Duplicate Server",
                description: "from smithery",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            servers: [
              {
                id: "o1",
                name: "duplicate server",
                description: "from official",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            servers: [
              {
                id: "g1",
                name: "DUPLICATE SERVER",
                description: "from glama",
              },
            ],
          }),
        });

      const results = await searchAllRegistries("test", 10);

      // Should keep only the first occurrence (from smithery)
      expect(results).toHaveLength(1);
      expect(results[0]!.source).toBe("smithery");
      expect(results[0]!.name).toBe("Duplicate Server");
    });

    it("should handle partial failures gracefully", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      // Smithery succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            servers: [
              {
                qualifiedName: "s1",
                displayName: "Working Server",
                description: "ok",
              },
            ],
          }),
        })
        // Official fails completely
        .mockRejectedValueOnce(new Error("Network error"))
        // Glama succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            servers: [
              {
                id: "g1",
                name: "Glama Server",
                description: "ok",
              },
            ],
          }),
        });

      const results = await searchAllRegistries("test", 10);

      // Should still return results from smithery and glama
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.source)).toContain("smithery");
      expect(results.map((r) => r.source)).toContain("glama");
    });

    it("should respect the limit parameter", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            servers: [
              {
                qualifiedName: "s1",
                displayName: "Server A",
                description: "a",
              },
              {
                qualifiedName: "s2",
                displayName: "Server B",
                description: "b",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            servers: [
              { id: "o1", name: "Server C", description: "c" },
              { id: "o2", name: "Server D", description: "d" },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            servers: [{ id: "g1", name: "Server E", description: "e" }],
          }),
        });

      const results = await searchAllRegistries("test", 3);

      expect(results).toHaveLength(3);
    });

    it("should return empty array when all registries fail", async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch
        .mockRejectedValueOnce(new Error("Smithery down"))
        .mockRejectedValueOnce(new Error("Official down"))
        .mockRejectedValueOnce(new Error("Glama down"));

      const results = await searchAllRegistries("test", 10);

      expect(results).toEqual([]);
    });

    it("should handle all registries returning non-ok responses", async () => {
      mockRedis.get.mockResolvedValue(null);

      const errorResponse = {
        ok: false,
        status: 500,
      };

      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse);

      const results = await searchAllRegistries("test", 10);

      expect(results).toEqual([]);
    });

    it("should keep first duplicate and discard later ones", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            servers: [
              {
                qualifiedName: "s/unique",
                displayName: "UniqueFromSmithery",
                description: "smithery version",
              },
              {
                qualifiedName: "s/shared",
                displayName: "SharedServer",
                description: "smithery shared",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            servers: [
              {
                id: "o/shared",
                name: "sharedserver",
                description: "official shared",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ servers: [] }),
        });

      const results = await searchAllRegistries("test", 10);

      expect(results).toHaveLength(2);
      // "SharedServer" from smithery should be kept, "sharedserver" from official discarded
      const shared = results.find((r) => r.name.toLowerCase() === "sharedserver");
      expect(shared?.source).toBe("smithery");
    });
  });
});
