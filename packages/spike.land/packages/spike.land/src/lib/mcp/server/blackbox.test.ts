import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ProxyToolRegistry } from "./proxy-tool-registry";
import { registerAllTools } from "./tool-manifest";
import type { ToolRegistry } from "./tool-registry";

// Mock external dependencies that might fail in test environment
vi.mock("@/lib/storage/r2-client", () => ({
  getPresignedUploadUrl: vi.fn().mockResolvedValue("https://mock-upload.com"),
}));

vi.mock("@/lib/try-catch", () => ({
  tryCatch: async <T>(promise: Promise<T>) => {
    try {
      const data = await promise;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
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

describe("MCP Server Black Box Testing (8 Agents)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Agent 1: Anonymous User - Basic Tools", async () => {
    const registry = buildRegistry("anonymous");
    const result = await registry.callTool("storage_get_upload_url", {
      filename: "test.png",
      content_type: "image/png",
      purpose: "image",
    });

    expect(result.isError).toBeUndefined();
    const content = JSON.parse(textOf(result));
    expect(content.r2_key).toContain("uploads/anonymous/image/");
  });

  it("Agent 2: Visitor User - Isolated Storage", async () => {
    const visitorId = "v_123456789";
    const registry = buildRegistry(visitorId);
    const result = await registry.callTool("storage_get_upload_url", {
      filename: "test.png",
      content_type: "image/png",
      purpose: "image",
    });

    expect(result.isError).toBeUndefined();
    const content = JSON.parse(textOf(result));
    expect(content.r2_key).toContain(`uploads/${visitorId}/image/`);
  });

  it("Agent 3: Logged-in User - Workspace Tools", async () => {
    const userId = "user_999";
    const registry = buildRegistry(userId);
    // Try a tool that might be specific to users
    const result = await registry.callTool("storage_get_upload_url", {
      filename: "doc.pdf",
      content_type: "application/pdf",
      purpose: "asset",
    });

    expect(result.isError).toBeUndefined();
    const content = JSON.parse(textOf(result));
    expect(content.r2_key).toContain(`uploads/${userId}/asset/`);
  });

  it("Agent 4: Security Prober - Ownership Bypass", async () => {
    const bobId = "bob";
    const bobRegistry = buildRegistry(bobId);

    // Bob tries to register Alice's file
    const result = await bobRegistry.callTool("storage_register_upload", {
      r2_key: "uploads/alice/image/123-abc.png",
      purpose: "image",
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Access denied");
  });

  it("Agent 5: Chaos Monkey - Validation Errors", async () => {
    const registry = buildRegistry("chaos");
    // Missing required fields
    const result = await registry.callTool("storage_get_upload_url", {
      filename: "test.png",
      // content_type missing
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("VALIDATION_ERROR");
  });

  it("Agent 6: Feature Explorer - State Machine Tools", async () => {
    const registry = buildRegistry("explorer");
    // Check if state machine tools are available (they should be for everyone)
    const result = await registry.callTool("sm_create", {
      name: "test-machine",
      initial_state: "idle",
    });

    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("Machine Created");
  });

  it("Agent 7: Performance Tester - Parallel Execution", async () => {
    const registry = buildRegistry("perf");
    const promises = Array.from({ length: 10 }).map(() =>
      registry.callTool("storage_get_upload_url", {
        filename: "test.png",
        content_type: "image/png",
        purpose: "image",
      })
    );

    const results = await Promise.all(promises);
    results.forEach(res => {
      expect(res.isError).toBeUndefined();
    });
  });

  it("Agent 8: Admin - High-Privilege Tools", async () => {
    // Admin tools might check role in the handler, but registry-level
    // we just pass the userId.
    const registry = buildRegistry("admin_user");
    // This is just a placeholder for an admin tool test
    // Assuming there is a tool that only admins should call
    // We'll see if it's even registered.
    const toolCount = registry.getToolCount();
    expect(toolCount).toBeGreaterThan(100);
  });
});
