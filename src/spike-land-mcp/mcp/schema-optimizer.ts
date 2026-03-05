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
  return optimizeNode(schema, undefined) as object;
}

/**
 * Measures the approximate token savings by comparing JSON lengths.
 * (Assuming ~4 chars per token)
 */
export function measureTokenSavings(original: object, optimized: object): { originalLength: number; optimizedLength: number; savedLength: number; approximateTokensSaved: number } {
  const originalLength = JSON.stringify(original).length;
  const optimizedLength = JSON.stringify(optimized).length;
  const savedLength = originalLength - optimizedLength;
  return {
    originalLength,
    optimizedLength,
    savedLength,
    approximateTokensSaved: Math.round(savedLength / 4),
  };
}

export function shortenDescription(desc: string): string {
  let shortened = desc.trim();
  
  // Strip leading "The " or "A " or "An " from descriptions
  const lower = shortened.toLowerCase();
  if (lower.startsWith("the ")) shortened = shortened.slice(4).trim();
  else if (lower.startsWith("a ")) shortened = shortened.slice(2).trim();
  else if (lower.startsWith("an ")) shortened = shortened.slice(3).trim();
  
  // Remove trailing period BEFORE truncation/ellipsis
  if (shortened.endsWith(".")) {
    shortened = shortened.slice(0, -1);
  }
  
  // Truncate to first sentence if > 80 chars
  if (shortened.length > 80) {
    const periodIndex = shortened.indexOf(". ");
    if (periodIndex !== -1) {
      shortened = shortened.slice(0, periodIndex);
    } else {
      // Find a reasonable break point or just hard truncate
      const breakIndex = shortened.lastIndexOf(" ", 80);
      if (breakIndex !== -1 && breakIndex > 50) {
         shortened = shortened.slice(0, breakIndex) + "...";
      } else {
         shortened = shortened.slice(0, 77) + "...";
      }
    }
  }
  
  // Capitalize first letter
  if (shortened.length > 0) {
    shortened = shortened.charAt(0).toUpperCase() + shortened.slice(1);
  }
  
  return shortened;
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

    // Process descriptions
    if (key === "description" && typeof value === "string") {
      if (propertyName && isRedundantDescription(propertyName, value, obj.enum as unknown[] | undefined)) {
        continue; // strip entirely
      }
      
      const shortened = shortenDescription(value);
      if (shortened.length > 0) {
        result[key] = shortened;
      }
      continue;
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

function isRedundantDescription(propertyName: string, description: string, enumValues?: unknown[]): boolean {
  const normalized = description.toLowerCase().trim().replace(/[_-]/g, " ");
  const normalizedName = propertyName.toLowerCase().replace(/[_-]/g, " ");

  // Exact match: description is just the property name
  if (normalized === normalizedName) return true;

  // "The <name>" pattern
  if (normalized === `the ${normalizedName}`) return true;

  // "A <name>" or "An <name>" pattern
  if (normalized === `a ${normalizedName}` || normalized === `an ${normalizedName}`) return true;
  
  // "The <words> of the <name>" or "The <words> for the <name>"
  if (normalized.endsWith(` of the ${normalizedName}`) || normalized.endsWith(` for the ${normalizedName}`)) return true;
  if (normalized.endsWith(` of ${normalizedName}`) || normalized.endsWith(` for ${normalizedName}`)) return true;

  // "ID for <name>" or "ID of <name>"
  if (normalized === `id for ${normalizedName}` || normalized === `id of ${normalizedName}`) return true;

  // Boolean patterns
  if (normalized === `whether to ${normalizedName}` || 
      normalized === `true if ${normalizedName}` || 
      normalized === `if true, ${normalizedName}`) return true;

  // Enum self-describing
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    const enumStrs = enumValues.map(v => String(v).toLowerCase());
    const enumStr = enumStrs.join(", ");
    const enumStr2 = enumStrs.join(" or ");
    const enumStr3 = enumStrs.join("/");
    
    // If the description just lists the enum values
    if (normalized === enumStr || 
        normalized === enumStr2 || 
        normalized === enumStr3 ||
        normalized === `one of: ${enumStr}` ||
        normalized === `one of ${enumStr}` ||
        normalized.includes(`[${enumStr}]`)) {
      return true;
    }
  }

  return false;
}

function isSchemaObject(key: string, value: unknown): value is Record<string, unknown> {
  const schemaKeys = ["items", "additionalProperties", "not", "if", "then", "else"];
  return (
    schemaKeys.includes(key) && typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

function isSchemaArray(key: string, value: unknown): value is unknown[] {
  const arrayKeys = ["allOf", "anyOf", "oneOf", "prefixItems"];
  return arrayKeys.includes(key) && Array.isArray(value);
}