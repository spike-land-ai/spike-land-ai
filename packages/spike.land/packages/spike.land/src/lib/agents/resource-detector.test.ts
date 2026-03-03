import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockReadFile = vi.hoisted(() => vi.fn());

vi.mock("@/lib/try-catch", () => ({
  tryCatch: async (promise: Promise<unknown>) => {
    try {
      const data = await promise;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

vi.mock("fs/promises", () => {
  const mocked = { readFile: mockReadFile };
  return { ...mocked, default: mocked };
});

import { detectResources } from "./resource-detector";

describe("resource-detector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PORT", "3000");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("JULES_API_KEY", "jules-key");
    vi.stubEnv("GH_PAT_TOKEN", "gh-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("detectResources", () => {
    it("should return all resource statuses", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          mcpServers: {
            vitest: { type: "stdio" },
            playwright: { type: "sse" },
          },
        }),
      );

      const result = await detectResources();

      expect(result.devServer).toBeDefined();
      expect(result.mcpServers).toBeDefined();
      expect(result.database).toBeDefined();
      expect(result.environment).toBeDefined();
    });
  });

  describe("checkDevServer (via detectResources)", () => {
    it("should detect running in development", async () => {
      mockReadFile.mockRejectedValue(new Error("no file"));

      const result = await detectResources();

      expect(result.devServer.running).toBe(true);
      expect(result.devServer.port).toBe(3000);
      expect(result.devServer.url).toBe("http://localhost:3000");
    });

    it("should return not running in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockReadFile.mockRejectedValue(new Error("no file"));

      const result = await detectResources();

      expect(result.devServer.running).toBe(false);
      expect(result.devServer.port).toBeNull();
      expect(result.devServer.url).toBeNull();
    });
  });

  describe("getMcpServers (via detectResources)", () => {
    it("should parse valid .mcp.json", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          mcpServers: {
            vitest: { type: "stdio", command: "vitest" },
            playwright: { type: "sse" },
          },
        }),
      );

      const result = await detectResources();

      expect(result.mcpServers).toHaveLength(2);
      expect(result.mcpServers[0]!.name).toBe("vitest");
      expect(result.mcpServers[0]!.type).toBe("stdio");
      expect(result.mcpServers[1]!.name).toBe("playwright");
      expect(result.mcpServers[1]!.type).toBe("sse");
    });

    it("should handle missing .mcp.json file", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const result = await detectResources();

      expect(result.mcpServers).toEqual([]);
    });

    it("should handle invalid JSON in .mcp.json", async () => {
      mockReadFile.mockResolvedValue("not valid json {{{");

      const result = await detectResources();

      expect(result.mcpServers).toEqual([]);
    });
  });

  describe("checkDatabase (via detectResources)", () => {
    it("should detect DATABASE_URL presence", async () => {
      mockReadFile.mockRejectedValue(new Error("no file"));

      const result = await detectResources();

      expect(result.database.connected).toBe(true);
      expect(result.database.provider).toBe("postgresql");
    });

    it("should detect missing DATABASE_URL", async () => {
      vi.stubEnv("DATABASE_URL", "");
      mockReadFile.mockRejectedValue(new Error("no file"));

      const result = await detectResources();

      expect(result.database.connected).toBe(false);
    });
  });

  describe("checkEnvironment (via detectResources)", () => {
    it("should detect NODE_ENV, JULES_API_KEY, GH_PAT_TOKEN", async () => {
      mockReadFile.mockRejectedValue(new Error("no file"));

      const result = await detectResources();

      expect(result.environment.nodeEnv).toBe("development");
      expect(result.environment.julesConfigured).toBe(true);
      expect(result.environment.githubConfigured).toBe(true);
    });

    it("should detect missing optional env vars", async () => {
      vi.stubEnv("JULES_API_KEY", "");
      vi.stubEnv("GH_PAT_TOKEN", "");
      mockReadFile.mockRejectedValue(new Error("no file"));

      const result = await detectResources();

      expect(result.environment.julesConfigured).toBe(false);
      expect(result.environment.githubConfigured).toBe(false);
    });
  });
});
