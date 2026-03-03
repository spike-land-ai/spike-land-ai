import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Settings mocks ──

const mockPrisma = vi.hoisted(() => ({
  apiKey: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const mockCreateApiKey = vi.fn();
const mockRevokeApiKey = vi.fn();

vi.mock("@/lib/mcp/api-key-manager", () => ({
  createApiKey: mockCreateApiKey,
  revokeApiKey: mockRevokeApiKey,
}));

// ── Environment mocks ──

const { mockGetAllConfigs, mockGetEnvConfig, mockCheckHealth } = vi.hoisted(
  () => ({
    mockGetAllConfigs: vi.fn(),
    mockGetEnvConfig: vi.fn(),
    mockCheckHealth: vi.fn(),
  }),
);

vi.mock("@/lib/dashboard/environments", () => ({
  getAllEnvironmentConfigs: mockGetAllConfigs,
  getEnvironmentConfig: mockGetEnvConfig,
  checkEnvironmentHealth: mockCheckHealth,
}));

import { createMockRegistry, getText } from "../__test-utils__";
import {
  registerEnvironmentTools,
  registerSettingsTools,
} from "./configuration-tools";

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Settings tools ──

describe("settings tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerSettingsTools(registry, userId);
  });

  it("should register 5 settings tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
  });

  describe("settings_list_api_keys", () => {
    it("should list API keys", async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([
        {
          id: "key-1",
          name: "Production Key",
          keyPrefix: "sk_live_abc",
          isActive: true,
          lastUsedAt: new Date("2024-06-01"),
          createdAt: new Date("2024-01-01"),
        },
        {
          id: "key-2",
          name: "Dev Key",
          keyPrefix: "sk_dev_xyz",
          isActive: false,
          lastUsedAt: null,
          createdAt: new Date("2024-02-01"),
        },
      ]);
      const handler = registry.handlers.get("settings_list_api_keys")!;
      const result = await handler({});
      expect(getText(result)).toContain("API Keys (2)");
      expect(getText(result)).toContain("Production Key");
      expect(getText(result)).toContain("Active");
      expect(getText(result)).toContain("sk_live_abc");
      expect(getText(result)).toContain("Dev Key");
      expect(getText(result)).toContain("Revoked");
      expect(getText(result)).toContain("never");
    });

    it("should return empty message when no API keys", async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("settings_list_api_keys")!;
      const result = await handler({});
      expect(getText(result)).toContain("No API keys found");
    });

    it("should show last used date when available", async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([
        {
          id: "key-1",
          name: "Used Key",
          keyPrefix: "sk_live_used",
          isActive: true,
          lastUsedAt: new Date("2024-06-15T12:00:00Z"),
          createdAt: new Date("2024-01-01"),
        },
      ]);
      const handler = registry.handlers.get("settings_list_api_keys")!;
      const result = await handler({});
      expect(getText(result)).toContain("2024-06-15");
    });
  });

  describe("settings_create_api_key", () => {
    it("should create API key and show full key", async () => {
      mockCreateApiKey.mockResolvedValue({
        id: "key-new",
        name: "My New Key",
        key: "sk_live_full_secret_key_12345",
        keyPrefix: "sk_live_ful",
        createdAt: new Date("2024-06-01"),
      });
      const handler = registry.handlers.get("settings_create_api_key")!;
      const result = await handler({ name: "My New Key" });
      expect(getText(result)).toContain("API Key Created");
      expect(getText(result)).toContain("key-new");
      expect(getText(result)).toContain("My New Key");
      expect(getText(result)).toContain("sk_live_full_secret_key_12345");
      expect(getText(result)).toContain("sk_live_ful");
      expect(getText(result)).toContain("IMPORTANT");
      expect(getText(result)).toContain("not be shown again");
      expect(mockCreateApiKey).toHaveBeenCalledWith(userId, "My New Key");
    });

    it("should trim whitespace from name", async () => {
      mockCreateApiKey.mockResolvedValue({
        id: "key-trimmed",
        name: "Trimmed Key",
        key: "sk_live_trimmed_key",
        keyPrefix: "sk_live_tri",
        createdAt: new Date(),
      });
      const handler = registry.handlers.get("settings_create_api_key")!;
      await handler({ name: "  Trimmed Key  " });
      expect(mockCreateApiKey).toHaveBeenCalledWith(userId, "Trimmed Key");
    });
  });

  describe("settings_revoke_api_key", () => {
    it("should revoke API key successfully", async () => {
      mockRevokeApiKey.mockResolvedValue({ success: true });
      const handler = registry.handlers.get("settings_revoke_api_key")!;
      const result = await handler({ key_id: "key-1" });
      expect(getText(result)).toContain("API Key Revoked");
      expect(getText(result)).toContain("key-1");
      expect(mockRevokeApiKey).toHaveBeenCalledWith(userId, "key-1");
    });

    it("should return NOT_FOUND when key does not exist", async () => {
      mockRevokeApiKey.mockResolvedValue({
        success: false,
        error: "API key not found",
      });
      const handler = registry.handlers.get("settings_revoke_api_key")!;
      const result = await handler({ key_id: "nonexistent" });
      expect(getText(result)).toContain("NOT_FOUND");
      expect(getText(result)).toContain("API key not found");
    });

    it("should return error when key is already revoked", async () => {
      mockRevokeApiKey.mockResolvedValue({
        success: false,
        error: "API key is already revoked",
      });
      const handler = registry.handlers.get("settings_revoke_api_key")!;
      const result = await handler({ key_id: "key-revoked" });
      expect(getText(result)).toContain("NOT_FOUND");
      expect(getText(result)).toContain("already revoked");
    });

    it("should use default error message when error is undefined", async () => {
      mockRevokeApiKey.mockResolvedValue({ success: false });
      const handler = registry.handlers.get("settings_revoke_api_key")!;
      const result = await handler({ key_id: "key-unknown" });
      expect(getText(result)).toContain("NOT_FOUND");
      expect(getText(result)).toContain("API key not found");
    });
  });

  describe("settings_mcp_history", () => {
    it("should list MCP job history", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jobs: [
              {
                id: "job-1",
                type: "GENERATE",
                status: "COMPLETED",
                prompt: "A cute cat",
                tokensCost: 100,
                createdAt: "2025-01-01T00:00:00Z",
              },
            ],
            total: 1,
            hasMore: false,
          }),
      });

      const handler = registry.handlers.get("settings_mcp_history")!;
      const result = await handler({ limit: 12, offset: 0 });
      const text = getText(result);
      expect(text).toContain("MCP History");
      expect(text).toContain("1 of 1");
      expect(text).toContain("GENERATE");
      expect(text).toContain("COMPLETED");
      expect(text).toContain("100 tokens");
      expect(text).toContain("A cute cat");
      expect(text).toContain("job-1");
    });

    it("should show empty message when no jobs", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jobs: [],
            total: 0,
            hasMore: false,
          }),
      });

      const handler = registry.handlers.get("settings_mcp_history")!;
      const result = await handler({ limit: 12, offset: 0 });
      expect(getText(result)).toContain("No jobs found");
    });

    it("should show pagination hint when hasMore is true", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jobs: [
              {
                id: "job-1",
                type: "MODIFY",
                status: "COMPLETED",
                prompt: "Edit this image",
                tokensCost: 50,
                createdAt: "2025-01-01T00:00:00Z",
              },
            ],
            total: 25,
            hasMore: true,
          }),
      });

      const handler = registry.handlers.get("settings_mcp_history")!;
      const result = await handler({ limit: 12, offset: 0 });
      const text = getText(result);
      expect(text).toContain("More results available");
      expect(text).toContain("offset=12");
    });

    it("should show pagination hint with default offset when hasMore and no offset provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jobs: [
              {
                id: "job-pg",
                type: "GENERATE",
                status: "COMPLETED",
                prompt: "Test",
                tokensCost: 10,
                createdAt: "2025-01-01T00:00:00Z",
              },
            ],
            total: 50,
            hasMore: true,
          }),
      });

      const handler = registry.handlers.get("settings_mcp_history")!;
      // Call with no offset to trigger (offset ?? 0) + (limit ?? 12)
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("More results available");
      expect(text).toContain("offset=12"); // 0 + 12
    });

    it("should use default limit and offset when not provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jobs: [
              {
                id: "job-default",
                type: "GENERATE",
                status: "COMPLETED",
                prompt: "Test prompt",
                tokensCost: 50,
                createdAt: "2025-01-01T00:00:00Z",
              },
            ],
            total: 1,
            hasMore: false,
          }),
      });

      const handler = registry.handlers.get("settings_mcp_history")!;
      // Call without explicit limit/offset to exercise the ?? fallbacks
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("MCP History");
      expect(text).toContain("job-default");
    });

    it("should filter by type when provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jobs: [],
            total: 0,
            hasMore: false,
          }),
      });

      const handler = registry.handlers.get("settings_mcp_history")!;
      await handler({ type: "GENERATE", limit: 12, offset: 0 });

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain("type=GENERATE");
    });

    it("should truncate long prompts", async () => {
      const longPrompt = "A".repeat(200);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jobs: [
              {
                id: "job-long",
                type: "GENERATE",
                status: "COMPLETED",
                prompt: longPrompt,
                tokensCost: 100,
                createdAt: "2025-01-01T00:00:00Z",
              },
            ],
            total: 1,
            hasMore: false,
          }),
      });

      const handler = registry.handlers.get("settings_mcp_history")!;
      const result = await handler({ limit: 12, offset: 0 });
      const text = getText(result);
      expect(text).toContain("...");
      expect(text).not.toContain("A".repeat(200));
    });
  });

  describe("settings_mcp_job_detail", () => {
    it("should show full job detail", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "job-detail-1",
            type: "GENERATE",
            status: "COMPLETED",
            prompt: "A scenic landscape",
            tokensCost: 200,
            tier: "TIER_1",
            createdAt: "2025-01-01T00:00:00Z",
            processingCompletedAt: "2025-01-01T00:01:00Z",
            outputImageUrl: "https://example.com/image.png",
            outputWidth: 1024,
            outputHeight: 768,
            apiKeyName: "My Key",
          }),
      });

      const handler = registry.handlers.get("settings_mcp_job_detail")!;
      const result = await handler({ job_id: "job-detail-1" });
      const text = getText(result);
      expect(text).toContain("MCP Job Detail");
      expect(text).toContain("job-detail-1");
      expect(text).toContain("GENERATE");
      expect(text).toContain("COMPLETED");
      expect(text).toContain("TIER_1");
      expect(text).toContain("200");
      expect(text).toContain("A scenic landscape");
      expect(text).toContain("https://example.com/image.png");
      expect(text).toContain("1024x768");
      expect(text).toContain("Completed:");
      expect(text).toContain("My Key");
    });

    it("should handle job without optional fields", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "job-minimal",
            type: "MODIFY",
            status: "PROCESSING",
            prompt: "Fix colors",
            tokensCost: 50,
            tier: "TIER_2",
            createdAt: "2025-01-01T00:00:00Z",
          }),
      });

      const handler = registry.handlers.get("settings_mcp_job_detail")!;
      const result = await handler({ job_id: "job-minimal" });
      const text = getText(result);
      expect(text).toContain("MCP Job Detail");
      expect(text).toContain("job-minimal");
      expect(text).not.toContain("Output:");
      expect(text).not.toContain("Dimensions:");
      expect(text).not.toContain("Completed:");
      expect(text).not.toContain("API Key:");
    });
  });
});

