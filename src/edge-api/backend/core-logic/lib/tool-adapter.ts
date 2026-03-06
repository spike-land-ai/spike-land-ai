import type { JsonSchemaObject, ToolDefinition } from "../../lazy-imports/types";

/**
 * Type for tool validation - checks if a tool has valid input schema format
 */
interface ToolWithInputSchema {
  input_schema?: JsonSchemaObject;
  custom?: {
    input_schema?: JsonSchemaObject;
  };
}

/**
 * Information about an invalid tool for logging
 */
interface InvalidToolInfo {
  index: number;
  reason: string;
  value: unknown;
  note?: string;
}

export type { ToolWithInputSchema, InvalidToolInfo };
export { hasValidInputSchemaType, isToolDefinition };

/**
 * Validates that a tool's input_schema has type: "object" as required by Anthropic API
 */
function hasValidInputSchemaType(toolObj: ToolWithInputSchema): boolean {
  if (toolObj.input_schema && typeof toolObj.input_schema === "object") {
    if (toolObj.input_schema.type !== "object") {
      return false;
    }
  }

  if (toolObj.custom?.input_schema && typeof toolObj.custom.input_schema === "object") {
    if (toolObj.custom.input_schema.type !== "object") {
      return false;
    }
  }

  return true;
}

/**
 * Type guard for checking if an object is a valid tool definition
 */
function isToolDefinition(value: unknown): value is ToolDefinition {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;

  const hasInputSchema = "input_schema" in obj && obj.input_schema !== null;
  const hasCustomInputSchema =
    "custom" in obj &&
    typeof obj.custom === "object" &&
    obj.custom !== null &&
    "input_schema" in (obj.custom as Record<string, unknown>);

  return hasInputSchema || hasCustomInputSchema;
}

/**
 * Validates an array of tools and returns information about invalid ones
 */
export function validateToolsArray(tools: unknown[]): InvalidToolInfo[] {
  const invalidTools: InvalidToolInfo[] = [];

  tools.forEach((toolItem: unknown, index: number) => {
    if (!isToolDefinition(toolItem)) {
      return;
    }

    const toolObj = toolItem as ToolWithInputSchema;

    if (toolObj.custom?.input_schema) {
      if (
        !hasValidInputSchemaType({
          custom: { input_schema: toolObj.custom.input_schema },
        })
      ) {
        invalidTools.push({
          index,
          reason: "custom.input_schema.type is not 'object'",
          value: toolObj.custom.input_schema.type,
        });
      }
    }

    if (toolObj.input_schema) {
      if (!hasValidInputSchemaType({ input_schema: toolObj.input_schema })) {
        invalidTools.push({
          index,
          reason: "input_schema.type is not 'object' (AI SDK v4 issue with Claude Sonnet 4)",
          value: toolObj.input_schema.type,
          note: "See https://github.com/vercel/ai/issues/7333",
        });
      }
    }
  });

  return invalidTools;
}
