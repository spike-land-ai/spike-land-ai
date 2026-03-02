/**
 * Lightweight JSON Schema Validator for MCP Tool Inputs
 *
 * Zero-dependency runtime validation against the auto-generated JSON schemas.
 * Validates: type, required, enum, additionalProperties, nested objects, and arrays.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface SchemaNode {
  type?: string;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  additionalProperties?: boolean;
  enum?: (string | number | boolean)[];
  items?: SchemaNode;
  $ref?: string;
  description?: string;
  minimum?: number;
  maximum?: number;
}

interface SchemaRoot {
  definitions?: Record<string, SchemaNode>;
}

function resolveRef(ref: string, root: SchemaRoot): SchemaNode | undefined {
  // Handle "#/definitions/Foo"
  const match = ref.match(/^#\/definitions\/(.+)$/);
  if (!match || !match[1]) return undefined;
  return root.definitions?.[match[1]];
}

function resolveSchema(node: SchemaNode, root: SchemaRoot): SchemaNode {
  if (node.$ref) {
    const resolved = resolveRef(node.$ref, root);
    if (resolved) return resolveSchema(resolved, root);
  }
  return node;
}

function validateNode(
  value: unknown,
  schema: SchemaNode,
  root: SchemaRoot,
  path: string,
  errors: string[],
): void {
  const resolved = resolveSchema(schema, root);

  // Enum check
  if (resolved.enum) {
    if (!resolved.enum.includes(value as string | number | boolean)) {
      errors.push(
        `${path}: expected one of [${resolved.enum.join(", ")}], got ${JSON.stringify(value)}`,
      );
    }
    return;
  }

  // Type check
  if (resolved.type) {
    const actualType = Array.isArray(value) ? "array" : typeof value;

    if (resolved.type === "number" && actualType !== "number") {
      errors.push(`${path}: expected number, got ${actualType}`);
      return;
    }
    if (resolved.type === "integer") {
      if (actualType !== "number" || !Number.isInteger(value)) {
        errors.push(`${path}: expected integer, got ${actualType}`);
        return;
      }
    }
    if (resolved.type === "string" && actualType !== "string") {
      errors.push(`${path}: expected string, got ${actualType}`);
      return;
    }
    if (resolved.type === "boolean" && actualType !== "boolean") {
      errors.push(`${path}: expected boolean, got ${actualType}`);
      return;
    }
    if (resolved.type === "array" && !Array.isArray(value)) {
      errors.push(`${path}: expected array, got ${actualType}`);
      return;
    }
    if (
      resolved.type === "object" &&
      (actualType !== "object" || value === null || Array.isArray(value))
    ) {
      errors.push(`${path}: expected object, got ${value === null ? "null" : actualType}`);
      return;
    }
  }

  // Range checks
  if (resolved.minimum !== undefined && typeof value === "number" && value < resolved.minimum) {
    errors.push(`${path}: value ${value} is less than minimum ${resolved.minimum}`);
  }
  if (resolved.maximum !== undefined && typeof value === "number" && value > resolved.maximum) {
    errors.push(`${path}: value ${value} is greater than maximum ${resolved.maximum}`);
  }

  // Object validation
  if (
    resolved.type === "object" &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    const obj = value as Record<string, unknown>;

    // Required fields
    if (resolved.required) {
      for (const key of resolved.required) {
        if (!(key in obj) || obj[key] === undefined) {
          errors.push(`${path}: missing required field "${key}"`);
        }
      }
    }

    // Property validation
    if (resolved.properties) {
      for (const [key, propSchema] of Object.entries(resolved.properties)) {
        if (key in obj && obj[key] !== undefined) {
          validateNode(obj[key], propSchema, root, `${path}.${key}`, errors);
        }
      }

      // Additional properties check
      if (resolved.additionalProperties === false) {
        const allowed = new Set(Object.keys(resolved.properties));
        for (const key of Object.keys(obj)) {
          if (!allowed.has(key)) {
            errors.push(`${path}: unexpected property "${key}"`);
          }
        }
      }
    }
  }

  // Array validation
  if (resolved.type === "array" && Array.isArray(value) && resolved.items) {
    for (let i = 0; i < value.length; i++) {
      validateNode(value[i], resolved.items, root, `${path}[${i}]`, errors);
    }
  }
}

/**
 * Validate tool input against its JSON schema definition.
 *
 * @param input - Raw input from the MCP client
 * @param schema - The schema definition object (from schemas.json[toolName].schema.definitions[InterfaceName])
 * @param root - The full schema root (for resolving $ref)
 */
export function validateInput(
  input: unknown,
  schema: SchemaNode,
  root: SchemaRoot = {},
): ValidationResult {
  if (input === null || input === undefined || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["Input must be a non-null object"] };
  }

  const errors: string[] = [];
  validateNode(input, { ...schema, type: "object" }, root, "input", errors);
  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}
