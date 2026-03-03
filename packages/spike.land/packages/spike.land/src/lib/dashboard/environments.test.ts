import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkAllEnvironments,
  checkEnvironmentHealth,
  getAllEnvironmentConfigs,
  getEnvironmentConfig,
} from "./environments";

describe("dashboard/environments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEnvironmentConfig", () => {
    it("should return config for dev environment", () => {
      const config = getEnvironmentConfig("dev");
      expect(config).toBeDefined();
      expect(config?.name).toBe("dev");
      expect(config?.url).toContain("localhost");
    });

    it("should return config for prod environment", () => {
      const config = getEnvironmentConfig("prod");
      expect(config).toBeDefined();
      expect(config?.name).toBe("prod");
    });

    it("should return config for preview environment", () => {
      const config = getEnvironmentConfig("preview");
      expect(config).toBeDefined();
      expect(config?.name).toBe("preview");
    });

    it("should return undefined for unknown environment", () => {
      const config = getEnvironmentConfig("staging" as "dev");
      expect(config).toBeUndefined();
    });
  });

  describe("getAllEnvironmentConfigs", () => {
    it("should return all 3 environment configs", () => {
      const configs = getAllEnvironmentConfigs();
      expect(configs).toHaveLength(3);
      const names = configs.map(c => c.name);
      expect(names).toContain("dev");
      expect(names).toContain("preview");
      expect(names).toContain("prod");
    });

    it("should include health endpoints for all environments", () => {
      const configs = getAllEnvironmentConfigs();
      for (const config of configs) {
        expect(config.healthEndpoint).toContain("/api/health");
      }
    });
  });

  describe("checkEnvironmentHealth", () => {
    it("should return healthy when endpoint responds quickly", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            commitSha: "abc123",
            version: "1.0.0",
            deployedAt: "2024-01-15T10:00:00Z",
          }),
      });

      const result = await checkEnvironmentHealth({
        name: "dev",
        url: "http://localhost:3000",
        healthEndpoint: "http://localhost:3000/api/health",
      });

      expect(result.status).toBe("healthy");
      expect(result.commitSha).toBe("abc123");
      expect(result.version).toBe("1.0.0");
    });

    it("should return degraded when endpoint returns non-ok", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await checkEnvironmentHealth({
        name: "prod",
        url: "https://spike.land",
        healthEndpoint: "https://spike.land/api/health",
      });

      expect(result.status).toBe("degraded");
    });

    it("should return down when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await checkEnvironmentHealth({
        name: "dev",
        url: "http://localhost:3000",
        healthEndpoint: "http://localhost:3000/api/health",
      });

      expect(result.status).toBe("down");
      expect(result.commitSha).toBeNull();
    });

    it("should handle malformed JSON in response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      const result = await checkEnvironmentHealth({
        name: "dev",
        url: "http://localhost:3000",
        healthEndpoint: "http://localhost:3000/api/health",
      });

      expect(result.status).toBe("healthy");
      expect(result.commitSha).toBeNull();
    });
  });

  describe("checkAllEnvironments", () => {
    it("should check all registered environments", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const results = await checkAllEnvironments();

      expect(results).toHaveLength(3);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });
});
