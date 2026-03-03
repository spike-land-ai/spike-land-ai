/**
 * CRUD Tool Template
 *
 * Factory for generating standard Create/Read/Update/Delete/List tool sets.
 * Reduces boilerplate for entity-based MCP tools.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../../tool-registry";
import type { ToolComplexity } from "../../tool-registry";
import { safeToolCall, textResult } from "../tool-helpers";
import type { z } from "zod";

export interface CrudToolConfig<
  TCreate extends z.ZodRawShape,
  TGet extends z.ZodRawShape,
  TUpdate extends z.ZodRawShape,
  TDelete extends z.ZodRawShape,
  TList extends z.ZodRawShape,
> {
  domain: string;
  category: string;
  tier: "free" | "workspace";
  entity: string;
  schemas: {
    create?: {
      shape: TCreate;
      handler: (
        input: z.infer<z.ZodObject<TCreate>>,
      ) => Promise<CallToolResult>;
    };
    get?: {
      shape: TGet;
      handler: (input: z.infer<z.ZodObject<TGet>>) => Promise<CallToolResult>;
    };
    update?: {
      shape: TUpdate;
      handler: (
        input: z.infer<z.ZodObject<TUpdate>>,
      ) => Promise<CallToolResult>;
    };
    delete?: {
      shape: TDelete;
      handler: (
        input: z.infer<z.ZodObject<TDelete>>,
      ) => Promise<CallToolResult>;
    };
    list?: {
      shape: TList;
      handler: (input: z.infer<z.ZodObject<TList>>) => Promise<CallToolResult>;
    };
  };
}

/**
 * Register a standard set of CRUD tools for an entity.
 *
 * Generates tools named `{domain}_create_{entity}`, `{domain}_get_{entity}`, etc.
 * Each tool is wrapped with safeToolCall for error classification.
 */
export function registerCrudTools<
  TCreate extends z.ZodRawShape,
  TGet extends z.ZodRawShape,
  TUpdate extends z.ZodRawShape,
  TDelete extends z.ZodRawShape,
  TList extends z.ZodRawShape,
>(
  registry: ToolRegistry,
  config: CrudToolConfig<TCreate, TGet, TUpdate, TDelete, TList>,
): void {
  const ops: Array<{
    action: string;
    description: string;
    complexity: ToolComplexity;
    shape: z.ZodRawShape;
    handler: (input: never) => Promise<CallToolResult>;
    readOnly?: boolean;
  }> = [];

  if (config.schemas.create) {
    ops.push({
      action: "create",
      description: `Create a new ${config.entity}.`,
      complexity: "primitive",
      shape: config.schemas.create.shape,
      handler: config.schemas.create.handler as (
        input: never,
      ) => Promise<CallToolResult>,
    });
  }

  if (config.schemas.get) {
    ops.push({
      action: "get",
      description: `Get a ${config.entity} by ID.`,
      complexity: "primitive",
      shape: config.schemas.get.shape,
      handler: config.schemas.get.handler as (
        input: never,
      ) => Promise<CallToolResult>,
      readOnly: true,
    });
  }

  if (config.schemas.update) {
    ops.push({
      action: "update",
      description: `Update an existing ${config.entity}.`,
      complexity: "primitive",
      shape: config.schemas.update.shape,
      handler: config.schemas.update.handler as (
        input: never,
      ) => Promise<CallToolResult>,
    });
  }

  if (config.schemas.delete) {
    ops.push({
      action: "delete",
      description: `Delete a ${config.entity}.`,
      complexity: "primitive",
      shape: config.schemas.delete.shape,
      handler: config.schemas.delete.handler as (
        input: never,
      ) => Promise<CallToolResult>,
    });
  }

  if (config.schemas.list) {
    ops.push({
      action: "list",
      description: `List ${config.entity}s with optional filters.`,
      complexity: "primitive",
      shape: config.schemas.list.shape,
      handler: config.schemas.list.handler as (
        input: never,
      ) => Promise<CallToolResult>,
      readOnly: true,
    });
  }

  for (const op of ops) {
    const toolName = `${config.domain}_${op.action}_${config.entity}`;
    registry.register({
      name: toolName,
      description: op.description,
      category: config.category,
      tier: config.tier,
      complexity: op.complexity,
      inputSchema: op.shape,
      ...(op.readOnly ? { annotations: { readOnlyHint: true } } : {}),
      handler: ((input: never) => safeToolCall(toolName, () => op.handler(input))) as never,
    });
  }
}

/**
 * Helper to format a single entity for display.
 */
export function formatEntity(
  label: string,
  fields: Record<string, string | number | boolean | null | undefined>,
): string {
  let text = `**${label}**\n\n`;
  for (const [key, value] of Object.entries(fields)) {
    text += `**${key}:** ${value ?? "(none)"}\n`;
  }
  return text;
}

/**
 * Helper to format a list of entities for display.
 */
export function formatEntityList(
  label: string,
  items: Array<{ id: string; summary: string; }>,
): CallToolResult {
  if (items.length === 0) {
    return textResult(`**No ${label} found.**`);
  }
  const lines = items.map(item => `- **${item.id}** — ${item.summary}`);
  return textResult(`**${label} (${items.length})**\n\n${lines.join("\n")}`);
}
