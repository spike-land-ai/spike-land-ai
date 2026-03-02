import type { McpToolDef, ToolLike } from "./types.js";

/**
 * Convert a ToolLike (TypeBox schema) to MCP JSON Schema format.
 * TypeBox TObject already conforms to JSON Schema, but we strip internal
 * symbols so the output is plain JSON.
 */
export function convertToolToMcp(tool: ToolLike): McpToolDef {
  const schema = tool.parameters;
  const jsonSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  } = {
    type: "object",
    properties: {},
    required: [],
  };

  if (schema && typeof schema === "object" && "properties" in schema) {
    for (const [key, prop] of Object.entries(
      schema.properties as Record<string, Record<string, unknown>>,
    )) {
      // Strip TypeBox internal symbols, keep JSON Schema fields
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(prop)) {
        clean[k] = v;
      }
      jsonSchema.properties[key] = clean;
    }
    if (schema.required && Array.isArray(schema.required)) {
      jsonSchema.required = schema.required;
    }
  }

  return {
    name: tool.name,
    description: tool.description ?? "",
    inputSchema: jsonSchema,
  };
}
