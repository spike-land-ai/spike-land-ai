/**
 * Public Tools Listing Endpoint
 *
 * GET /tools — Returns tool metadata (name, description, category, inputSchema)
 * without requiring authentication. Read-only endpoint for the tools explorer UI.
 */
import { Hono } from "hono";
import type { Env } from "../core-logic/env";
import type { AuthVariables } from "./middleware";
import { ToolRegistry } from "../lazy-imports/registry";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "../core-logic/mcp/manifest";
import { createDb } from "../db/db/db-index.ts";

interface JsonSchemaProperty {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
}

/** Map a Zod type to a JSON Schema property, unwrapping Optional/Default wrappers. */
function resolveZodProperty(zodField: unknown): { prop: JsonSchemaProperty; optional: boolean } {
  let field = zodField as { description?: string; _def?: { typeName?: string; innerType?: unknown; values?: string[]; type?: unknown } };
  let optional = false;

  // Unwrap ZodOptional / ZodDefault
  while (field._def?.typeName === "ZodOptional" || field._def?.typeName === "ZodDefault") {
    optional = true;
    field = (field._def.innerType ?? field) as typeof field;
  }

  const description = (zodField as { description?: string }).description ?? "";
  const typeName = field._def?.typeName ?? "";

  if (typeName === "ZodEnum") {
    const values = field._def?.values as string[] | undefined;
    return { prop: { type: "string", description, ...(values ? { enum: values } : {}) }, optional };
  }

  const typeMap: Record<string, string> = {
    ZodString: "string",
    ZodNumber: "number",
    ZodBoolean: "boolean",
    ZodArray: "array",
    ZodObject: "object",
  };

  const jsonType = typeMap[typeName] ?? "string";
  const prop: JsonSchemaProperty = { type: jsonType, description };

  if (jsonType === "array" && field._def?.type) {
    const innerDef = (field._def.type as { _def?: { typeName?: string } })?._def;
    prop.items = { type: typeMap[innerDef?.typeName ?? ""] ?? "string" };
  }

  return { prop, optional };
}

export const publicToolsRoute = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

publicToolsRoute.get("/", async (c) => {
  const stabilityFilter = c.req.query("stability");
  const categoryFilter = c.req.query("category");

  const db = createDb(c.env.DB);
  const mcpServer = new McpServer(
    { name: "spike-land-mcp", version: "1.0.0" },
    { capabilities: { tools: { listChanged: true } } },
  );

  const registry = new ToolRegistry(mcpServer, "anonymous");
  await registerAllTools(registry, "anonymous", db, {
    kv: c.env.KV,
    vaultSecret: c.env.VAULT_SECRET,
  });

  let definitions = registry.getToolDefinitions();

  if (stabilityFilter) {
    definitions = definitions.filter((t) => t.stability === stabilityFilter);
  }
  if (categoryFilter) {
    definitions = definitions.filter((t) => t.category === categoryFilter);
  }

  const tools = definitions.map((t) => {
    if (!t.inputSchema) {
      return {
        name: t.name, description: t.description, category: t.category,
        inputSchema: { type: "object" as const },
        version: t.version, stability: t.stability, examples: t.examples,
      };
    }

    const properties: Record<string, JsonSchemaProperty> = {};
    const required: string[] = [];

    for (const key of Object.keys(t.inputSchema)) {
      const { prop, optional } = resolveZodProperty(t.inputSchema[key]);
      properties[key] = prop;
      if (!optional) {
        required.push(key);
      }
    }

    return {
      name: t.name, description: t.description, category: t.category,
      inputSchema: {
        type: "object" as const,
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
      version: t.version, stability: t.stability, examples: t.examples,
    };
  });

  const response = c.json({ tools });
  // Tool definitions rarely change — cache aggressively
  c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return response;
});
