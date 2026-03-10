/**
 * Public Tools Listing Endpoint
 *
 * GET /tools — Returns tool metadata (name, description, category, inputSchema)
 * without requiring authentication. Read-only endpoint for the tools explorer UI.
 */
import { Hono } from "hono";
import { z } from "zod";
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
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

/** Map a Zod type to a JSON Schema property, unwrapping Optional/Default wrappers. */
function resolveZodProperty(zodField: unknown): { prop: JsonSchemaProperty; optional: boolean } {
  let field = zodField as z.ZodTypeAny;
  let optional = false;

  while (field instanceof z.ZodOptional || field instanceof z.ZodDefault) {
    optional = true;
    field =
      field instanceof z.ZodOptional
        ? (field.unwrap() as z.ZodTypeAny)
        : (field.removeDefault() as z.ZodTypeAny);
  }

  const originalField = zodField as z.ZodTypeAny;
  const description = originalField.description ?? field.description ?? "";

  if (field instanceof z.ZodEnum) {
    return {
      prop: {
        type: "string",
        description,
        ...(field.options.length > 0 ? { enum: field.options.map((value) => String(value)) } : {}),
      },
      optional,
    };
  }

  if (field instanceof z.ZodObject) {
    const nestedProps: Record<string, JsonSchemaProperty> = {};
    const nestedRequired: string[] = [];

    for (const [key, nestedField] of Object.entries(field.shape)) {
      const { prop: nestedProp, optional: nestedOptional } = resolveZodProperty(nestedField);
      nestedProps[key] = nestedProp;
      if (!nestedOptional) {
        nestedRequired.push(key);
      }
    }

    return {
      prop: {
        type: "object",
        description,
        properties: nestedProps,
        ...(nestedRequired.length > 0 ? { required: nestedRequired } : {}),
      },
      optional,
    };
  }

  if (field instanceof z.ZodArray) {
    const { prop: itemProp } = resolveZodProperty(field.element);
    return {
      prop: {
        type: "array",
        description,
        items: itemProp,
      },
      optional,
    };
  }

  let jsonType = "string";
  if (field instanceof z.ZodNumber) {
    jsonType = "number";
  } else if (field instanceof z.ZodBoolean) {
    jsonType = "boolean";
  }
  const prop: JsonSchemaProperty = { type: jsonType, description };

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
        name: t.name,
        description: t.description,
        category: t.category,
        inputSchema: { type: "object" as const },
        version: t.version,
        stability: t.stability,
        examples: t.examples,
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
      name: t.name,
      description: t.description,
      category: t.category,
      inputSchema: {
        type: "object" as const,
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
      version: t.version,
      stability: t.stability,
      examples: t.examples,
    };
  });

  const response = c.json({ tools });
  // Tool definitions rarely change — cache aggressively
  c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return response;
});
