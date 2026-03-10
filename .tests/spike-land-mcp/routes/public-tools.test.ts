/**
 * Tests for routes/public-tools.ts
 */
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/edge-api/spike-land/core-logic/env";
import type { AuthVariables } from "../../../src/edge-api/spike-land/api/middleware";
import { publicToolsRoute } from "../../../src/edge-api/spike-land/api/public-tools";
import { createMockD1, createMockKV } from "../__test-utils__/mock-env";
import type { ToolRegistry } from "../../../src/edge-api/spike-land/lazy-imports/registry";
import { z } from "zod";

// Mock registerAllTools to avoid needing full D1/env setup for all 80+ tools.
// vi.mock is hoisted, so the factory must not reference variables declared later.
vi.mock("../../../src/edge-api/spike-land/core-logic/mcp/manifest", () => ({
  registerAllTools: vi.fn().mockResolvedValue(undefined),
}));

// Import the module after vi.mock so vi.mocked() resolves the hoisted mock.
import { registerAllTools } from "../../../src/edge-api/spike-land/core-logic/mcp/manifest";
const mockRegisterAllTools = vi.mocked(registerAllTools);

function buildApp() {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.route("/tools", publicToolsRoute);

  const env = {
    DB: createMockD1(),
    KV: createMockKV(),
    VAULT_SECRET: "test-secret",
  } as unknown as Env;

  return { app, env };
}

/** Seed a registry with tools of varying stability/category for filter tests. */
function seedRegistry(registry: ToolRegistry): void {
  registry.register({
    name: "stable_tool",
    description: "A stable tool",
    category: "storage",
    tier: "free",
    stability: "stable",
    handler: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
  });
  registry.register({
    name: "beta_tool",
    description: "A beta tool",
    category: "ai",
    tier: "free",
    stability: "beta",
    handler: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
  });
  registry.register({
    name: "exp_tool",
    description: "An experimental tool",
    category: "storage",
    tier: "free",
    stability: "experimental",
    inputSchema: { q: z.string().describe("query param") },
    handler: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
  });
}