// ── Environment tools ──

describe("environment tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    registry = createMockRegistry();
    registerEnvironmentTools(registry, userId);
  });

  it("should register 3 environment tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("env_list")).toBe(true);
    expect(registry.handlers.has("env_status")).toBe(true);
    expect(registry.handlers.has("env_compare")).toBe(true);
  });

  describe("env_list", () => {
    it("should list all environment configs", async () => {
      mockGetAllConfigs.mockReturnValue([
        {
          name: "dev",
          url: "http://localhost:3000",
          healthEndpoint: "http://localhost:3000/api/health",
        },
        {
          name: "prod",
          url: "https://spike.land",
          healthEndpoint: "https://spike.land/api/health",
        },
      ]);
      const handler = registry.handlers.get("env_list")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("dev");
      expect(text).toContain("prod");
      expect(text).toContain("localhost:3000");
      expect(text).toContain("spike.land");
    });
  });

  describe("env_status", () => {
    it("should return environment health status", async () => {
      const config = {
        name: "prod",
        url: "https://spike.land",
        healthEndpoint: "https://spike.land/api/health",
      };
      mockGetEnvConfig.mockReturnValue(config);
      mockCheckHealth.mockResolvedValue({
        name: "prod",
        url: "https://spike.land",
        status: "healthy",
        version: "1.2.3",
        commitSha: "abc1234",
        lastDeployedAt: new Date("2026-01-01"),
      });
      const handler = registry.handlers.get("env_status")!;
      const result = await handler({ name: "prod" });
      const text = getText(result);
      expect(text).toContain("prod");
      expect(text).toContain("healthy");
      expect(text).toContain("1.2.3");
      expect(text).toContain("abc1234");
    });

    it("should return not found for unknown environment", async () => {
      mockGetEnvConfig.mockReturnValue(undefined);
      const handler = registry.handlers.get("env_status")!;
      const result = await handler({ name: "dev" });
      expect(getText(result)).toContain("not found");
    });

    it("should handle environment with unknown version", async () => {
      const config = {
        name: "dev",
        url: "http://localhost:3000",
        healthEndpoint: "http://localhost:3000/api/health",
      };
      mockGetEnvConfig.mockReturnValue(config);
      mockCheckHealth.mockResolvedValue({
        name: "dev",
        url: "http://localhost:3000",
        status: "down",
        version: null,
        commitSha: null,
        lastDeployedAt: null,
      });
      const handler = registry.handlers.get("env_status")!;
      const result = await handler({ name: "dev" });
      const text = getText(result);
      expect(text).toContain("down");
      expect(text).toContain("unknown");
    });
  });

  describe("env_compare", () => {
    it("should compare two environments", async () => {
      const devConfig = {
        name: "dev",
        url: "http://localhost:3000",
        healthEndpoint: "http://localhost:3000/api/health",
      };
      const prodConfig = {
        name: "prod",
        url: "https://spike.land",
        healthEndpoint: "https://spike.land/api/health",
      };
      mockGetEnvConfig.mockImplementation((name: string) => {
        if (name === "dev") return devConfig;
        if (name === "prod") return prodConfig;
        return undefined;
      });
      mockCheckHealth.mockImplementation((config: { name: string; }) => {
        if (config.name === "dev") {
          return Promise.resolve({
            name: "dev",
            status: "healthy",
            version: "1.2.3",
            commitSha: "abc1234",
            lastDeployedAt: null,
          });
        }
        return Promise.resolve({
          name: "prod",
          status: "healthy",
          version: "1.2.3",
          commitSha: "abc1234",
          lastDeployedAt: new Date("2026-01-01"),
        });
      });
      const handler = registry.handlers.get("env_compare")!;
      const result = await handler({ env_a: "dev", env_b: "prod" });
      const text = getText(result);
      expect(text).toContain("dev vs prod");
      expect(text).toContain("Version match: YES");
      expect(text).toContain("Commit match: YES");
    });

    it("should show NO when versions differ", async () => {
      const devConfig = {
        name: "dev",
        url: "http://localhost:3000",
        healthEndpoint: "http://localhost:3000/api/health",
      };
      const prodConfig = {
        name: "prod",
        url: "https://spike.land",
        healthEndpoint: "https://spike.land/api/health",
      };
      mockGetEnvConfig.mockImplementation((name: string) => {
        if (name === "dev") return devConfig;
        if (name === "prod") return prodConfig;
        return undefined;
      });
      mockCheckHealth.mockImplementation((config: { name: string; }) => {
        if (config.name === "dev") {
          return Promise.resolve({
            name: "dev",
            status: "healthy",
            version: "1.2.4",
            commitSha: "def5678",
            lastDeployedAt: null,
          });
        }
        return Promise.resolve({
          name: "prod",
          status: "healthy",
          version: "1.2.3",
          commitSha: "abc1234",
          lastDeployedAt: null,
        });
      });
      const handler = registry.handlers.get("env_compare")!;
      const result = await handler({ env_a: "dev", env_b: "prod" });
      const text = getText(result);
      expect(text).toContain("Version match: NO");
      expect(text).toContain("Commit match: NO");
    });

    it("should return not found for unknown env_a", async () => {
      mockGetEnvConfig.mockReturnValue(undefined);
      const handler = registry.handlers.get("env_compare")!;
      const result = await handler({ env_a: "dev", env_b: "prod" });
      expect(getText(result)).toContain("not found");
    });

    it("should return not found for unknown env_b", async () => {
      mockGetEnvConfig.mockImplementation((name: string) => {
        if (name === "dev") {
          return {
            name: "dev",
            url: "http://localhost:3000",
            healthEndpoint: "http://localhost:3000/api/health",
          };
        }
        return undefined;
      });
      const handler = registry.handlers.get("env_compare")!;
      const result = await handler({ env_a: "dev", env_b: "prod" });
      expect(getText(result)).toContain("not found");
    });
  });

  describe("requireAdminRole", () => {
    it("should deny access when user has USER role", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      mockGetAllConfigs.mockReturnValue([]);
      const handler = registry.handlers.get("env_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });

    it("should deny access when user is not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockGetAllConfigs.mockReturnValue([]);
      const handler = registry.handlers.get("env_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });

    it("should allow SUPER_ADMIN role", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "SUPER_ADMIN" });
      mockGetAllConfigs.mockReturnValue([]);
      const handler = registry.handlers.get("env_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("Environments (0)");
    });

    it("should check admin role on every environment tool handler", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const toolNames = ["env_list", "env_status", "env_compare"];
      for (const toolName of toolNames) {
        const handler = registry.handlers.get(toolName)!;
        const result = await handler({});
        expect(getText(result)).toContain("PERMISSION_DENIED");
      }
    });
  });

  describe("env_compare - null fields", () => {
    it("should show '?' for null version, commitSha, and lastDeployedAt", async () => {
      const devConfig = {
        name: "dev",
        url: "http://localhost:3000",
        healthEndpoint: "http://localhost:3000/api/health",
      };
      const prodConfig = {
        name: "prod",
        url: "https://spike.land",
        healthEndpoint: "https://spike.land/api/health",
      };
      mockGetEnvConfig.mockImplementation((name: string) => {
        if (name === "dev") return devConfig;
        if (name === "prod") return prodConfig;
        return undefined;
      });
      mockCheckHealth.mockImplementation((config: { name: string; }) => {
        if (config.name === "dev") {
          return Promise.resolve({
            name: "dev",
            status: "healthy",
            version: null,
            commitSha: null,
            lastDeployedAt: null,
          });
        }
        return Promise.resolve({
          name: "prod",
          status: "healthy",
          version: null,
          commitSha: null,
          lastDeployedAt: null,
        });
      });
      const handler = registry.handlers.get("env_compare")!;
      const result = await handler({ env_a: "dev", env_b: "prod" });
      const text = getText(result);
      expect(text).toContain("Version match: NO");
      expect(text).toContain("Commit match: NO");
      // Both null versions => falsy so "?" should appear
      expect(text).toContain("?");
    });
  });
});
