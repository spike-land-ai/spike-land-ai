import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult as SdkCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  registerImageStudioTools,
  type CallToolResult,
  type ImageStudioDeps,
  type ImageStudioToolRegistry,
} from "@spike-land-ai/mcp-image-studio";
import { z } from "zod";

function createRegistryAdapter(server: McpServer): ImageStudioToolRegistry {
  return {
    register(rawDef) {
      const def = rawDef as unknown as { name: string; description: string; fields?: Record<string, unknown>; inputSchema?: Record<string, unknown>; handler: (params: unknown, ctx: unknown) => Promise<CallToolResult> };
      const shape: Record<string, z.ZodTypeAny> = {};

      // Support new defineTool format
      if (def.fields) {
        for (const [key, field] of Object.entries(def.fields) as [string, { type?: string; enum?: string[]; description?: string; optional?: boolean; default?: unknown }][]) {
          let zField: z.ZodTypeAny = z.unknown();
          if (field.type === "string") {
            zField = field.enum ? z.enum(field.enum as [string, ...string[]]) : z.string();
          } else if (field.type === "number") zField = z.number();
          else if (field.type === "boolean") zField = z.boolean();
          else if (field.type === "array") zField = z.array(z.string());

          if (field.description) zField = zField.describe(field.description);
          if (field.optional) zField = zField.optional();
          if (field.default !== undefined) zField = zField.default(field.default);

          shape[key] = zField;
        }
      }
      // Support old ToolDefinition format
      else if (def.inputSchema?.properties) {
        const required = new Set<string>((def.inputSchema.required as string[]) ?? []);
        for (const [key, prop] of Object.entries(def.inputSchema.properties) as [string, Record<string, unknown>][]) {
          let zField = buildZodField(prop);
          if (!required.has(key)) zField = zField.optional();
          shape[key] = zField;
        }
      }

      server.tool(
        def.name,
        def.description,
        shape,
        async (params, extra): Promise<SdkCallToolResult> => {
          const ctx = {
            userId: (extra as Record<string, unknown>)?.userId as string || "demo-user",
            deps: {} as ImageStudioDeps, // The real deps are passed via the closure when registerImageStudioTools is called
          };
          // The handler is already bound to the deps inside `registerImageStudioTools`
          const result: CallToolResult = await def.handler(params, ctx);
          return result as unknown as SdkCallToolResult;
        },
      );
    },
  };
}

function buildZodField(prop: Record<string, unknown>): z.ZodTypeAny {
  const enumValues = prop.enum as string[] | undefined;
  switch (prop.type) {
    case "string":
      if (enumValues) return z.enum(enumValues as [string, ...string[]]);
      return z.string();
    case "number":
    case "integer":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      if (prop.items && typeof prop.items === "object") {
        return z.array(buildZodField(prop.items as Record<string, unknown>));
      }
      return z.array(z.unknown());
    case "object":
      return z.record(z.string(), z.unknown());
    default:
      return z.unknown();
  }
}

export function buildMcpServer(userId: string, deps: ImageStudioDeps): McpServer {
  const server = new McpServer({
    name: "Image Studio",
    version: "0.1.0",
  });
  const registry = createRegistryAdapter(server);
  registerImageStudioTools(registry, userId, deps);
  return server;
}
