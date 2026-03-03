import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSearchAllRegistries = vi.fn();
const mockSearchSmithery = vi.fn();
const mockSearchOfficialRegistry = vi.fn();
const mockSearchGlama = vi.fn();

vi.mock("@/lib/mcp/services/registry-client", () => ({
  searchAllRegistries: mockSearchAllRegistries,
  searchSmithery: mockSearchSmithery,
  searchOfficialRegistry: mockSearchOfficialRegistry,
  searchGlama: mockSearchGlama,
}));

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock("node:fs", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const mocked = {
    ...actual,
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  };
  return { ...mocked, default: mocked };
});

vi.mock("node:path", async importOriginal => {
  const actual = await importOriginal<typeof import("node:path")>();
  const mocked = {
    ...actual,
    join: (...args: string[]) => args.join("/"),
  };
  return { ...mocked, default: mocked };
});

import { createMockRegistry, getText } from "../__test-utils__";
import { registerMcpRegistryTools } from "./mcp-registry";

const sampleServer = {
  id: "test-server",
  name: "Test Browser Server",
  description: "A test MCP server for browser automation",
  source: "smithery" as const,
  url: "https://example.com/mcp",
  transport: "stdio" as const,
  envVarsRequired: [],
  homepage: "https://example.com",
};

describe("mcp-registry tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerMcpRegistryTools(registry, userId);
  });

  it("should register 4 mcp-registry tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
  });

  describe("mcp_registry_search", () => {
    it("should return search results", async () => {
      mockSearchAllRegistries.mockResolvedValue([sampleServer]);
      const handler = registry.handlers.get("mcp_registry_search")!;
      const result = await handler({ query: "browser" });
      expect(getText(result)).toContain("Test Browser Server");
      expect(getText(result)).toContain("smithery");
      expect(getText(result)).toContain("MCP Servers Found (1)");
    });

    it("should return empty message when no results", async () => {
      mockSearchAllRegistries.mockResolvedValue([]);
      const handler = registry.handlers.get("mcp_registry_search")!;
      const result = await handler({ query: "nonexistent" });
      expect(getText(result)).toContain("No MCP servers found");
    });

    it("should pass limit parameter", async () => {
      mockSearchAllRegistries.mockResolvedValue([]);
      const handler = registry.handlers.get("mcp_registry_search")!;
      await handler({ query: "browser", limit: 5 });
      expect(mockSearchAllRegistries).toHaveBeenCalledWith("browser", 5);
    });

    it("should use default limit of 10", async () => {
      mockSearchAllRegistries.mockResolvedValue([]);
      const handler = registry.handlers.get("mcp_registry_search")!;
      await handler({ query: "browser" });
      expect(mockSearchAllRegistries).toHaveBeenCalledWith("browser", 10);
    });

    it("should show homepage when available", async () => {
      mockSearchAllRegistries.mockResolvedValue([sampleServer]);
      const handler = registry.handlers.get("mcp_registry_search")!;
      const result = await handler({ query: "browser" });
      expect(getText(result)).toContain("https://example.com");
    });

    it("should show transport type", async () => {
      mockSearchAllRegistries.mockResolvedValue([sampleServer]);
      const handler = registry.handlers.get("mcp_registry_search")!;
      const result = await handler({ query: "browser" });
      expect(getText(result)).toContain("stdio");
    });

    it("should omit homepage when not available", async () => {
      const serverNoHomepage = { ...sampleServer, homepage: "" };
      mockSearchAllRegistries.mockResolvedValue([serverNoHomepage]);
      const handler = registry.handlers.get("mcp_registry_search")!;
      const result = await handler({ query: "browser" });
      expect(getText(result)).toContain("Test Browser Server");
      expect(getText(result)).not.toContain("Homepage:");
    });
  });

  describe("mcp_registry_get", () => {
    it("should return server details from smithery", async () => {
      mockSearchSmithery.mockResolvedValue([sampleServer]);
      const handler = registry.handlers.get("mcp_registry_get")!;
      const result = await handler({
        serverId: "test-server",
        source: "smithery",
      });
      expect(getText(result)).toContain("Test Browser Server");
      expect(getText(result)).toContain("stdio");
    });

    it("should return NOT_FOUND for missing server", async () => {
      mockSearchSmithery.mockResolvedValue([]);
      const handler = registry.handlers.get("mcp_registry_get")!;
      const result = await handler({ serverId: "missing", source: "smithery" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should query official registry when source is official", async () => {
      mockSearchOfficialRegistry.mockResolvedValue([{
        ...sampleServer,
        source: "official",
      }]);
      const handler = registry.handlers.get("mcp_registry_get")!;
      await handler({ serverId: "test-server", source: "official" });
      expect(mockSearchOfficialRegistry).toHaveBeenCalled();
      expect(mockSearchSmithery).not.toHaveBeenCalled();
    });

    it("should query glama when source is glama", async () => {
      mockSearchGlama.mockResolvedValue([{ ...sampleServer, source: "glama" }]);
      const handler = registry.handlers.get("mcp_registry_get")!;
      await handler({ serverId: "test-server", source: "glama" });
      expect(mockSearchGlama).toHaveBeenCalled();
      expect(mockSearchSmithery).not.toHaveBeenCalled();
    });

    it("should show homepage when available", async () => {
      mockSearchSmithery.mockResolvedValue([sampleServer]);
      const handler = registry.handlers.get("mcp_registry_get")!;
      const result = await handler({
        serverId: "test-server",
        source: "smithery",
      });
      expect(getText(result)).toContain("Homepage:");
      expect(getText(result)).toContain("https://example.com");
    });

    it("should omit homepage when not available", async () => {
      const serverNoHomepage = { ...sampleServer, homepage: "" };
      mockSearchSmithery.mockResolvedValue([serverNoHomepage]);
      const handler = registry.handlers.get("mcp_registry_get")!;
      const result = await handler({
        serverId: "test-server",
        source: "smithery",
      });
      expect(getText(result)).not.toContain("Homepage:");
    });

    it("should show required env vars when present", async () => {
      const serverWithEnv = {
        ...sampleServer,
        envVarsRequired: ["API_KEY", "SECRET"],
      };
      mockSearchSmithery.mockResolvedValue([serverWithEnv]);
      const handler = registry.handlers.get("mcp_registry_get")!;
      const result = await handler({
        serverId: "test-server",
        source: "smithery",
      });
      expect(getText(result)).toContain("Required Env Vars:");
      expect(getText(result)).toContain("API_KEY, SECRET");
    });

    it("should omit env vars section when none required", async () => {
      mockSearchSmithery.mockResolvedValue([sampleServer]);
      const handler = registry.handlers.get("mcp_registry_get")!;
      const result = await handler({
        serverId: "test-server",
        source: "smithery",
      });
      expect(getText(result)).not.toContain("Required Env Vars:");
    });

    it("should return full details from official registry", async () => {
      const officialServer = { ...sampleServer, source: "official" as const };
      mockSearchOfficialRegistry.mockResolvedValue([officialServer]);
      const handler = registry.handlers.get("mcp_registry_get")!;
      const result = await handler({
        serverId: "test-server",
        source: "official",
      });
      expect(getText(result)).toContain("Test Browser Server");
      expect(getText(result)).toContain("official");
    });

    it("should return full details from glama", async () => {
      const glamaServer = { ...sampleServer, source: "glama" as const };
      mockSearchGlama.mockResolvedValue([glamaServer]);
      const handler = registry.handlers.get("mcp_registry_get")!;
      const result = await handler({
        serverId: "test-server",
        source: "glama",
      });
      expect(getText(result)).toContain("Test Browser Server");
      expect(getText(result)).toContain("glama");
    });
  });

  describe("mcp_registry_install", () => {
    it("should generate .mcp.json config", async () => {
      mockSearchSmithery.mockResolvedValue([sampleServer]);
      const handler = registry.handlers.get("mcp_registry_install")!;
      const result = await handler({
        serverId: "test-server",
        source: "smithery",
      });
      expect(getText(result)).toContain("MCP Server Configured");
      expect(getText(result)).toContain(".mcp.json");
      expect(getText(result)).toContain("Test Browser Server");
    });

    it("should include env vars in config", async () => {
      mockSearchSmithery.mockResolvedValue([sampleServer]);
      const handler = registry.handlers.get("mcp_registry_install")!;
      const result = await handler({
        serverId: "test-server",
        source: "smithery",
        envVars: { API_KEY: "test123" },
      });
      expect(getText(result)).toContain("API_KEY");
    });

    it("should return NOT_FOUND for missing server", async () => {
      mockSearchSmithery.mockResolvedValue([]);
      const handler = registry.handlers.get("mcp_registry_install")!;
      const result = await handler({ serverId: "missing", source: "smithery" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should query official registry when source is official", async () => {
      const officialServer = { ...sampleServer, source: "official" as const };
      mockSearchOfficialRegistry.mockResolvedValue([officialServer]);
      const handler = registry.handlers.get("mcp_registry_install")!;
      const result = await handler({
        serverId: "test-server",
        source: "official",
      });
      expect(mockSearchOfficialRegistry).toHaveBeenCalled();
      expect(mockSearchSmithery).not.toHaveBeenCalled();
      expect(getText(result)).toContain("MCP Server Configured");
    });

    it("should query glama when source is glama", async () => {
      const glamaServer = { ...sampleServer, source: "glama" as const };
      mockSearchGlama.mockResolvedValue([glamaServer]);
      const handler = registry.handlers.get("mcp_registry_install")!;
      const result = await handler({
        serverId: "test-server",
        source: "glama",
      });
      expect(mockSearchGlama).toHaveBeenCalled();
      expect(mockSearchSmithery).not.toHaveBeenCalled();
      expect(getText(result)).toContain("MCP Server Configured");
    });

    it("should omit env when envVars is empty object", async () => {
      mockSearchSmithery.mockResolvedValue([sampleServer]);
      const handler = registry.handlers.get("mcp_registry_install")!;
      const result = await handler({
        serverId: "test-server",
        source: "smithery",
        envVars: {},
      });
      expect(getText(result)).not.toContain("\"env\"");
    });

    it("should omit env when envVars is not provided", async () => {
      mockSearchSmithery.mockResolvedValue([sampleServer]);
      const handler = registry.handlers.get("mcp_registry_install")!;
      const result = await handler({
        serverId: "test-server",
        source: "smithery",
      });
      expect(getText(result)).not.toContain("\"env\"");
    });
  });

  describe("mcp_registry_list_installed", () => {
    it("should list installed servers", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        mcpServers: {
          "browser-server": { transport: "stdio", url: "https://example.com" },
        },
      }));

      const handler = registry.handlers.get("mcp_registry_list_installed")!;
      const result = await handler({});
      expect(getText(result)).toContain("browser-server");
      expect(getText(result)).toContain("Configured MCP Servers (1)");
    });

    it("should handle missing .mcp.json", async () => {
      mockExistsSync.mockReturnValue(false);

      const handler = registry.handlers.get("mcp_registry_list_installed")!;
      const result = await handler({});
      expect(getText(result)).toContain("No .mcp.json found");
    });

    it("should handle empty server list", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ mcpServers: {} }));

      const handler = registry.handlers.get("mcp_registry_list_installed")!;
      const result = await handler({});
      expect(getText(result)).toContain("No MCP servers configured");
    });

    it("should fallback to root config when mcpServers key is absent", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        "my-server": { transport: "sse", url: "https://my.server.com" },
      }));

      const handler = registry.handlers.get("mcp_registry_list_installed")!;
      const result = await handler({});
      expect(getText(result)).toContain("my-server");
      expect(getText(result)).toContain("sse");
      expect(getText(result)).toContain("https://my.server.com");
    });

    it("should handle server entry without url", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        mcpServers: { "local-server": { transport: "stdio" } },
      }));

      const handler = registry.handlers.get("mcp_registry_list_installed")!;
      const result = await handler({});
      expect(getText(result)).toContain("local-server");
      expect(getText(result)).toContain("stdio");
      expect(getText(result)).not.toContain("url=");
    });

    it("should handle server entry with missing transport", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        mcpServers: { "bare-server": {} },
      }));

      const handler = registry.handlers.get("mcp_registry_list_installed")!;
      const result = await handler({});
      expect(getText(result)).toContain("bare-server");
      expect(getText(result)).toContain("unknown");
    });
  });
});
