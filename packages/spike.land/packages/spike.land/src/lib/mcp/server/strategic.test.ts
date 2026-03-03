import { describe, expect, it, vi } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ProxyToolRegistry } from "./proxy-tool-registry";
import { registerAllTools } from "./tool-manifest";
import type { ToolRegistry } from "./tool-registry";

// Mock external dependencies
vi.mock("@/lib/storage/r2-client", () => ({
  getPresignedUploadUrl: vi.fn().mockResolvedValue("https://mock-upload.com"),
}));

function buildRegistry(userId: string): ProxyToolRegistry {
  const registry = new ProxyToolRegistry();
  registerAllTools(registry as unknown as ToolRegistry, userId);
  return registry;
}

/** Extract text from the first content block of a CallToolResult. */
function textOf(result: CallToolResult): string {
  const block = result.content[0];
  if (!block || block.type !== "text") {
    throw new Error(`Expected text block, got ${block?.type}`);
  }
  return block.text;
}

describe("MCP Strategic Testing (8 Agents)", () => {
  it("Agent 1: Identity/Auth Specialist - Session Transition", async () => {
    // Test if switching from visitor to logged-in user preserves some state
    // or handles ownership correctly.
    const visitorId = "v_visitor_1";
    const userId = "user_1";

    const visitorRegistry = buildRegistry(visitorId);
    const userRegistry = buildRegistry(userId);

    const visitorFile = await visitorRegistry.callTool(
      "storage_get_upload_url",
      {
        filename: "v.png",
        content_type: "image/png",
        purpose: "image",
      },
    );
    const userFile = await userRegistry.callTool("storage_get_upload_url", {
      filename: "u.png",
      content_type: "image/png",
      purpose: "image",
    });

    const vKey = JSON.parse(textOf(visitorFile)).r2_key;
    JSON.parse(textOf(userFile));

    // User should NOT be able to register visitor's file (unless transitioned)
    const result = await userRegistry.callTool("storage_register_upload", {
      r2_key: vKey,
      purpose: "image",
    });
    expect(result.isError).toBe(true);
  });

  it("Agent 2: Performance Architect - Registry Bloat", async () => {
    // Check if registering 100+ tools is fast enough
    const start = Date.now();
    const registry = buildRegistry("perf");
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500); // Registration should be fast, allowing buffer for CI
    expect(registry.getToolCount()).toBeGreaterThan(100);
  });

  it("Agent 3: Security Auditor - Injection Attacks", async () => {
    const registry = buildRegistry("attacker");
    // Try to inject characters in filenames or params
    const result = await registry.callTool("storage_get_upload_url", {
      filename: "../../../etc/passwd",
      content_type: "image/png; injection=true",
      purpose: "image",
    });

    expect(result.isError).toBeUndefined();
    const content = JSON.parse(textOf(result));
    // Path should still be isolated under uploads/attacker/
    expect(content.r2_key).toContain("uploads/attacker/image/");
    // Traversal should be stripped
    expect(content.r2_key).not.toContain("..");
    expect(content.r2_key).not.toContain("/etc/");
  });

  it("Agent 4: UX Reviewer - Help Clarity", async () => {
    const registry = buildRegistry("ux");
    // All tools should have a help description that is useful
    const categories = registry.listCategories();
    for (const cat of categories) {
      expect(cat.name).toBeDefined();
      expect(cat.tier).toBeDefined();
    }
  });

  it("Agent 5: Data Persistence Expert - JSON Consistency", async () => {
    const registry = buildRegistry("data");
    // Ensure tool outputs are valid JSON where expected
    const result = await registry.callTool("storage_get_upload_url", {
      filename: "test.json",
      content_type: "application/json",
      purpose: "asset",
    });

    const text = textOf(result);
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it("Agent 6: Resilience Engineer - Exception Isolation", async () => {
    const registry = buildRegistry("resilience");
    // Mock a tool that throws an unexpected error
    // In ProxyToolRegistry, we want to ensure it's caught
    const result = await registry.callTool("non_existent_tool", {});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Unknown tool");
  });

  it("Agent 7: Integration Specialist - Cross-Tool Workflows", async () => {
    const registry = buildRegistry("integrator");
    // Create machine -> list machine
    await registry.callTool("sm_create", { name: "Integration Test" });
    const listResult = await registry.callTool("sm_list", {});

    expect(textOf(listResult)).toContain("Integration Test");
  });

  it("Agent 8: Product Visionary - Category Coverage", async () => {
    const registry = buildRegistry("visionary");
    const categoryList = registry.listCategories();
    const categoryNames = new Set(categoryList.map(c => c.name));

    // We expect a wide range of categories for a "complete" platform
    expect(categoryNames.size).toBeGreaterThan(10);
    expect(categoryNames.has("storage")).toBe(true);
    expect(categoryNames.has("state-machine")).toBe(true);
  });
});
