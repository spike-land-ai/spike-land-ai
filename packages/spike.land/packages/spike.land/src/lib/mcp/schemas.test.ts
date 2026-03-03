import { describe, expect, it } from "vitest";
import {
  McpRegistryGetSchema,
  McpRegistryInstallSchema,
  McpRegistrySearchSchema,
} from "./schemas";

describe("MCP Registry Schemas", () => {
  describe("McpRegistrySearchSchema", () => {
    it("should accept valid search params", () => {
      const result = McpRegistrySearchSchema.safeParse({
        query: "file management",
        limit: 5,
      });
      expect(result.success).toBe(true);
    });

    it("should accept query without limit", () => {
      const result = McpRegistrySearchSchema.safeParse({ query: "search" });
      expect(result.success).toBe(true);
    });

    it("should reject empty query", () => {
      const result = McpRegistrySearchSchema.safeParse({ query: "" });
      expect(result.success).toBe(false);
    });

    it("should reject query over 200 chars", () => {
      const result = McpRegistrySearchSchema.safeParse({
        query: "a".repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it("should reject limit below 1", () => {
      const result = McpRegistrySearchSchema.safeParse({
        query: "test",
        limit: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should reject limit above 50", () => {
      const result = McpRegistrySearchSchema.safeParse({
        query: "test",
        limit: 51,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("McpRegistryGetSchema", () => {
    it("should accept valid get params", () => {
      const result = McpRegistryGetSchema.safeParse({
        serverId: "server-123",
        source: "smithery",
      });
      expect(result.success).toBe(true);
    });

    it("should accept all source values", () => {
      for (const source of ["smithery", "official", "glama"]) {
        const result = McpRegistryGetSchema.safeParse({
          serverId: "s1",
          source,
        });
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid source", () => {
      const result = McpRegistryGetSchema.safeParse({
        serverId: "s1",
        source: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty serverId", () => {
      const result = McpRegistryGetSchema.safeParse({
        serverId: "",
        source: "smithery",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("McpRegistryInstallSchema", () => {
    it("should accept valid install params with envVars", () => {
      const result = McpRegistryInstallSchema.safeParse({
        serverId: "server-456",
        source: "official",
        envVars: { API_KEY: "abc123" },
      });
      expect(result.success).toBe(true);
    });

    it("should accept install params without envVars", () => {
      const result = McpRegistryInstallSchema.safeParse({
        serverId: "server-456",
        source: "glama",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing serverId", () => {
      const result = McpRegistryInstallSchema.safeParse({
        source: "smithery",
      });
      expect(result.success).toBe(false);
    });
  });
});
