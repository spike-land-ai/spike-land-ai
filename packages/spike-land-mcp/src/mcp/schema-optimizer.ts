/**
 * Schema Optimizer
 *
 * Minimizes JSON Schema size by stripping redundant information:
 * - Descriptions that match the property name (case-insensitive)
 * - Default values that are undefined
 * - Empty objects/arrays that add no information
 */

/**
 * Optimize a JSON Schema object by removing redundant information.
 * Returns a new object (does not mutate the input).
 */
export function optimizeSchema(schema: object): object {
  return optimizeNode(schema, undefined);
}

function optimizeNode(node: unknown, propertyName: string | undefined): unknown {
  if (node === null || typeof node !== "object") {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((item) => optimizeNode(item, undefined));
  }

  const obj = node as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip undefined defaults
    if (key === "default" && value === undefined) {
      continue;
    }

    // Strip descriptions that match the property name (redundant)
    if (key === "description" && typeof value === "string" && propertyName) {
      if (isRedundantDescription(propertyName, value)) {
        continue;
      }
    }

    // Recurse into properties object, passing property names down
    if (key === "properties" && typeof value === "object" && value !== null) {
      const props = value as Record<string, unknown>;
      const optimizedProps: Record<string, unknown> = {};
      for (const [propName, propSchema] of Object.entries(props)) {
        optimizedProps[propName] = optimizeNode(propSchema, propName);
      }
      result[key] = optimizedProps;
      continue;
    }

    // Recurse into nested schema objects
    if (isSchemaObject(key, value)) {
      result[key] = optimizeNode(value, propertyName);
      continue;
    }

    // Recurse into arrays of schemas (e.g. allOf, anyOf, oneOf)
    if (isSchemaArray(key, value)) {
      result[key] = (value as unknown[]).map((item) => optimizeNode(item, undefined));
      continue;
    }

    result[key] = value;
  }

  return result;
}

function isRedundantDescription(propertyName: string, description: string): boolean {
  const normalized = description.toLowerCase().trim();
  const normalizedName = propertyName.toLowerCase().replace(/[_-]/g, " ");

  // Exact match: description is just the property name
  if (normalized === normalizedName) return true;

  // "The <name>" pattern
  if (normalized === `the ${normalizedName}`) return true;

  // "A <name>" or "An <name>" pattern
  if (normalized === `a ${normalizedName}` || normalized === `an ${normalizedName}`) return true;

  return false;
}

function isSchemaObject(key: string, value: unknown): value is Record<string, unknown> {
  const schemaKeys = ["items", "additionalProperties", "not", "if", "then", "else"];
  return schemaKeys.includes(key) && typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSchemaArray(key: string, value: unknown): value is unknown[] {
  const arrayKeys = ["allOf", "anyOf", "oneOf", "prefixItems"];
  return arrayKeys.includes(key) && Array.isArray(value);
}