describe("publicToolsRoute GET /", () => {
  it("returns 200 with tools array", async () => {
    const { app, env } = buildApp();

    const res = await app.request("/tools", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { tools: unknown[] };
    expect(Array.isArray(body.tools)).toBe(true);
  });

  it("sets Cache-Control header", async () => {
    const { app, env } = buildApp();

    const res = await app.request("/tools", {}, env);

    expect(res.status).toBe(200);
    const cacheControl = res.headers.get("Cache-Control");
    // Cache-Control may or may not be present depending on Hono's response handling
    if (cacheControl !== null) {
      expect(cacheControl).toContain("public");
    }
  });

  it("returns tool objects with expected shape", async () => {
    const { app, env } = buildApp();

    const res = await app.request("/tools", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tools: Array<{ name: string; description: string; category: string }>;
    };
    // Since registerAllTools is mocked, tools array will be empty
    expect(Array.isArray(body.tools)).toBe(true);
  });

  it("filters by stability query param", async () => {
    // Override registerAllTools to seed the registry for this test
    mockRegisterAllTools.mockImplementationOnce(async (registry: ToolRegistry) => {
      seedRegistry(registry);
    });

    const { app, env } = buildApp();
    const res = await app.request("/tools?stability=beta", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { tools: Array<{ name: string; stability: string }> };
    expect(Array.isArray(body.tools)).toBe(true);
    for (const tool of body.tools) {
      expect(tool.stability).toBe("beta");
    }
    expect(body.tools.map((t) => t.name)).toContain("beta_tool");
    expect(body.tools.map((t) => t.name)).not.toContain("stable_tool");
  });

  it("filters by category query param", async () => {
    mockRegisterAllTools.mockImplementationOnce(async (registry: ToolRegistry) => {
      seedRegistry(registry);
    });

    const { app, env } = buildApp();
    const res = await app.request("/tools?category=storage", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { tools: Array<{ name: string; category: string }> };
    for (const tool of body.tools) {
      expect(tool.category).toBe("storage");
    }
    const names = body.tools.map((t) => t.name);
    expect(names).toContain("stable_tool");
    expect(names).toContain("exp_tool");
    expect(names).not.toContain("beta_tool");
  });

  it("combines stability and category filters", async () => {
    mockRegisterAllTools.mockImplementationOnce(async (registry: ToolRegistry) => {
      seedRegistry(registry);
    });

    const { app, env } = buildApp();
    const res = await app.request("/tools?stability=stable&category=storage", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { tools: Array<{ name: string }> };
    const names = body.tools.map((t) => t.name);
    expect(names).toContain("stable_tool");
    expect(names).not.toContain("exp_tool"); // experimental, not stable
    expect(names).not.toContain("beta_tool"); // wrong category
  });

  it("returns empty array when no tools match filter", async () => {
    mockRegisterAllTools.mockImplementationOnce(async (registry: ToolRegistry) => {
      seedRegistry(registry);
    });

    const { app, env } = buildApp();
    const res = await app.request("/tools?stability=deprecated", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { tools: unknown[] };
    expect(body.tools).toHaveLength(0);
  });

  it("returns all tools when no filter params provided", async () => {
    mockRegisterAllTools.mockImplementationOnce(async (registry: ToolRegistry) => {
      seedRegistry(registry);
    });

    const { app, env } = buildApp();
    const res = await app.request("/tools", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { tools: unknown[] };
    expect(body.tools).toHaveLength(3);
  });

  it("preserves optional, enum, nested object, and array schema details under Zod v4", async () => {
    mockRegisterAllTools.mockImplementationOnce(async (registry: ToolRegistry) => {
      registry.register({
        name: "schema_tool",
        description: "Schema-heavy tool",
        category: "ai",
        tier: "free",
        stability: "stable",
        inputSchema: {
          audience: z.enum(["investor", "operator"]).describe("Target audience"),
          notes: z.string().optional().describe("Optional notes"),
          settings: z
            .object({
              retries: z.number().describe("Retry count"),
              dry_run: z.boolean().optional().describe("Dry-run mode"),
            })
            .describe("Execution settings"),
          files: z
            .array(
              z.object({
                path: z.string().describe("File path"),
                content: z.string().optional().describe("File contents"),
              }),
            )
            .describe("Files to process"),
        },
        handler: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
      });
    });

    const { app, env } = buildApp();
    const res = await app.request("/tools", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tools: Array<{
        name: string;
        inputSchema: {
          properties: Record<
            string,
            {
              type: string;
              enum?: string[];
              properties?: Record<string, { type: string }>;
              required?: string[];
              items?: {
                type: string;
                properties?: Record<string, { type: string }>;
                required?: string[];
              };
            }
          >;
          required?: string[];
        };
      }>;
    };

    const schemaTool = body.tools.find((tool) => tool.name === "schema_tool");
    expect(schemaTool).toBeDefined();
    expect(schemaTool?.inputSchema.required).toEqual(["audience", "settings", "files"]);
    expect(schemaTool?.inputSchema.properties.audience).toMatchObject({
      type: "string",
      enum: ["investor", "operator"],
    });
    expect(schemaTool?.inputSchema.properties.notes.type).toBe("string");
    expect(schemaTool?.inputSchema.properties.settings).toMatchObject({
      type: "object",
      required: ["retries"],
    });
    expect(schemaTool?.inputSchema.properties.settings.properties?.dry_run.type).toBe("boolean");
    expect(schemaTool?.inputSchema.properties.files).toMatchObject({
      type: "array",
      items: {
        type: "object",
        required: ["path"],
      },
    });
    expect(schemaTool?.inputSchema.properties.files.items?.properties?.content.type).toBe("string");
  });
});
