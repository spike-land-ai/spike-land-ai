import { describe, expect, it } from "vitest";
import {
  GLAMA_API_BASE,
  MCP_REGISTRY_CACHE_PREFIX,
  MCP_REGISTRY_CACHE_TTL,
  OFFICIAL_MCP_REGISTRY_BASE,
  SMITHERY_API_BASE,
} from "./constants";

describe("MCP constants", () => {
  it("exports SMITHERY_API_BASE as a valid URL string", () => {
    expect(typeof SMITHERY_API_BASE).toBe("string");
    expect(SMITHERY_API_BASE).toContain("https://");
    expect(SMITHERY_API_BASE).toContain("smithery.ai");
  });

  it("exports OFFICIAL_MCP_REGISTRY_BASE as a valid URL string", () => {
    expect(typeof OFFICIAL_MCP_REGISTRY_BASE).toBe("string");
    expect(OFFICIAL_MCP_REGISTRY_BASE).toContain("https://");
    expect(OFFICIAL_MCP_REGISTRY_BASE).toContain("modelcontextprotocol.io");
  });

  it("exports GLAMA_API_BASE as a valid URL string", () => {
    expect(typeof GLAMA_API_BASE).toBe("string");
    expect(GLAMA_API_BASE).toContain("https://");
    expect(GLAMA_API_BASE).toContain("glama.ai");
  });

  it("exports MCP_REGISTRY_CACHE_TTL as 3600 seconds (1 hour)", () => {
    expect(MCP_REGISTRY_CACHE_TTL).toBe(3600);
  });

  it("exports MCP_REGISTRY_CACHE_PREFIX as a string", () => {
    expect(typeof MCP_REGISTRY_CACHE_PREFIX).toBe("string");
    expect(MCP_REGISTRY_CACHE_PREFIX).toBe("mcp-registry:");
  });
});
